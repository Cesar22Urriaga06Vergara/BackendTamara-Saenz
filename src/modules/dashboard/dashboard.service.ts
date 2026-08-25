import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contrato, EstadoContrato } from '../contratos/entities/contrato.entity';
import { Obligacion, EstadoObligacion } from '../obligaciones/entities/obligacion.entity';
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
    @InjectRepository(Obligacion) private readonly obligacionRepo: Repository<Obligacion>,
    @InjectRepository(Novedad) private readonly novedadRepo: Repository<Novedad>,
    @InjectRepository(ReciboCaja) private readonly reciboRepo: Repository<ReciboCaja>,
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
    const { total: carteraTotal } = await this.obligacionRepo
      .createQueryBuilder('o')
      .select('SUM(o.valorOriginal - o.valorAbonado)', 'total')
      .where('o.estado IN (:...estados)', { estados: [EstadoObligacion.PENDIENTE, EstadoObligacion.PARCIAL] })
      .getRawOne();

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { total: recaudoMesActual } = await this.reciboRepo
      .createQueryBuilder('r')
      .select('SUM(r.valorTotal)', 'total')
      .where('r.estado = :estado', { estado: EstadoRecibo.EMITIDO })
      .andWhere('r.creadoEn >= :inicioMes', { inicioMes })
      .getRawOne();

    return {
      carteraTotal: Number(carteraTotal ?? 0),
      recaudoMesActual: Number(recaudoMesActual ?? 0),
    };
  }
}
