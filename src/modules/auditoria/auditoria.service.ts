import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistroAuditoria } from './entities/registro-auditoria.entity';

export interface RegistrarAuditoriaInput {
  modulo: string;
  accion: string;
  usuarioEmail: string;
  metodoHttp: string;
  ruta: string;
  duracionMs: number;
  ipOrigen?: string;
}

@Injectable()
export class AuditoriaService {
  constructor(@InjectRepository(RegistroAuditoria) private readonly repo: Repository<RegistroAuditoria>) {}

  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    await this.repo.save(this.repo.create({ ...input, ipOrigen: input.ipOrigen ?? null }));
  }

  async listar(filtro: {
    modulo?: string;
    usuarioEmail?: string;
    desde?: string;
    hasta?: string;
    page?: string;
    limit?: string;
  }) {
    const page = Number(filtro.page ?? 1);
    const limit = Number(filtro.limit ?? 20);

    const qb = this.repo.createQueryBuilder('a');
    if (filtro.modulo) qb.andWhere('a.modulo = :modulo', { modulo: filtro.modulo });
    if (filtro.usuarioEmail) qb.andWhere('a.usuarioEmail = :email', { email: filtro.usuarioEmail });
    if (filtro.desde) qb.andWhere('a.creadoEn >= :desde', { desde: filtro.desde });
    if (filtro.hasta) {
      // `hasta` llega como fecha sin hora ("YYYY-MM-DD"); comparar directamente contra una
      // columna datetime excluía casi todos los registros del propio día límite (AUD-021).
      //
      // La corrección original de AUD-021 usaba `new Date(filtro.hasta)` (que ECMA-262
      // interpreta como medianoche UTC) y luego `.setHours(23,59,59,999)` (que opera en hora
      // LOCAL): en una zona horaria negativa como Bogotá (UTC-5), la medianoche UTC ya cae en
      // el día calendario ANTERIOR al convertirse a componentes locales, así que `setHours`
      // fijaba el límite alrededor de las 04:59 UTC del día correcto — excluyendo en la
      // práctica casi todo el día que se pedía incluir (mismo mecanismo del hallazgo MORA-01).
      // Se construyen los componentes Y-M-D directamente en hora local, sin pasar por el
      // parseo ISO-UTC del constructor `Date`, igual que `ObligacionesService.fechaLocalDesdeColumnaDate`.
      const [anio, mes, dia] = filtro.hasta.split('-').map(Number);
      const hastaFinDelDia = new Date(anio, mes - 1, dia, 23, 59, 59, 999);
      qb.andWhere('a.creadoEn <= :hasta', { hasta: hastaFinDelDia });
    }

    qb.orderBy('a.creadoEn', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
