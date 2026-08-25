import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EstadoRecibo, ReciboCaja } from './entities/recibo-caja.entity';
import { DetallePago } from './entities/detalle-pago.entity';
import { AplicacionPago, ConceptoAplicacion } from './entities/aplicacion-pago.entity';
import { SaldoFavorCredito } from './entities/saldo-favor-credito.entity';
import { DescuentoDeposito } from './entities/descuento-deposito.entity';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { AnularReciboDto } from './dto/anular-recibo.dto';
import { LiquidarDepositoDto } from './dto/liquidar-deposito.dto';
import { FilterReciboDto } from './dto/filter-recibo.dto';
import { Contrato, EstadoContrato } from '../contratos/entities/contrato.entity';
import { Obligacion, TipoObligacion } from '../obligaciones/entities/obligacion.entity';
import { ObligacionesService } from '../obligaciones/obligaciones.service';
import { ConsecutivoService } from '../empresa/consecutivo.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { OrigenMovimiento } from '../movimientos/entities/movimiento.entity';
import { paginar } from '../../common/utils/paginar.util';

/**
 * Motor de recaudo: pagos mixtos, aplicación en el orden de negocio Canon → Novedad → Mora
 * (§10 de la especificación; dentro de cada grupo, las más vencidas primero), excedente
 * devuelto de inmediato como cambio por defecto (o como saldo a favor si el cliente lo pide
 * expresamente — RDN-01), anulación con reverso EXACTO (nunca DELETE) y liquidación del
 * depósito en custodia al terminar contrato.
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
    const valorTotalPago = dto.detallesPago.reduce((acc, d) => acc + d.monto, 0);
    if (valorTotalPago <= 0) throw new BadRequestException('El valor total del pago debe ser mayor a cero.');

    return this.dataSource.transaction(async (manager) => {
      const contrato = await manager
        .createQueryBuilder(Contrato, 'c')
        .setLock('pessimistic_write')
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
      const saldoFavorDisponible = creditosDisponibles.reduce((acc, c) => acc + Number(c.montoDisponible), 0);
      const disponible = valorTotalPago + saldoFavorDisponible;

      // 2) Traer obligaciones con saldo por cobrar del contrato — capital PENDIENTE/PARCIAL,
      // o capital ya PAGADA con mora aún sin cobrar (ver `condicionSaldoPendiente`) — agrupadas
      // Canon primero y Novedad después (§10 de la especificación — reemplaza el FIFO genérico
      // por fecha), y dentro de cada grupo ordenadas por antigüedad (más vencidas primero).
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

      const historialTasas = await this.obligacionesService.obtenerHistorialTasas();

      // 2.1) Congelar la mora de CADA obligación (sobre el capital pendiente ANTES de este
      // pago) antes de tocar ningún capital: si el capital de una obligación se salda por
      // completo más abajo, la mora ya devengada hasta hoy se perdería si no quedara
      // registrada primero (hallazgo RECAUDO-01 — antes la mora se mostraba pero nunca se
      // cobraba realmente).
      const moraPendientePorObligacion = new Map<string, number>();
      for (const obligacion of ordenAplicacion) {
        const pendiente = await this.obligacionesService.congelarMora(obligacion.id, historialTasas, manager);
        moraPendientePorObligacion.set(obligacion.id, pendiente);
      }

      // 2.2) Calcula el plan de aplicación (a qué obligación/concepto va cada peso, en orden
      // Canon → Novedad → Mora) con el MISMO método puro que usa `simularPago` para la
      // previsualización (sin cálculo espejo en el frontend: un solo lugar define esta regla).
      const { aplicaciones: plan, excedente } = this.calcularPlanAplicacion(
        ordenAplicacion,
        moraPendientePorObligacion,
        disponible,
      );

      // 2.3) Persistir cada abono del plan en su obligación real. Guarda también el desglose
      // (obligación + monto + concepto + saldo posterior) para permitir reverso preciso y para
      // que el recibo pueda mostrar la aplicación real del dinero (§20, hallazgo RECAUDO-03).
      const aplicaciones = plan;
      for (const item of plan) {
        if (item.concepto === ConceptoAplicacion.CAPITAL) {
          await this.obligacionesService.aplicarAbono(item.obligacionId, item.monto, manager);
        } else {
          await this.obligacionesService.aplicarAbonoMora(item.obligacionId, item.monto, manager);
        }
      }

      // 3) Descontar de los créditos de saldo a favor (FIFO) exactamente lo que se consumió
      // de ellos en el paso 2, antes de calcular el excedente remanente.
      const totalConsumido = valorTotalPago + saldoFavorDisponible - excedente;
      const consumidoDeSaldoFavor = Math.min(saldoFavorDisponible, totalConsumido);
      let restantePorDescontar = consumidoDeSaldoFavor;
      for (const credito of creditosDisponibles) {
        if (restantePorDescontar <= 0) break;
        const consumir = Math.min(restantePorDescontar, Number(credito.montoDisponible));
        credito.montoDisponible = Number(credito.montoDisponible) - consumir;
        await creditoRepo.save(credito);
        restantePorDescontar -= consumir;
      }

      // 4) Excedente remanente: por defecto se devuelve de inmediato como cambio (RDN-01 —
      // decisión de negocio: "lo mejor es devolver el dinero de inmediato, sea efectivo o
      // transferencia, como en cualquier lugar"); SOLO si el cliente pide expresamente dejar
      // un abono adelantado (`dejarExcedenteComoSaldoFavor`) se acumula como saldo a favor.
      // El crédito/movimiento que lo materializa se crea más abajo, una vez exista el recibo.
      const dejarComoSaldoFavor = dto.dejarExcedenteComoSaldoFavor === true;
      contrato.saldoAFavor = saldoFavorDisponible - consumidoDeSaldoFavor + (dejarComoSaldoFavor ? excedente : 0);
      await manager.save(contrato);

      // 5) Consecutivo atómico del recibo — se pasa el `manager` de esta transacción para que
      // el incremento del consecutivo haga rollback junto con el resto si algo falla después.
      const { formateado } = await this.consecutivoService.siguiente('RECIBO_CAJA', 'REC-', manager);

      const recibo = manager.create(ReciboCaja, {
        consecutivo: formateado,
        contrato,
        valorTotal: valorTotalPago,
        excedente,
        excedenteComoSaldoFavor: dejarComoSaldoFavor,
        estado: EstadoRecibo.EMITIDO,
        registradoPorEmail,
        detallesPago: dto.detallesPago.map((d) =>
          manager.create(DetallePago, { medioPago: d.medioPago, monto: d.monto, referencia: d.referencia ?? null }),
        ),
      });
      const guardado = await manager.save(recibo);

      // 5.1) Persistir la traza exacta de qué obligación recibió qué monto de este recibo,
      // y a qué concepto (CAPITAL o MORA) — necesario para revertir cada uno correctamente.
      const repoAplicacion = manager.getRepository(AplicacionPago);
      for (const a of aplicaciones) {
        await repoAplicacion.save(
          repoAplicacion.create({
            recibo: guardado,
            obligacion: { id: a.obligacionId } as any,
            montoAplicado: a.monto,
            concepto: a.concepto,
            saldoPosterior: a.saldoPosterior,
          }),
        );
      }

      // 5.2) Si quedó excedente y el cliente pidió dejarlo como abono adelantado, registrar el
      // crédito de saldo a favor ligado a ESTE recibo (AUD-006): es lo único que la anulación
      // de este recibo podrá revertir más adelante.
      if (excedente > 0 && dejarComoSaldoFavor) {
        await creditoRepo.save(
          creditoRepo.create({ contrato, recibo: guardado, montoOriginal: excedente, montoDisponible: excedente }),
        );
      }

      // 6) Movimiento(s) de caja tipo INGRESO, atado(s) al mismo recibo/contrato — UNO POR
      // CADA MEDIO DE PAGO recibido (hallazgo CAJA-01 de la auditoría): antes se registraba
      // un único movimiento por el total agregado, mezclando estructuralmente caja física
      // (efectivo) con control bancario (transferencias) en un pago mixto. Al dividir por
      // `detallesPago`, cada movimiento queda con su propio `medioPago` y `referencia`.
      for (const detalle of dto.detallesPago) {
        await this.movimientosService.registrarIngreso(
          {
            origen: OrigenMovimiento.RECAUDO,
            concepto: `Recaudo recibo ${formateado} — contrato ${contrato.id} (${detalle.medioPago})`,
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
      if (excedente > 0 && !dejarComoSaldoFavor) {
        const ultimoDetalle = dto.detallesPago[dto.detallesPago.length - 1];
        await this.movimientosService.registrarEgreso(
          {
            origen: OrigenMovimiento.RECAUDO,
            concepto: `Cambio entregado — recibo ${formateado}`,
            monto: excedente,
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
   * ÚNICO lugar donde vive la regla de aplicación del dinero (§10: Canon → Novedad → Mora).
   * Método puro (sin I/O, sin efectos secundarios): recibe las obligaciones ya ordenadas y la
   * mora ya calculada, y devuelve qué se aplicaría a cada una y cuánto sobra. Lo usan tanto
   * `registrarPago` (que persiste el resultado) como `simularPago` (que solo lo muestra) — así
   * la previsualización del frontend nunca puede desviarse del pago real: no hay una segunda
   * copia de esta lógica en ninguna otra parte (ni backend ni frontend).
   */
  private calcularPlanAplicacion(
    ordenAplicacion: Obligacion[],
    moraPendientePorObligacion: Map<string, number>,
    disponibleInicial: number,
  ): {
    aplicaciones: { obligacionId: string; monto: number; concepto: ConceptoAplicacion; saldoPosterior: number }[];
    excedente: number;
  } {
    let disponible = disponibleInicial;
    const aplicaciones: {
      obligacionId: string;
      monto: number;
      concepto: ConceptoAplicacion;
      saldoPosterior: number;
    }[] = [];

    // Primero CAPITAL, Canon íntegro antes que Novedad (§10).
    for (const obligacion of ordenAplicacion) {
      if (disponible <= 0) break;
      const saldoCapital = Number(obligacion.valorOriginal) - Number(obligacion.valorAbonado);
      if (saldoCapital <= 0) continue;

      const abono = Math.min(disponible, saldoCapital);
      aplicaciones.push({
        obligacionId: obligacion.id,
        monto: abono,
        concepto: ConceptoAplicacion.CAPITAL,
        saldoPosterior: saldoCapital - abono,
      });
      disponible -= abono;
    }

    // Con el remanente, MORA — mismo orden Canon → Novedad.
    for (const obligacion of ordenAplicacion) {
      if (disponible <= 0) break;
      const moraPendiente = moraPendientePorObligacion.get(obligacion.id) ?? 0;
      if (moraPendiente <= 0) continue;

      const abonoMora = Math.min(disponible, moraPendiente);
      aplicaciones.push({
        obligacionId: obligacion.id,
        monto: abonoMora,
        concepto: ConceptoAplicacion.MORA,
        saldoPosterior: moraPendiente - abonoMora,
      });
      disponible -= abonoMora;
    }

    return { aplicaciones, excedente: Math.max(0, disponible) };
  }

  /**
   * Previsualización de un recaudo — SOLO LECTURA, no aplica ningún abono, no crea recibo, no
   * mueve caja (§2 del módulo de Recibos: "la previsualización NO debe ejecutar la operación
   * financiera"). Usa `calcularPlanAplicacion`, el MISMO método que `registrarPago`, así que el
   * desglose que ve el cajero antes de confirmar es exactamente el que se va a persistir — no
   * una reconstrucción aproximada en el frontend.
   */
  async simularPago(dto: RegistrarPagoDto) {
    const valorTotalPago = dto.detallesPago.reduce((acc, d) => acc + d.monto, 0);
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
    const saldoFavorDisponible = Number(saldoFavorDisponibleRaw);

    // Mismas obligaciones pendientes que ve la ficha de recaudo, con la mora YA recalculada en
    // vivo (`ObligacionesService.pendientesPorContrato`) — sin necesidad de "congelarla" aquí,
    // porque una simulación nunca persiste nada.
    const obligacionesPendientes = await this.obligacionesService.pendientesPorContrato(contrato.id);
    const ordenAplicacion = [
      ...obligacionesPendientes.filter((o) => o.tipo === TipoObligacion.CANON),
      ...obligacionesPendientes.filter((o) => o.tipo === TipoObligacion.NOVEDAD),
    ];
    const moraPendientePorObligacion = new Map<string, number>();
    for (const o of ordenAplicacion) moraPendientePorObligacion.set(o.id, Number(o.valorMoraAcumulada));

    const disponibleInicial = valorTotalPago + saldoFavorDisponible;
    const { aplicaciones, excedente } = this.calcularPlanAplicacion(
      ordenAplicacion,
      moraPendientePorObligacion,
      disponibleInicial,
    );
    const dejarComoSaldoFavor = dto.dejarExcedenteComoSaldoFavor === true;

    return {
      contrato: { id: contrato.id, cliente: contrato.cliente, inmueble: contrato.inmueble },
      detallesPago: dto.detallesPago,
      valorTotalPago,
      saldoFavorDisponible,
      aplicaciones: aplicaciones.map((a) => ({
        ...a,
        obligacion: ordenAplicacion.find((o) => o.id === a.obligacionId),
      })),
      excedente,
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
    if (filtro.fechaHasta) qb.andWhere('r.creadoEn <= :hasta', { hasta: filtro.fechaHasta });
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

      // 1) Revertir cada aplicación exacta sobre su obligación de origen, distinguiendo
      // capital de mora (`concepto`) para revertir cada uno con el método correcto.
      const aplicacionRepo = manager.getRepository(AplicacionPago);
      const aplicaciones = await aplicacionRepo.find({ where: { recibo: { id } }, relations: ['obligacion'] });
      for (const aplicacion of aplicaciones) {
        if (aplicacion.concepto === ConceptoAplicacion.MORA) {
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

      // 2) Si este recibo había generado un crédito de saldo a favor, se revierte SOLO la
      // porción que sigue disponible (AUD-006): si ya fue consumida por un pago posterior
      // no relacionado, esa porción no se toca — el saldo a favor de recibos posteriores
      // nunca se ve afectado por la anulación de este.
      const contratoRepo = manager.getRepository(Contrato);
      const contrato = await contratoRepo
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: recibo.contrato.id })
        .getOneOrFail();
      const creditoRepo = manager.getRepository(SaldoFavorCredito);
      const credito = await creditoRepo.findOne({ where: { recibo: { id } } });
      if (credito && Number(credito.montoDisponible) > 0) {
        contrato.saldoAFavor = Math.max(0, Number(contrato.saldoAFavor) - Number(credito.montoDisponible));
        credito.montoDisponible = 0;
        await creditoRepo.save(credito);
        await contratoRepo.save(contrato);
      }

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
   * Liquidación del depósito en custodia al terminar contrato: genera un EGRESO por la
   * devolución neta (depósito - suma de descuentos), y persiste cada descuento por separado
   * con su propio concepto/valor (§19, hallazgo DEP-01 de la auditoría: antes solo se recibía
   * un número agregado, sin explicar en qué se descontó). El medio de pago de la devolución es
   * obligatorio cuando efectivamente queda saldo por devolver (mismo principio de CAJA-01: una
   * devolución en efectivo mueve caja física, una por transferencia mueve control bancario, y
   * nunca debe quedar "sin medio" cuando sí hubo movimiento de dinero real).
   */
  async liquidarDeposito(contratoId: string, dto: LiquidarDepositoDto, registradoPorEmail: string) {
    return this.dataSource.transaction(async (manager) => {
      const contrato = await manager
        .createQueryBuilder(Contrato, 'c')
        .setLock('pessimistic_write')
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
      const valorDescuentos = descuentos.reduce((acc, d) => acc + d.valor, 0);
      const valorDevolucion = Math.max(0, Number(contrato.depositoCustodia) - valorDescuentos);

      if (valorDevolucion > 0) {
        if (!dto.medioPago) {
          throw new BadRequestException('Debe indicar el medio de pago (efectivo/transferencia) de la devolución.');
        }
        await this.movimientosService.registrarEgreso(
          {
            origen: OrigenMovimiento.DEPOSITO,
            concepto: `Devolución depósito en custodia — contrato ${contrato.id}. ${dto.observaciones ?? ''}`.trim(),
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
          repoDescuento.create({ contrato, concepto: descuento.concepto, valor: descuento.valor, registradoPorEmail }),
        );
      }

      contrato.depositoCustodia = 0;
      contrato.depositoLiquidadoEn = new Date();
      await manager.save(contrato);

      return { contratoId, valorDevuelto: valorDevolucion, valorDescontado: valorDescuentos, descuentos };
    });
  }

  /** Contratos TERMINADOS con depósito en custodia aún sin liquidar — pantalla Depósitos. */
  async depositosPendientes(page?: string | number, limit?: string | number) {
    const qb = this.contratoRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.cliente', 'cliente')
      .leftJoinAndSelect('c.inmueble', 'inmueble')
      .where('c.estado = :estado', { estado: EstadoContrato.TERMINADO })
      .andWhere('c.depositoLiquidadoEn IS NULL')
      .andWhere('c.depositoCustodia > 0')
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
