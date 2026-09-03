import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistroAuditoria } from './entities/registro-auditoria.entity';
import { paginar } from '../../common/utils/paginar.util';
import { finDelDiaLocal } from '../../common/utils/fecha.util';

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
    const qb = this.repo.createQueryBuilder('a');
    if (filtro.modulo) qb.andWhere('a.modulo = :modulo', { modulo: filtro.modulo });
    if (filtro.usuarioEmail) qb.andWhere('a.usuarioEmail = :email', { email: filtro.usuarioEmail });
    if (filtro.desde) qb.andWhere('a.creadoEn >= :desde', { desde: filtro.desde });
    if (filtro.hasta) {
      // `hasta` llega sin hora ("YYYY-MM-DD"); contra una columna datetime hay que subir el
      // límite al último instante del día o se excluye casi todo el propio día pedido (AUD-021).
      qb.andWhere('a.creadoEn <= :hasta', { hasta: finDelDiaLocal(filtro.hasta) });
    }

    // `paginar` acota `page`/`limit` (no numéricos → valores seguros; `limit` con techo de 100):
    // este endpoint recibía `page`/`limit` como `@Query()` sueltos sin `ValidationPipe`, así que
    // `?limit=999999` traía todo y `?limit=abc` producía `.take(NaN)`.
    return paginar(qb.orderBy('a.creadoEn', 'DESC'), filtro.page, filtro.limit, 20);
  }
}
