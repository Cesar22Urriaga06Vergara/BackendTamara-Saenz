import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contrato, EstadoContrato } from '../contratos/entities/contrato.entity';
import { ObligacionesService } from '../obligaciones/obligaciones.service';
import { Novedad, EstadoNovedad } from '../novedades/entities/novedad.entity';
import { ReciboCaja, EstadoRecibo } from '../recaudo/entities/recibo-caja.entity';

/**
 * Métricas gerenciales y operativas consolidadas.
 * Los campos financieros (cartera, recaudo) viven en un endpoint separado
 * (`GET /dashboard/financiero`, `@Roles(Rol.ADMINISTRADOR)`) — no se mezclan
 * con las métricas operativas de `GET /dashboard`, abierto a cualquier rol.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Contrato) private readonly contratoRepo: Repository<Contrato>,
    @InjectRepository(Novedad) private readonly novedadRepo: Repository<Novedad>,
    @InjectRepository(ReciboCaja) private readonly reciboRepo: Repository<ReciboCaja>,
    private readonly obligacionesService: ObligacionesService,
  ) {}

  /** Métricas visibles para cualquier rol autenticado (sin cifras de dinero). */
  async metricasOperativas() {
    const [contratosActivos, novedadesAbiertas] = await Promise.all([
      this.contratoRepo.count({ where: { estado: EstadoContrato.ACTIVO } }),
      this.novedadRepo.count({ where: [{ estado: EstadoNovedad.ABIERTA }, { estado: EstadoNovedad.EN_SEGUIMIENTO }] }),
    ]);
    return { contratosActivos, novedadesAbiertas };
  }

  /** Métricas financieras — EXCLUSIVO Administrador (se valida en el controlador vía @Roles). */
  async metricasFinancieras() {
    // Misma fuente de verdad que el reporte de cartera y la pantalla Cartera: capital VENCIDO
    // por cobrar (PENDIENTE/PARCIAL con `fechaVencimiento` ya pasada). Sin costo de mora —
    // retirado por decisión de negocio el 2026-09-01.
    const obligacionesVencidas = await this.obligacionesService.todasPendientes();
    const carteraTotal = obligacionesVencidas.reduce((acc, o) => acc + (o.valorOriginal - o.valorAbonado), 0);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    // Recaudo NETO del mes: total recibido menos el excedente que se devolvió como cambio
    // (ese dinero salió de nuevo, no es ingreso). El excedente dejado como saldo a favor SÍ
    // cuenta — es dinero que quedó en el sistema. Se excluyen los recibos de liquidación de
    // depósito (`esLiquidacionDeposito`, hallazgo B4 de la auditoría contable 2026-09-01): no
    // representan efectivo/transferencia recibido este mes — el depósito ya estaba registrado
    // desde que se firmó el contrato — así que inflaban "recaudo del mes" sin respaldo en caja.
    const { total: recaudoMesActual } = await this.reciboRepo
      .createQueryBuilder('r')
      .select('SUM(r.valorTotal - CASE WHEN r.excedenteComoSaldoFavor = 0 THEN r.excedente ELSE 0 END)', 'total')
      .where('r.estado = :estado', { estado: EstadoRecibo.EMITIDO })
      .andWhere('r.esLiquidacionDeposito = false')
      .andWhere('r.creadoEn >= :inicioMes', { inicioMes })
      .getRawOne();

    return {
      carteraTotal: Math.round(carteraTotal * 100) / 100,
      recaudoMesActual: Number(recaudoMesActual ?? 0),
    };
  }
}
