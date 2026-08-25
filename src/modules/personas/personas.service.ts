import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { Codeudor } from './entities/codeudor.entity';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import { BuscarPersonaDto } from './dto/buscar-persona.dto';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { paginar } from '../../common/utils/paginar.util';

/**
 * Servicio genérico reutilizado por Clientes y Codeudores (mismo comportamiento
 * de directorio, entidades TypeORM distintas). Se instancia dos veces desde el módulo.
 */
class PersonasServiceBase<T extends { id: string; numeroDocumento: string; activo: boolean }> {
  constructor(private readonly repo: Repository<T>, private readonly etiqueta: string) {}

  async crear(dto: CreatePersonaDto): Promise<T> {
    const existe = await this.repo.findOne({ where: { numeroDocumento: dto.numeroDocumento } as any });
    if (existe) throw new ConflictException(`Ya existe un ${this.etiqueta} con ese número de documento.`);
    const entidad = this.repo.create({ ...dto, tipoDocumento: dto.tipoDocumento ?? 'CC' } as any);
    return this.repo.save(entidad as any);
  }

  async buscar(filtro: BuscarPersonaDto): Promise<T[]> {
    const qb = this.repo.createQueryBuilder('p').where('p.activo = true');
    if (filtro.documento && filtro.nombre) {
      qb.andWhere('(p.numeroDocumento LIKE :doc OR p.nombreCompleto LIKE :nombre)', {
        doc: `%${filtro.documento}%`,
        nombre: `%${filtro.nombre}%`,
      });
    } else if (filtro.documento) {
      qb.andWhere('p.numeroDocumento LIKE :doc', { doc: `%${filtro.documento}%` });
    } else if (filtro.nombre) {
      qb.andWhere('p.nombreCompleto LIKE :nombre', { nombre: `%${filtro.nombre}%` });
    }
    return qb.orderBy('p.nombreCompleto', 'ASC').limit(20).getMany();
  }

  /** Listado paginado del directorio completo (AUD-034; antes traía todas las filas sin límite). */
  listar(filtro: PaginacionDto) {
    const qb = this.repo.createQueryBuilder('p').orderBy('p.nombreCompleto', 'ASC');
    return paginar(qb, filtro.page, filtro.limit);
  }

  async obtener(id: string): Promise<T> {
    const entidad = await this.repo.findOne({ where: { id } as any });
    if (!entidad) throw new NotFoundException(`${this.etiqueta} no encontrado.`);
    return entidad;
  }

  async actualizar(id: string, dto: UpdatePersonaDto): Promise<T> {
    const entidad = await this.obtener(id);
    if (dto.numeroDocumento && dto.numeroDocumento !== (entidad as any).numeroDocumento) {
      const existe = await this.repo.findOne({ where: { numeroDocumento: dto.numeroDocumento } as any });
      if (existe && (existe as any).id !== id) {
        throw new ConflictException(`Ya existe un ${this.etiqueta} con ese número de documento.`);
      }
    }
    Object.assign(entidad as any, dto);
    return this.repo.save(entidad as any);
  }
}

@Injectable()
export class ClientesService extends PersonasServiceBase<Cliente> {
  constructor(@InjectRepository(Cliente) repo: Repository<Cliente>) {
    super(repo, 'cliente');
  }
}

@Injectable()
export class CodeudoresService extends PersonasServiceBase<Codeudor> {
  constructor(@InjectRepository(Codeudor) repo: Repository<Codeudor>) {
    super(repo, 'codeudor');
  }
}
