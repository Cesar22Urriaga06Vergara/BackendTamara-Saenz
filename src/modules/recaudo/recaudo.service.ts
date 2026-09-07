import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { EstadoRecibo, ReciboCaja } from './entities/recibo-caja.entity';
import { DetallePago } from './entities/detalle-pago.entity';
import { AplicacionPago, ConceptoAplicacion } from './entities/aplicacion-pago.entity';
import { SaldoFavorCredito } from './entities/saldo-favor-credito.entity';
import { DescuentoDeposito, TipoDescuentoDeposito } from './entities/descuento-deposito.entity';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { AnularReciboDto } from './dto/anular-recibo.dto';
import { LiquidarDepositoDto } from './dto/liquidar-deposito.dto';
import { FilterReciboDto } from './dto/filter-recibo.dto';
import { FilterDeudoresDto } from './dto/filter-deudores.dto';
import { Contrato, EstadoContrato } from '../contratos/entities/contrato.entity';
import { Obligacion, TipoObligacion } from '../obligaciones/entities/obligacion.entity';
import { ObligacionesService } from '../obligaciones/obligaciones.service';
import { ConsecutivoService } from '../empresa/consecutivo.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { OrigenMovimiento } from '../movimientos/entities/movimiento.entity';
import { paginar, paginarArray } from '../../common/utils/paginar.util';
import { redondearMoneda, esCeroMoneda } from '../../common/utils/dinero.util';
import { finDelDiaLocal } from '../../common/utils/fecha.util';

/**
 * Motor de recaudo: pagos mixtos, aplicación en el orden de negocio Canon → Novedad (§10 de
 * la especificación, actualizado el 2026-09-01: se retiró el costo de mora / interés por
 * retraso — los cobros son netos, exclusivamente por capital; dentro de cada grupo, las más
 * vencidas primero), excedente devuelto de inmediato como cambio por defecto (o como saldo a
 * favor si el cliente lo pide expresamente — RDN-01), anulación con reverso EXACTO (nunca
 * DELETE) y liquidación del depósito de garantía al terminar contrato.
 */
@Injectable()
export class RecaudoService {
  constructor(
    @InjectRepository(ReciboCaja) private readonly reciboRepo: Repository<ReciboCaja>,
    @InjectRepository(AplicacionPago) private readonly aplicacionRepo: Repository<AplicacionPago>,
    @InjectRepository(DetallePago) private readonly detallePagoRepo: Repository<DetallePago>,
    @InjectRepository(Contrato) private readonly contratoRepo: Repository<Contrato>,
    @InjectRepository(DescuentoDeposito) private readonly descuentoDepositoRepo: Repository<DescuentoDeposito>,
    private readonly dataSource: DataSource,
    private readonly obligacionesService: ObligacionesService,
    private readonly consecutivoService: ConsecutivoService,
    private readonly movimientosService: MovimientosService,
  ) {}

  async registrarPago(dto: RegistrarPagoDto, registradoPorEmail: string): Promise<ReciboCaja> {
    const valorTotalPago = redondearMoneda(dto.detallesPago.reduce((acc, d) => acc + d.monto, 0));
    if (valorTotalPago <= 0) throw new BadRequestException('El valor total del pago debe ser mayor a cero.');

    return this.dataSource.transaction(async (manager) => {
      const contrato = await manager
        .createQueryBuilder(Contrato, 'c')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('c.cliente', 'cliente')
        .where('c.id = :id', { id: dto.contratoId })
        .getOne();
      if (!contrato) throw new NotFoundException('Contrato no encontrado.');

      // 1) Aplicar saldo a favor existente antes que el nuevo pago (a favor del cliente).
      // Se consume en orden FIFO por crédito individual (AUD-006), no como un único número
      // agregado: así, al anular un recibo, solo se revierte SU PROPIO crédito, sin afectar
      // saldo a favor generado por recibos posteriores no relacionados.
      const creditoRepo = manager.getRepository(SaldoFavorCredito);
      const creditosDisponibles = await creditoRepo
        .createQueryBuilder('sf')
        .setLock('pessimistic_write')
        .where('sf.contratoId = :contratoId', { contratoId: contrato.id })
        .andWhere('sf.montoDisponible > 0')
        .orderBy('sf.creadoEn', 'ASC')
        .getMany();
      const saldoFavorDisponible = redondearMoneda(
        creditosDisponibles.reduce((acc, c) => acc + Number(c.montoDisponible), 0),
      );
      const disponible = redondearMoneda(valorTotalPago + saldoFavorDisponible);

      // 2) Traer obligaciones con saldo por cobrar del contrato — capital PENDIENTE/PARCIAL
      // (ver `condicionSaldoPendiente`) — agrupadas Canon primero y Novedad después (§10 de la
      // especificación — reemplaza el FIFO genérico por fecha), y dentro de cada grupo
      // ordenadas por antigüedad (más vencidas primero).
      const obligacionesDelContrato = await manager
        .getRepository(Obligacion)
        .createQueryBuilder('o')
        .where('o.contratoId = :contratoId', { contratoId: contrato.id })
        .andWhere(this.obligacionesService.condicionSaldoPendiente())
        .setParameters(this.obligacionesService.parametrosCondicionSaldoPendiente())
        .orderBy('o.fechaVencimiento', 'ASC')
        .getMany();
      const ordenAplicacion = [
        ...obligacionesDelContrato.filter((o) => o.tipo === TipoObligacion.CANON),
        ...obligacionesDelContrato.filter((o) => o.tipo === TipoObligacion.NOVEDAD),
      ];

      // No se emite un recibo que no abona nada: si el contrato no tiene ninguna obligación por
      // cobrar (canon aún sin generar, o todo pagado), antes el pago se convertía íntegramente
      // en "cambio" y no quedaba registrado como abono de ningún canon.
      if (ordenAplicacion.length === 0) {
        throw new BadRequestException(
          'Este contrato no tiene obligaciones pendientes. Genera el canon antes de registrar el pago.',
        );
      }

      // 2.1) Calcula el plan de aplicación (a qué obligación va cada peso, en orden
      // Canon → Novedad) con el MISMO método puro que usa `simularPago` para la
      // previsualización (sin cálculo espejo en el frontend: un solo lugar define esta regla).
      const { aplicaciones: plan, excedente } = this.calcularPlanAplicacion(ordenAplicacion, disponible);

      // 2.2) Persistir cada abono del plan en su obligación real. Guarda también el desglose
      // (obligación + monto + saldo posterior) para permitir reverso preciso y para que el
      // recibo pueda mostrar la aplicación real del dinero (§20, hallazgo RECAUDO-03).
      const aplicaciones = plan;
      for (const item of plan) {
        await this.obligacionesService.aplicarAbono(item.obligacionId, item.monto, manager);
      }

      // 3) Descontar de los créditos de saldo a favor (FIFO) exactamente lo que se consumió
      // de ellos en el paso 2, antes de calcular el excedente remanente.
      const totalAplicado = redondearMoneda(valorTotalPago + saldoFavorDisponible - excedente);
      const consumidoDeSaldoFavor = redondearMoneda(Math.min(saldoFavorDisponible, totalAplicado));
      let restantePorDescontar = consumidoDeSaldoFavor;
      for (const credito of creditosDisponibles) {
        if (esCeroMoneda(restantePorDescontar) || restantePorDescontar <= 0) break;
        const consumir = redondearMoneda(Math.min(restantePorDescontar, Number(credito.montoDisponible)));
        credito.montoDisponible = redondearMoneda(Number(credito.montoDisponible) - consumir);
        await creditoRepo.save(credito);
        restantePorDescontar = redondearMoneda(restantePorDescontar - consumir);
      }

      // 4) El excedente que devuelve `calcularPlanAplicacion` mezcla dos cosas: el EFECTIVO que
      // el cliente entregó de más, y el SALDO A FAVOR preexistente que este pago no llegó a
      // consumir. Solo el efectivo sobrante se devuelve (como cambio, o como abono adelantado si
      // lo piden); el saldo a favor no consumido se queda intacto en sus créditos (hallazgo
      // A3-a: antes se "devolvía" también ese crédito, con pérdida de caja).
      const dejarComoSaldoFavor = dto.dejarExcedenteComoSaldoFavor === true;
      const efectivoAplicado = redondearMoneda(totalAplicado - consumidoDeSaldoFavor);
      const efectivoSobrante = redondearMoneda(Math.max(0, valorTotalPago - efectivoAplicado));

      // 5) Consecutivo atómico del recibo — se pasa el `manager` de esta transacción para que
      // el incremento del consecutivo haga rollback junto con el resto si algo falla después.
      const { formateado } = await this.consecutivoService.siguiente('RECIBO_CAJA', 'REC-', manager);

      const recibo = manager.create(ReciboCaja, {
        consecutivo: formateado,
        contrato,
        valorTotal: valorTotalPago,
        excedente: efectivoSobrante,
        excedenteComoSaldoFavor: dejarComoSaldoFavor,
        saldoFavorConsumido: consumidoDeSaldoFavor,
        estado: EstadoRecibo.EMITIDO,
        registradoPorEmail,
        detallesPago: dto.detallesPago.map((d) =>
          manager.create(DetallePago, { medioPago: d.medioPago, monto: d.monto, referencia: d.referencia ?? null }),
        ),
      });
      const guardado = await manager.save(recibo);

      // 5.1) Persistir la traza exacta de qué obligación recibió qué monto de este recibo —
      // necesario para revertir cada una correctamente. `concepto` queda en su default
      // (CAPITAL): el motor ya no genera aplicaciones de ningún otro concepto.
      const repoAplicacion = manager.getRepository(AplicacionPago);
      for (const a of aplicaciones) {
        await repoAplicacion.save(
          repoAplicacion.create({
            recibo: guardado,
            obligacion: { id: a.obligacionId } as any,
            montoAplicado: a.monto,
            concepto: ConceptoAplicacion.CAPITAL,
            saldoPosterior: a.saldoPosterior,
          }),
        );
      }

      // 5.2) Si sobró EFECTIVO y el cliente pidió dejarlo como abono adelantado, registrar el
      // crédito de saldo a favor ligado a ESTE recibo (AUD-006): es lo único que la anulación
      // de este recibo podrá revertir más adelante.
      if (efectivoSobrante > 0 && dejarComoSaldoFavor) {
        await creditoRepo.save(
          creditoRepo.create({
            contrato,
            recibo: guardado,
            montoOriginal: efectivoSobrante,
            montoDisponible: efectivoSobrante,
          }),
        );
      }

      // 5.3) `contrato.saldoAFavor` es un espejo de `SUM(saldo_favor_credito.montoDisponible)`
      // — se recalcula desde el ledger real (hallazgo B1 de la auditoría contable 2026-09-01:
      // antes se fijaba por asignación aquí y por delta en `anular`, dos estrategias
      // divergentes que podían dejarlo desalineado del ledger sin que nada lo corrigiera).
      await this.sincronizarSaldoAFavor(contrato.id, manager);

      // 6) Movimiento(s) de caja tipo INGRESO, atado(s) al mismo recibo/contrato — UNO POR
      // CADA MEDIO DE PAGO recibido (hallazgo CAJA-01 de la auditoría): antes se registraba
      // un único movimiento por el total agregado, mezclando estructuralmente caja física
      // (efectivo) con control bancario (transferencias) en un pago mixto. Al dividir por
      // `detallesPago`, cada movimiento queda con su propio `medioPago` y `referencia`.
      for (const detalle of dto.detallesPago) {
        await this.movimientosService.registrarIngreso(
          {
            origen: OrigenMovimiento.RECAUDO,
            concepto: `Recaudo recibo ${formateado} — ${contrato.cliente?.nombreCompleto ?? contrato.id} (${detalle.medioPago})`,
            monto: detalle.monto,
            registradoPorEmail,
            reciboId: guardado.id,
            contratoId: contrato.id,
            medioPago: detalle.medioPago,
            referencia: detalle.referencia ?? null,
          },
          manager,
        );
      }

      // 6.1) Cambio devuelto de inmediato (RDN-01, hallazgo RECAUDO-02 de la auditoría) —
      // EGRESO por el excedente, atado al mismo recibo, para que `RecaudoService.anular()` lo
      // revierta automáticamente igual que cualquier otro movimiento del recibo (recupera el
      // cambio entregado si el pago que lo originó se anula). El medio de la devolución es el
      // del ÚLTIMO medio de pago recibido: para un pago de un solo medio (el caso normal) es
      // inequívoco; para uno mixto con excedente (caso raro) es un criterio técnico razonable,
      // no una regla de negocio — la especificación no distingue el medio de origen del vuelto.
      if (efectivoSobrante > 0 && !dejarComoSaldoFavor) {
        const ultimoDetalle = dto.detallesPago[dto.detallesPago.length - 1];
        await this.movimientosService.registrarEgreso(
          {
            origen: OrigenMovimiento.RECAUDO,
            concepto: `Cambio entregado — recibo ${formateado}`,
            monto: efectivoSobrante,
            registradoPorEmail,
            reciboId: guardado.id,
            contratoId: contrato.id,
            medioPago: ultimoDetalle.medioPago,
            referencia: ultimoDetalle.referencia ?? null,
          },
          manager,
        );
      }

      return guardado;
    });
  }

  /**
   * ÚNICO lugar donde vive la regla de aplicación del dinero (§10: Canon → Novedad). Método
   * puro (sin I/O, sin efectos secundarios): recibe las obligaciones ya ordenadas y devuelve
   * qué se aplicaría a cada una y cuánto sobra. Lo usan tanto `registrarPago` (que persiste el
   * resultado) como `simularPago` (que solo lo muestra) — así la previsualización del frontend
   * nunca puede desviarse del pago real: no hay una segunda copia de esta lógica en ninguna
   * otra parte (ni backend ni frontend).
   *
   * Todo monto se redondea a 2 decimales en cada paso (hallazgo B2 de la auditoría contable
   * 2026-09-01): sin este punto único de redondeo, el drift de punto flotante entre lo que
   * calcula el código y lo que persiste `decimal(12,2)` podía dejar obligaciones atascadas en
   * PARCIAL por fracciones de centavo, o generar aplicaciones con `montoAplicado ≈ 0`.
   */
  private calcularPlanAplicacion(
    ordenAplicacion: Obligacion[],
    disponibleInicial: number,
  ): {
    aplicaciones: { obligacionId: string; monto: number; saldoPosterior: number }[];
    excedente: number;
  } {
    let disponible = redondearMoneda(disponibleInicial);
    const aplicaciones: { obligacionId: string; monto: number; saldoPosterior: number }[] = [];

    // Capital, Canon íntegro antes que Novedad (§10).
    for (const obligacion of ordenAplicacion) {
      if (disponible <= 0 || esCeroMoneda(disponible)) break;
      const saldoCapital = redondearMoneda(Number(obligacion.valorOriginal) - Number(obligacion.valorAbonado));
      if (saldoCapital <= 0 || esCeroMoneda(saldoCapital)) continue;

      const abono = redondearMoneda(Math.min(disponible, saldoCapital));
      aplicaciones.push({
        obligacionId: obligacion.id,
        monto: abono,
        saldoPosterior: redondearMoneda(saldoCapital - abono),
      });
      disponible = redondearMoneda(disponible - abono);
    }

    return { aplicaciones, excedente: redondearMoneda(Math.max(0, disponible)) };
  }

  /**
   * Previsualización de un recaudo — SOLO LECTURA, no aplica ningún abono, no crea recibo, no
   * mueve caja (§2 del módulo de Recibos: "la previsualización NO debe ejecutar la operación
   * financiera"). Usa `calcularPlanAplicacion`, el MISMO método que `registrarPago`, así que el
   * desglose que ve el cajero antes de confirmar es exactamente el que se va a persistir — no
   * una reconstrucción aproximada en el frontend.
   */
  async simularPago(dto: RegistrarPagoDto) {
    const valorTotalPago = redondearMoneda(dto.detallesPago.reduce((acc, d) => acc + d.monto, 0));
    if (valorTotalPago <= 0) throw new BadRequestException('El valor total del pago debe ser mayor a cero.');

    const contrato = await this.dataSource
      .getRepository(Contrato)
      .findOne({ where: { id: dto.contratoId }, relations: ['cliente', 'inmueble'] });
    if (!contrato) throw new NotFoundException('Contrato no encontrado.');

    const { total: saldoFavorDisponibleRaw } = await this.dataSource
      .getRepository(SaldoFavorCredito)
      .createQueryBuilder('sf')
      .select('COALESCE(SUM(sf.montoDisponible), 0)', 'total')
      .where('sf.contratoId = :contratoId', { contratoId: contrato.id })
      .andWhere('sf.montoDisponible > 0')
      .getRawOne();
    const saldoFavorDisponible = redondearMoneda(Number(saldoFavorDisponibleRaw));

    // Mismas obligaciones pendientes que ve la ficha de recaudo (`ObligacionesService.pendientesPorContrato`).
    const obligacionesPendientes = await this.obligacionesService.pendientesPorContrato(contrato.id);
    const ordenAplicacion = [
      ...obligacionesPendientes.filter((o) => o.tipo === TipoObligacion.CANON),
      ...obligacionesPendientes.filter((o) => o.tipo === TipoObligacion.NOVEDAD),
    ];
    if (ordenAplicacion.length === 0) {
      throw new BadRequestException(
        'Este contrato no tiene obligaciones pendientes. Genera el canon antes de registrar el pago.',
      );
    }

    const disponibleInicial = redondearMoneda(valorTotalPago + saldoFavorDisponible);
    const { aplicaciones, excedente } = this.calcularPlanAplicacion(ordenAplicacion, disponibleInicial);
    const dejarComoSaldoFavor = dto.dejarExcedenteComoSaldoFavor === true;

    // Mismo desglose del excedente que `registrarPago`: solo el efectivo sobrante se devuelve;
    // el saldo a favor preexistente no consumido no cuenta como "cambio".
    const totalAplicado = redondearMoneda(disponibleInicial - excedente);
    const consumidoDeSaldoFavor = redondearMoneda(Math.min(saldoFavorDisponible, totalAplicado));
    const efectivoSobrante = redondearMoneda(Math.max(0, valorTotalPago - (totalAplicado - consumidoDeSaldoFavor)));

    return {
      contrato: { id: contrato.id, cliente: contrato.cliente, inmueble: contrato.inmueble },
      detallesPago: dto.detallesPago,
      valorTotalPago,
      saldoFavorDisponible,
      saldoFavorConsumido: consumidoDeSaldoFavor,
      aplicaciones: aplicaciones.map((a) => ({
        ...a,
        obligacion: ordenAplicacion.find((o) => o.id === a.obligacionId),
      })),
      excedente: efectivoSobrante,
      excedenteComoSaldoFavor: dejarComoSaldoFavor,
    };
  }

  async obtener(id: string): Promise<ReciboCaja> {
    const recibo = await this.reciboRepo.findOne({
      where: { id },
      relations: [
        'contrato',
        'contrato.cliente',
        'contrato.inmueble',
        'detallesPago',
        'aplicaciones',
        'aplicaciones.obligacion',
      ],
    });
    if (!recibo) throw new NotFoundException('Recibo no encontrado.');
    return recibo;
  }

  async listarPorContrato(contratoId: string, page?: string, limit?: string) {
    const qb = this.reciboRepo
      .createQueryBuilder('r')
      .where('r.contratoId = :contratoId', { contratoId })
      .orderBy('r.creadoEn', 'DESC');
    return paginar(qb, page, limit);
  }

  /**
   * Listado general de Recibos — módulo independiente (no requiere pasar primero por el
   * contrato/cliente para localizar un recibo ya emitido). Búsqueda por cédula/nombre del
   * cliente o por consecutivo del recibo; `medioPago` filtra por recibos que tengan AL MENOS
   * un `DetallePago` con ese medio (un pago mixto puede aparecer en ambos filtros).
   */
  async listar(filtro: FilterReciboDto) {
    const qb = this.reciboRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.contrato', 'contrato')
      .leftJoinAndSelect('contrato.cliente', 'cliente')
      .leftJoinAndSelect('contrato.inmueble', 'inmueble')
      .orderBy('r.creadoEn', 'DESC');

    if (filtro.busqueda) {
      qb.andWhere(
        '(cliente.numeroDocumento LIKE :busqueda OR cliente.nombreCompleto LIKE :busqueda OR r.consecutivo LIKE :busqueda)',
        {
          busqueda: `%${filtro.busqueda}%`,
        },
      );
    }
    if (filtro.estado) qb.andWhere('r.estado = :estado', { estado: filtro.estado });
    if (filtro.fechaDesde) qb.andWhere('r.creadoEn >= :desde', { desde: filtro.fechaDesde });
    // `fechaHasta` sin hora contra `creadoEn` datetime: subir al último instante del día para
    // no excluir todo lo emitido ese mismo día (misma clase de bug que AUD-021).
    if (filtro.fechaHasta) qb.andWhere('r.creadoEn <= :hasta', { hasta: finDelDiaLocal(filtro.fechaHasta) });
    if (filtro.medioPago) {
      qb.andWhere('EXISTS (SELECT 1 FROM detalle_pago dp WHERE dp.reciboId = r.id AND dp.medioPago = :medioPago)', {
        medioPago: filtro.medioPago,
      });
    }

    const resultado = await paginar(qb, filtro.page, filtro.limit);

    // `detallesPago` se trae en una segunda consulta, NUNCA con `leftJoinAndSelect` en la
    // query paginada de arriba: un JOIN 1:N (un recibo puede tener varios medios de pago)
    // combinado con `skip`/`take` aplica el LIMIT sobre filas ya combinadas, no sobre recibos
    // distintos — puede duplicar o recortar recibos de la página de forma incorrecta.
    if (resultado.data.length > 0) {
      const detalles = await this.detallePagoRepo.find({
        where: { recibo: { id: In(resultado.data.map((r) => r.id)) } },
        relations: ['recibo'],
      });
      for (const recibo of resultado.data) {
        recibo.detallesPago = detalles.filter((d) => d.recibo.id === recibo.id);
      }
    }

    return resultado;
  }

  /** Sin paginar — uso exclusivo de exports (reportes .xlsx), donde se necesita el universo completo. */
  listarTodosParaExport(): Promise<ReciboCaja[]> {
    return this.reciboRepo.find({
      relations: ['contrato', 'contrato.cliente', 'contrato.inmueble'],
      order: { creadoEn: 'DESC' },
    });
  }

  /**
   * Recalcula `contrato.saldoAFavor` desde su fuente de verdad —
   * `SUM(saldo_favor_credito.montoDisponible)` de los créditos vigentes del contrato — en vez
   * de mutarlo por asignación o por delta en cada sitio que toca un crédito (hallazgo B1 de la
   * auditoría contable 2026-09-01). Debe llamarse dentro de la misma transacción, después de
   * cualquier cambio a `SaldoFavorCredito` del contrato.
   */
  private async sincronizarSaldoAFavor(contratoId: string, manager: EntityManager): Promise<void> {
    const { total } = await manager
      .getRepository(SaldoFavorCredito)
      .createQueryBuilder('sf')
      .select('COALESCE(SUM(sf.montoDisponible), 0)', 'total')
      .where('sf.contratoId = :contratoId', { contratoId })
      .andWhere('sf.montoDisponible > 0')
      .getRawOne();
    await manager
      .createQueryBuilder()
      .update(Contrato)
      .set({ saldoAFavor: redondearMoneda(Number(total)) })
      .where('id = :contratoId', { contratoId })
      .execute();
  }

  /**
   * Anulación de recibo: NUNCA se elimina. Cambia estado a ANULADO, revierte EXACTAMENTE
   * cada abono aplicado a sus obligaciones de origen (usando `AplicacionPago`), revierte
   * únicamente la porción aún disponible del crédito de saldo a favor que este recibo
   * generó —si lo hubo— sin afectar créditos de recibos posteriores (`SaldoFavorCredito`,
   * AUD-006), y genera el movimiento de reverso (EGRESO) equivalente al ingreso original.
   */
  async anular(id: string, dto: AnularReciboDto, registradoPorEmail: string): Promise<ReciboCaja> {
    return this.dataSource.transaction(async (manager) => {
      const reciboRepo = manager.getRepository(ReciboCaja);
      // Bloqueo pesimista sobre el recibo: evita que dos solicitudes de anulación
      // concurrentes sobre el mismo recibo pasen ambas la verificación de "no anulado"
      // antes de que cualquiera confirme su cambio de estado.
      const recibo = await reciboRepo
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.contrato', 'contrato')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id })
        .getOne();
      if (!recibo) throw new NotFoundException('Recibo no encontrado.');
      if (recibo.estado === EstadoRecibo.ANULADO) {
        throw new BadRequestException('Este recibo ya se encuentra anulado.');
      }

      // 1) Revertir cada aplicación exacta sobre su obligación de origen. El flujo actual solo
      // crea `CAPITAL`; la compatibilidad con registros legacy con `concepto = 'MORA'` se
      // mantiene únicamente para reversión de historiales ya emitidos antes del retiro de mora.
      const aplicacionRepo = manager.getRepository(AplicacionPago);
      const aplicaciones = await aplicacionRepo.find({ where: { recibo: { id } }, relations: ['obligacion'] });
      for (const aplicacion of aplicaciones) {
        if ((aplicacion.concepto as string) === 'MORA') {
          await this.obligacionesService.revertirAbonoMora(
            aplicacion.obligacion.id,
            Number(aplicacion.montoAplicado),
            manager,
          );
        } else {
          await this.obligacionesService.revertirAbono(
            aplicacion.obligacion.id,
            Number(aplicacion.montoAplicado),
            manager,
          );
        }
      }

      // 2) Saldo a favor. Dos ajustes, ambos sobre el mismo contrato bloqueado:
      //  (a) revertir SOLO la porción aún disponible del crédito que este recibo GENERÓ — si ya
      //      fue consumida por un pago posterior no relacionado, no se toca (AUD-006);
      //  (b) restituir el saldo a favor PREEXISTENTE que este recibo consumió (`saldoFavorConsumido`),
      //      como un crédito fresco: el pago que ese saldo financió se revierte completo en el
      //      paso 1, así que el cliente debe recuperar ese saldo (hallazgo A3-a).
      // `contrato.saldoAFavor` se recalcula al final desde el ledger (`sincronizarSaldoAFavor`,
      // B1) — no se toca por asignación/delta aquí.
      const contratoRepo = manager.getRepository(Contrato);
      const contrato = await contratoRepo
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: recibo.contrato.id })
        .getOneOrFail();
      const creditoRepo = manager.getRepository(SaldoFavorCredito);

      const creditosGenerados = await creditoRepo.find({ where: { recibo: { id } } });
      for (const credito of creditosGenerados) {
        if (Number(credito.montoDisponible) <= 0) continue;
        credito.montoDisponible = 0;
        await creditoRepo.save(credito);
      }

      const consumido = Number(recibo.saldoFavorConsumido ?? 0);
      if (consumido > 0) {
        await creditoRepo.save(
          creditoRepo.create({
            contrato,
            recibo,
            montoOriginal: consumido,
            montoDisponible: consumido,
          }),
        );
      }

      await this.sincronizarSaldoAFavor(contrato.id, manager);

      // 3) Marcar el recibo como anulado (sin DELETE).
      recibo.estado = EstadoRecibo.ANULADO;
      recibo.motivoAnulacion = dto.motivo;
      await reciboRepo.save(recibo);

      // 4) Movimiento(s) de reverso (EGRESO) sobre el/los ingreso(s) original(es) de este
      // recibo — un pago mixto genera un movimiento por cada medio (ver paso 6 de
      // `registrarPago`), así que TODOS deben revertirse, no solo el primero. Se pasa el
      // `manager` de esta transacción para que quede atómico con la reversión de las
      // obligaciones del paso 1: si esto falla, también hace rollback lo ya revertido arriba.
      const asociados = await this.movimientosService.buscarOriginalesPorRecibo(id, manager);
      for (const asociado of asociados) {
        await this.movimientosService.reversar(
          asociado.id,
          `Anulación recibo ${recibo.consecutivo}: ${dto.motivo}`,
          registradoPorEmail,
          manager,
        );
      }

      return recibo;
    });
  }

  /**
   * Liquidación del depósito de garantía al terminar contrato: genera un EGRESO por la
   * devolución neta (depósito - descuentos GENERAL - deuda efectivamente aplicada), y persiste
   * cada descuento por separado con su propio concepto/valor (§19, hallazgo DEP-01 de la
   * auditoría: antes solo se recibía un número agregado, sin explicar en qué se descontó). El
   * medio de pago de la devolución es obligatorio cuando efectivamente queda saldo por
   * devolver (mismo principio de CAJA-01: una devolución en efectivo mueve caja física, una
   * por transferencia mueve control bancario, y nunca debe quedar "sin medio" cuando sí hubo
   * movimiento de dinero real).
   */
  async liquidarDeposito(contratoId: string, dto: LiquidarDepositoDto, registradoPorEmail: string) {
    return this.dataSource.transaction(async (manager) => {
      const contrato = await manager
        .createQueryBuilder(Contrato, 'c')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('c.cliente', 'cliente')
        .where('c.id = :id', { id: contratoId })
        .getOne();
      if (!contrato) throw new NotFoundException('Contrato no encontrado.');
      if (contrato.estado !== EstadoContrato.TERMINADO) {
        throw new BadRequestException('Solo se puede liquidar el depósito de un contrato terminado.');
      }
      if (contrato.depositoLiquidadoEn) {
        throw new BadRequestException('El depósito de este contrato ya fue liquidado previamente.');
      }

      const descuentos = dto.descuentos ?? [];
      const valorDescuentosGeneral = redondearMoneda(
        descuentos
          .filter((d) => (d.tipo ?? TipoDescuentoDeposito.GENERAL) === TipoDescuentoDeposito.GENERAL)
          .reduce((acc, d) => acc + d.valor, 0),
      );

      // Descuentos tipo DEUDA: abonan la obligación real del contrato con el motor de recaudo
      // (Canon→Novedad), para que no queden como cartera viva mientras el depósito baja
      // (hallazgo LB-6). Genera un recibo interno marcado `esLiquidacionDeposito`, sin movimiento
      // de caja (el depósito ya había ingresado al sistema, no entra ni sale nuevamente).
      //
      // `deudaRealAplicada` (hallazgo B6 de la auditoría contable 2026-09-01): la devolución
      // neta solo descuenta lo que el plan de aplicación EFECTIVAMENTE alcanzó a abonar a
      // obligaciones reales, nunca el `deudaAAplicar` solicitado a ciegas — antes, un residuo
      // por debajo del umbral de tolerancia (`sobra`) se restaba igual de la devolución sin
      // bajar ninguna obligación ni devolverse al cliente: ese residuo "desaparecía".
      const deudaAAplicar = redondearMoneda(
        descuentos.filter((d) => d.tipo === TipoDescuentoDeposito.DEUDA).reduce((acc, d) => acc + d.valor, 0),
      );
      let deudaRealAplicada = 0;
      if (deudaAAplicar > 0) {
        const obligacionesPend = await manager
          .getRepository(Obligacion)
          .createQueryBuilder('o')
          .where('o.contratoId = :id', { id: contrato.id })
          .andWhere(this.obligacionesService.condicionSaldoPendiente())
          .setParameters(this.obligacionesService.parametrosCondicionSaldoPendiente())
          .orderBy('o.fechaVencimiento', 'ASC')
          .getMany();
        const orden = [
          ...obligacionesPend.filter((o) => o.tipo === TipoObligacion.CANON),
          ...obligacionesPend.filter((o) => o.tipo === TipoObligacion.NOVEDAD),
        ];

        const { aplicaciones, excedente: sobra } = this.calcularPlanAplicacion(orden, deudaAAplicar);
        if (!esCeroMoneda(sobra)) {
          const deudaReal = redondearMoneda(deudaAAplicar - sobra);
          throw new BadRequestException(
            `El descuento por deuda ($${Math.round(deudaAAplicar)}) supera la deuda pendiente del contrato ` +
              `($${Math.round(deudaReal)}). Ajuste el valor del descuento.`,
          );
        }
        deudaRealAplicada = redondearMoneda(deudaAAplicar - sobra);

        for (const item of aplicaciones) {
          await this.obligacionesService.aplicarAbono(item.obligacionId, item.monto, manager);
        }

        const { formateado } = await this.consecutivoService.siguiente('RECIBO_CAJA', 'REC-', manager);
        const reciboDeposito = await manager.save(
          manager.create(ReciboCaja, {
            consecutivo: formateado,
            contrato,
            valorTotal: deudaRealAplicada,
            excedente: 0,
            excedenteComoSaldoFavor: false,
            saldoFavorConsumido: 0,
            esLiquidacionDeposito: true,
            estado: EstadoRecibo.EMITIDO,
            registradoPorEmail,
            detallesPago: [],
          }),
        );
        const repoAplicacion = manager.getRepository(AplicacionPago);
        for (const a of aplicaciones) {
          await repoAplicacion.save(
            repoAplicacion.create({
              recibo: reciboDeposito,
              obligacion: { id: a.obligacionId } as any,
              montoAplicado: a.monto,
              concepto: ConceptoAplicacion.CAPITAL,
              saldoPosterior: a.saldoPosterior,
            }),
          );
        }
      }

      const valorDevolucion = redondearMoneda(
        Math.max(0, Number(contrato.depositoGarantia) - valorDescuentosGeneral - deudaRealAplicada),
      );

      if (valorDevolucion > 0) {
        if (!dto.medioPago) {
          throw new BadRequestException('Debe indicar el medio de pago (efectivo/transferencia) de la devolución.');
        }
        await this.movimientosService.registrarEgreso(
          {
            origen: OrigenMovimiento.DEPOSITO,
            concepto:
              `Devolución depósito de garantía — ${contrato.cliente?.nombreCompleto ?? contrato.id}. ${dto.observaciones ?? ''}`.trim(),
            monto: valorDevolucion,
            registradoPorEmail,
            contratoId: contrato.id,
            medioPago: dto.medioPago,
            referencia: dto.referencia ?? null,
          },
          manager,
        );
      }

      const repoDescuento = manager.getRepository(DescuentoDeposito);
      for (const descuento of descuentos) {
        await repoDescuento.save(
          repoDescuento.create({
            contrato,
            concepto: descuento.concepto,
            valor: descuento.valor,
            tipo: descuento.tipo ?? TipoDescuentoDeposito.GENERAL,
            registradoPorEmail,
          }),
        );
      }

      contrato.depositoGarantia = 0;
      contrato.depositoLiquidadoEn = new Date();
      await manager.save(contrato);

      return {
        contratoId,
        valorDevuelto: valorDevolucion,
        valorDescontado: redondearMoneda(valorDescuentosGeneral + deudaRealAplicada),
        descuentos,
      };
    });
  }

  /**
   * Listado de DEUDORES para la pantalla de Recaudo: un renglón por contrato con cartera
   * VENCIDA (mismo criterio `condicionCarteraVencida` que la pantalla Cartera y el dashboard),
   * con el total a cobrar (capital). El canon por vencer NO aparece. El universo de contratos
   * del ERP es pequeño: se agrupa y ordena en memoria.
   */
  async deudores(filtro: FilterDeudoresDto) {
    const obligaciones = await this.obligacionesService.todasPendientes();

    interface FilaDeudor {
      contratoId: string;
      cliente: { nombreCompleto: string; numeroDocumento: string };
      inmueble: { direccion: string; barrio: string };
      totalCapitalVencido: number;
      totalDeuda: number;
      obligacionesVencidas: number;
      fechaMasAntigua: string;
      saldoAFavor: number;
    }

    const porContrato = new Map<string, FilaDeudor>();
    for (const o of obligaciones) {
      const c = o.contrato;
      if (!c) continue;
      const fechaVenc = String(o.fechaVencimiento).slice(0, 10);
      let fila = porContrato.get(c.id);
      if (!fila) {
        fila = {
          contratoId: c.id,
          cliente: {
            nombreCompleto: c.cliente?.nombreCompleto ?? '',
            numeroDocumento: c.cliente?.numeroDocumento ?? '',
          },
          inmueble: { direccion: c.inmueble?.direccion ?? '', barrio: c.inmueble?.barrio ?? '' },
          totalCapitalVencido: 0,
          totalDeuda: 0,
          obligacionesVencidas: 0,
          fechaMasAntigua: fechaVenc,
          saldoAFavor: Number(c.saldoAFavor ?? 0),
        };
        porContrato.set(c.id, fila);
      }
      const capital = Math.max(0, Number(o.valorOriginal) - Number(o.valorAbonado));
      fila.totalCapitalVencido += capital;
      fila.totalDeuda += capital;
      fila.obligacionesVencidas += 1;
      if (fechaVenc < fila.fechaMasAntigua) fila.fechaMasAntigua = fechaVenc;
    }

    let filas = [...porContrato.values()].map((f) => ({
      ...f,
      totalCapitalVencido: redondearMoneda(f.totalCapitalVencido),
      totalDeuda: redondearMoneda(f.totalDeuda),
    }));

    if (filtro.busqueda) {
      const q = filtro.busqueda.toLowerCase();
      filas = filas.filter(
        (f) =>
          f.cliente.nombreCompleto.toLowerCase().includes(q) || f.cliente.numeroDocumento.toLowerCase().includes(q),
      );
    }

    filas.sort((a, b) =>
      filtro.orden === 'deuda_desc' ? b.totalDeuda - a.totalDeuda : a.fechaMasAntigua.localeCompare(b.fechaMasAntigua),
    );

    return paginarArray(filas, filtro.page, filtro.limit);
  }

  /** Contratos TERMINADOS con depósito de garantía aún sin liquidar — pantalla Depósitos. */
  async depositosPendientes(page?: string | number, limit?: string | number) {
    const qb = this.contratoRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.cliente', 'cliente')
      .leftJoinAndSelect('c.inmueble', 'inmueble')
      .where('c.estado = :estado', { estado: EstadoContrato.TERMINADO })
      .andWhere('c.depositoLiquidadoEn IS NULL')
      .andWhere('c.depositoGarantia > 0')
      .orderBy('c.fechaFin', 'ASC');
    return paginar(qb, page, limit);
  }

  /**
   * Contratos con depósito ya liquidado, con el desglose de descuentos de cada uno (§19,
   * DEP-01) — `DescuentoDeposito` no tiene relación inversa declarada en `Contrato` (unidirec-
   * cional a propósito, ver la entidad), así que el desglose se trae aparte y se agrupa aquí.
   */
  async depositosLiquidados(page?: string | number, limit?: string | number) {
    const qb = this.contratoRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.cliente', 'cliente')
      .leftJoinAndSelect('c.inmueble', 'inmueble')
      .where('c.depositoLiquidadoEn IS NOT NULL')
      .orderBy('c.depositoLiquidadoEn', 'DESC');
    const resultado = await paginar(qb, page, limit);

    const contratoIds = resultado.data.map((c) => c.id);
    const descuentos = contratoIds.length
      ? await this.descuentoDepositoRepo
          .createQueryBuilder('d')
          .leftJoin('d.contrato', 'contrato')
          .addSelect('contrato.id')
          .where('contrato.id IN (:...contratoIds)', { contratoIds })
          // Los descuentos anulados por una reversión de liquidación no cuentan (DEP-REV-01).
          .andWhere('d.anuladoEn IS NULL')
          .getMany()
      : [];

    return {
      ...resultado,
      data: resultado.data.map((contrato) => ({
        ...contrato,
        descuentos: descuentos.filter((d) => d.contrato.id === contrato.id),
      })),
    };
  }
}
