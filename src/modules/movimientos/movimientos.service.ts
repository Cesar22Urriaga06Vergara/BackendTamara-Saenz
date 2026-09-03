import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Movimiento, OrigenMovimiento, TipoMovimiento } from './entities/movimiento.entity';
import { Novedad } from '../novedades/entities/novedad.entity';
import { Contrato } from '../contratos/entities/contrato.entity';
import { DescuentoDeposito } from '../recaudo/entities/descuento-deposito.entity';
import { ReciboCaja, EstadoRecibo } from '../recaudo/entities/recibo-caja.entity';
import { AplicacionPago } from '../recaudo/entities/aplicacion-pago.entity';
import { ConsecutivoService } from '../empresa/consecutivo.service';
import { ObligacionesService } from '../obligaciones/obligaciones.service';
import { paginar } from '../../common/utils/paginar.util';
import { finDelDiaLocal } from '../../common/utils/fecha.util';
import { MedioPago } from '../../common/enums/medio-pago.enum';

export interface RegistrarMovimientoInput {
  tipo: TipoMovimiento;
  origen: OrigenMovimiento;
  concepto: string;
  monto: number;
  registradoPorEmail: string;
  reciboId?: string;
  novedadId?: string;
  contratoId?: string;
  /** EFECTIVO/TRANSFERENCIA; se deja sin definir cuando el origen todavía no lo captura (ver NOV-01/DEP-01). */
  medioPago?: MedioPago | null;
  referencia?: string | null;
}

@Injectable()
export class MovimientosService {
  constructor(
    @InjectRepository(Movimiento) private readonly repo: Repository<Movimiento>,
    private readonly consecutivoService: ConsecutivoService,
    private readonly obligacionesService: ObligacionesService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Registra un movimiento. Puede recibir un EntityManager de una transacción externa
   * (ej: al confirmar un recibo de caja) para garantizar atomicidad entre módulos.
   *
   * Los movimientos tipo EGRESO reciben un consecutivo atómico propio ("EGR-000045"),
   * obtenido dentro del mismo `manager` cuando se provee, para que el número quede
   * ligado al documento (ver AUD-004/AUD-016).
   */
  async registrar(input: RegistrarMovimientoInput, manager?: EntityManager): Promise<Movimiento> {
    const repo = manager ? manager.getRepository(Movimiento) : this.repo;

    let consecutivo: string | null = null;
    if (input.tipo === TipoMovimiento.EGRESO) {
      const resultado = await this.consecutivoService.siguiente('EGRESO', 'EGR-', manager);
      consecutivo = resultado.formateado;
    }

    const movimiento = repo.create({
      tipo: input.tipo,
      origen: input.origen,
      consecutivo,
      concepto: input.concepto,
      monto: input.monto,
      registradoPorEmail: input.registradoPorEmail,
      reciboId: input.reciboId ?? null,
      novedadId: input.novedadId ?? null,
      contratoId: input.contratoId ?? null,
      medioPago: input.medioPago ?? null,
      referencia: input.referencia ?? null,
      esReverso: false,
      movimientoOriginalId: null,
    });
    return repo.save(movimiento);
  }

  registrarIngreso(input: Omit<RegistrarMovimientoInput, 'tipo'>, manager?: EntityManager) {
    return this.registrar({ ...input, tipo: TipoMovimiento.INGRESO }, manager);
  }

  registrarEgreso(input: Omit<RegistrarMovimientoInput, 'tipo'>, manager?: EntityManager) {
    return this.registrar({ ...input, tipo: TipoMovimiento.EGRESO }, manager);
  }

  /**
   * Reverso de un movimiento (ej: anulación de recibo). NUNCA se hace DELETE:
   * se crea un movimiento de signo contrario referenciando al original.
   *
   * Acepta opcionalmente el `manager` de una transacción externa (ej: `RecaudoService.anular`)
   * para que el reverso participe de la misma transacción que revierte las obligaciones
   * asociadas — de lo contrario ambas operaciones podrían quedar parcialmente aplicadas
   * si el proceso falla entre una y otra.
   */
  async reversar(
    movimientoId: string,
    motivo: string,
    registradoPorEmail: string,
    manager?: EntityManager,
  ): Promise<Movimiento> {
    const repo = manager ? manager.getRepository(Movimiento) : this.repo;
    const original = await repo.findOne({ where: { id: movimientoId } });
    if (!original) throw new NotFoundException('Movimiento original no encontrado.');

    const tipoContrario = original.tipo === TipoMovimiento.INGRESO ? TipoMovimiento.EGRESO : TipoMovimiento.INGRESO;

    let consecutivo: string | null = null;
    if (tipoContrario === TipoMovimiento.EGRESO) {
      const resultado = await this.consecutivoService.siguiente('EGRESO', 'EGR-', manager);
      consecutivo = resultado.formateado;
    }

    const reverso = repo.create({
      tipo: tipoContrario,
      origen: original.origen,
      consecutivo,
      concepto: `REVERSO: ${motivo} (ref. ${original.concepto})`,
      monto: original.monto,
      registradoPorEmail,
      reciboId: original.reciboId,
      novedadId: original.novedadId,
      contratoId: original.contratoId,
      // El reverso conserva el medio del original: revertir un ingreso en EFECTIVO debe
      // disminuir caja física, y uno por TRANSFERENCIA debe disminuir el control bancario
      // (§16 de la especificación) — nunca el medio contrario ni "sin medio".
      medioPago: original.medioPago,
      referencia: original.referencia,
      esReverso: true,
      movimientoOriginalId: original.id,
    });
    return repo.save(reverso);
  }

  /**
   * Reverso manual disparado por el Administrador desde `/movimientos` para movimientos que
   * no tienen un flujo de corrección propio en otro módulo (origen NOVEDAD o DEPOSITO). Los
   * movimientos de origen RECAUDO se corrigen exclusivamente anulando el recibo asociado
   * (`PATCH /recaudo/recibos/:id/anular`), nunca desde aquí, para no saltarse la reversión
   * de las obligaciones/aplicaciones de pago que ese flujo sí ejecuta.
   *
   * Envuelto en transacción con bloqueo pesimista sobre el movimiento original: es el mismo
   * patrón usado en `RecaudoService.anular()`. Sin este lock, dos solicitudes de reverso
   * concurrentes sobre el mismo movimiento podían pasar ambas la verificación de "no
   * reversado" antes de que cualquiera insertara su reverso, duplicando el impacto en caja
   * (hallazgo CONC-02 de la auditoría). El `manager` se propaga a `reversar()`, que a su vez
   * lo pasa al consecutivo — evita también el hueco de numeración de CONC-03.
   */
  async reversarManual(movimientoId: string, motivo: string, registradoPorEmail: string): Promise<Movimiento> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Movimiento);
      const original = await repo
        .createQueryBuilder('m')
        .setLock('pessimistic_write')
        .where('m.id = :id', { id: movimientoId })
        .getOne();
      if (!original) throw new NotFoundException('Movimiento no encontrado.');
      if (original.origen === OrigenMovimiento.RECAUDO) {
        throw new BadRequestException(
          'Los movimientos de origen RECAUDO se corrigen anulando el recibo asociado (PATCH /recaudo/recibos/:id/anular), no directamente aquí.',
        );
      }
      if (original.esReverso) {
        throw new BadRequestException('No es posible reversar un movimiento que ya es, en sí mismo, un reverso.');
      }
      const yaReversado = await repo.findOne({ where: { movimientoOriginalId: movimientoId } });
      if (yaReversado) {
        throw new BadRequestException('Este movimiento ya fue reversado previamente.');
      }

      const reverso = await this.reversar(movimientoId, motivo, registradoPorEmail, manager);

      // El contra-asiento por sí solo no basta: hay que devolver la ENTIDAD DE ORIGEN a su
      // estado previo, o el sistema queda inconsistente (el gasto de novedad sigue "pagado" y
      // no se puede volver a pagar; el depósito sigue "liquidado" con el dinero de vuelta en
      // el libro) — hallazgo A2-a.
      await this.revertirEntidadDeOrigen(original, manager);

      return reverso;
    });
  }

  private async revertirEntidadDeOrigen(original: Movimiento, manager: EntityManager): Promise<void> {
    if (original.origen === OrigenMovimiento.NOVEDAD && original.novedadId) {
      const novedadRepo = manager.getRepository(Novedad);
      const novedad = await novedadRepo
        .createQueryBuilder('n')
        .setLock('pessimistic_write')
        .where('n.id = :id', { id: original.novedadId })
        .getOne();
      if (novedad?.gastoPagado) {
        novedad.gastoPagado = false;
        novedad.medioPagoGasto = null;
        novedad.referenciaPagoGasto = null;
        novedad.fechaPagoGasto = null;
        novedad.pagadoPorEmail = null;
        await novedadRepo.save(novedad);
      }
      return;
    }

    if (original.origen === OrigenMovimiento.DEPOSITO && original.contratoId) {
      const contratoRepo = manager.getRepository(Contrato);
      const contrato = await contratoRepo
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: original.contratoId })
        .getOne();
      if (!contrato || !contrato.depositoLiquidadoEn) return;

      const descuentoRepo = manager.getRepository(DescuentoDeposito);
      const descuentos = await descuentoRepo.find({ where: { contrato: { id: contrato.id } } });
      const totalDescuentos = descuentos.reduce((acc, d) => acc + Number(d.valor), 0);

      // El depósito original = lo que se devolvió (monto del movimiento) + lo que se descontó.
      contrato.depositoGarantia = Number(original.monto) + totalDescuentos;
      contrato.depositoLiquidadoEn = null;
      await contratoRepo.save(contrato);

      // Si hubo descuento tipo DEUDA, se generó un recibo interno que abonó obligaciones —
      // hay que revertir esos abonos y anular el recibo, o la deuda quedaría "pagada" con un
      // depósito que ya no se liquidó (hallazgo LB-6 / F14).
      const reciboRepo = manager.getRepository(ReciboCaja);
      const reciboInterno = await reciboRepo
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.contratoId = :id', { id: contrato.id })
        .andWhere('r.esLiquidacionDeposito = TRUE')
        .andWhere('r.estado = :estado', { estado: EstadoRecibo.EMITIDO })
        .getOne();
      if (reciboInterno) {
        const aplicacionRepo = manager.getRepository(AplicacionPago);
        const aplicaciones = await aplicacionRepo.find({
          where: { recibo: { id: reciboInterno.id } },
          relations: ['obligacion'],
        });
        for (const a of aplicaciones) {
          if ((a.concepto as string) === 'MORA') {
            await this.obligacionesService.revertirAbonoMora(a.obligacion.id, Number(a.montoAplicado), manager);
          } else {
            await this.obligacionesService.revertirAbono(a.obligacion.id, Number(a.montoAplicado), manager);
          }
        }
        reciboInterno.estado = EstadoRecibo.ANULADO;
        reciboInterno.motivoAnulacion = `Liquidación de depósito reversada: ${original.concepto}`;
        await reciboRepo.save(reciboInterno);
      }

      // Los descuentos de esa liquidación dejan de tener efecto (la liquidación se deshizo).
      if (descuentos.length) await descuentoRepo.remove(descuentos);
    }
  }

  async listar(filtro: {
    tipo?: TipoMovimiento;
    origen?: OrigenMovimiento;
    medioPago?: MedioPago;
    desde?: string;
    hasta?: string;
    page?: string;
    limit?: string;
  }) {
    const qb = this.repo.createQueryBuilder('m');
    if (filtro.tipo) qb.andWhere('m.tipo = :tipo', { tipo: filtro.tipo });
    if (filtro.origen) qb.andWhere('m.origen = :origen', { origen: filtro.origen });
    if (filtro.medioPago) qb.andWhere('m.medioPago = :medioPago', { medioPago: filtro.medioPago });
    if (filtro.desde) qb.andWhere('m.creadoEn >= :desde', { desde: filtro.desde });
    // `hasta` sin hora ("YYYY-MM-DD") contra `creadoEn` datetime: subir al último instante del
    // día o se excluye casi todo el propio día pedido (misma clase de bug que AUD-021).
    if (filtro.hasta) qb.andWhere('m.creadoEn <= :hasta', { hasta: finDelDiaLocal(filtro.hasta) });
    qb.orderBy('m.creadoEn', 'DESC');
    return paginar(qb, filtro.page, filtro.limit);
  }

  /**
   * Búsqueda interna (no paginada) de los movimientos de INGRESO originales asociados a un
   * recibo — usado al anular. Un recibo con pago mixto genera UN movimiento por cada medio
   * de pago (ver `RecaudoService.registrarPago`, hallazgo CAJA-01), por lo que puede haber
   * más de uno; todos deben revertirse, nunca solo el primero.
   */
  async buscarOriginalesPorRecibo(reciboId: string, manager?: EntityManager): Promise<Movimiento[]> {
    const repo = manager ? manager.getRepository(Movimiento) : this.repo;
    return repo.find({ where: { reciboId, esReverso: false } });
  }

  /**
   * Saldo neto total (recaudo total, §14.3 de la especificación: efectivo + transferencias).
   * NO debe presentarse como "caja física" — para eso usar `saldoPorMedio().efectivo`.
   */
  async saldoNeto(): Promise<number> {
    return this.sumarMovimientos();
  }

  /**
   * Desglosa el saldo neto por medio de pago (hallazgo CAJA-01 de la auditoría):
   * - `efectivo`: caja física real (§15) — solo movimientos con medioPago=EFECTIVO.
   * - `transferencia`: control bancario (§14.2) — solo medioPago=TRANSFERENCIA.
   * - `sinMedio`: movimientos de orígenes que aún no capturan el medio real (NOVEDAD/DEPOSITO,
   *   ver NOV-01/DEP-01) — se reporta aparte en vez de mezclarse en cualquiera de los dos
   *   anteriores, para no subestimar ni sobrestimar caja física por un dato ausente.
   */
  async saldoPorMedio(): Promise<{ efectivo: number; transferencia: number; sinMedio: number; total: number }> {
    const [efectivo, transferencia, sinMedio] = await Promise.all([
      this.sumarMovimientos(MedioPago.EFECTIVO),
      this.sumarMovimientos(MedioPago.TRANSFERENCIA),
      this.sumarMovimientos(null),
    ]);
    return { efectivo, transferencia, sinMedio, total: efectivo + transferencia + sinMedio };
  }

  /**
   * Desglosa los movimientos en EFECTIVO en las tres partidas que pide el módulo de Caja
   * (§15): ingresos, egresos "genuinos" (gastos/pagos reales) y devoluciones (reversos de un
   * ingreso — ej. anular un recibo cobrado en efectivo). Ambos egresos y devoluciones restan
   * de la caja física, pero la especificación los controla como partidas separadas.
   */
  async desgloseEfectivo(): Promise<{ ingresos: number; egresos: number; devoluciones: number }> {
    const [ingresos, egresos, devoluciones] = await Promise.all([
      this.sumarEfectivoPorTipoYReverso(TipoMovimiento.INGRESO),
      this.sumarEfectivoPorTipoYReverso(TipoMovimiento.EGRESO, false),
      this.sumarEfectivoPorTipoYReverso(TipoMovimiento.EGRESO, true),
    ]);
    return { ingresos, egresos, devoluciones };
  }

  private async sumarEfectivoPorTipoYReverso(tipo: TipoMovimiento, esReverso?: boolean): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.monto), 0)', 'total')
      .where('m.medioPago = :medioPago', { medioPago: MedioPago.EFECTIVO })
      .andWhere('m.tipo = :tipo', { tipo });
    if (esReverso !== undefined) qb.andWhere('m.esReverso = :esReverso', { esReverso });
    const { total } = await qb.getRawOne();
    return Number(total ?? 0);
  }

  /** `medioPago` undefined = sin filtrar (todos); `null` = solo movimientos sin medio identificado. */
  private async sumarMovimientos(medioPago?: MedioPago | null): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('m')
      .select('SUM(CASE WHEN m.tipo = :ingreso THEN m.monto ELSE -m.monto END)', 'total')
      .setParameters({ ingreso: TipoMovimiento.INGRESO });
    if (medioPago === null) {
      qb.andWhere('m.medioPago IS NULL');
    } else if (medioPago !== undefined) {
      qb.andWhere('m.medioPago = :medioPago', { medioPago });
    }
    const { total } = await qb.getRawOne();
    return Number(total ?? 0);
  }
}
