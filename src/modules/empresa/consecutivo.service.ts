import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Consecutivo } from './entities/consecutivo.entity';

export interface CrearConsecutivoDto {
  tipo: string;
  prefijo?: string;
  ultimoNumero?: number;
}

/**
 * Servicio de consecutivos atómicos.
 * Usa una transacción + SELECT ... FOR UPDATE (bloqueo pesimista) sobre la fila
 * del tipo de documento solicitado, garantizando que dos solicitudes concurrentes
 * NUNCA obtengan el mismo número, incluso bajo alta concurrencia de recaudo.
 */
@Injectable()
export class ConsecutivoService {
  constructor(private readonly dataSource: DataSource) {}

  async listar(): Promise<Consecutivo[]> {
    return this.dataSource.getRepository(Consecutivo).find({ order: { tipo: 'ASC' } });
  }

  async guardar(dto: CrearConsecutivoDto): Promise<Consecutivo> {
    const repo = this.dataSource.getRepository(Consecutivo);
    const existente = await repo.findOne({ where: { tipo: dto.tipo } });

    const ultimoNumero = Number(dto.ultimoNumero ?? existente?.ultimoNumero ?? 0);

    if (existente) {
      Object.assign(existente, {
        prefijo: dto.prefijo ?? existente.prefijo,
        ultimoNumero,
      });
      return repo.save(existente);
    }

    return repo.save(
      repo.create({
        tipo: dto.tipo,
        prefijo: dto.prefijo ?? '',
        ultimoNumero,
      }),
    );
  }

  /**
   * Obtiene el siguiente número formateado (ej: "REC-000123") para el tipo dado.
   * Si el tipo no existe, lo crea en la misma transacción.
   *
   * Si el llamador ya está dentro de una transacción (ej: `RecaudoService.registrarPago`),
   * debe pasar su `manager` para que el incremento del consecutivo participe de esa misma
   * transacción — de lo contrario el número queda confirmado en BD antes que el documento
   * que lo consume, y un fallo posterior en el llamador deja un hueco permanente en la
   * numeración (el consecutivo ya se gastó pero el documento nunca llegó a existir).
   */
  async siguiente(
    tipo: string,
    prefijoPorDefecto = '',
    manager?: EntityManager,
  ): Promise<{ numero: number; formateado: string }> {
    const ejecutar = async (m: EntityManager) => {
      const repo = m.getRepository(Consecutivo);

      let consecutivo = await repo
        .createQueryBuilder('c')
        .setLock('pessimistic_write') // SELECT ... FOR UPDATE
        .where('c.tipo = :tipo', { tipo })
        .getOne();

      if (!consecutivo) {
        consecutivo = repo.create({ tipo, prefijo: prefijoPorDefecto, ultimoNumero: 0 });
        await repo.save(consecutivo);
        consecutivo = await repo
          .createQueryBuilder('c')
          .setLock('pessimistic_write')
          .where('c.tipo = :tipo', { tipo })
          .getOneOrFail();
      }

      consecutivo.ultimoNumero = Number(consecutivo.ultimoNumero) + 1;
      await repo.save(consecutivo);

      const numero = Number(consecutivo.ultimoNumero);
      const formateado = `${consecutivo.prefijo}${String(numero).padStart(6, '0')}`;
      return { numero, formateado };
    };

    if (manager) return ejecutar(manager);
    return this.dataSource.transaction(ejecutar);
  }

  async obtenerPorTipo(tipo: string): Promise<Consecutivo> {
    const repo = this.dataSource.getRepository(Consecutivo);
    const consecutivo = await repo.findOne({ where: { tipo } });
    if (!consecutivo) throw new NotFoundException(`Consecutivo tipo '${tipo}' no configurado.`);
    return consecutivo;
  }
}
