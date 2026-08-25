import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Inmueble, EstadoInmueble } from './entities/inmueble.entity';
import { Propietario } from '../propietarios/entities/propietario.entity';
import { CreateInmuebleDto } from './dto/create-inmueble.dto';
import { UpdateInmuebleDto } from './dto/update-inmueble.dto';
import { FilterInmuebleDto } from './dto/filter-inmueble.dto';
import { ConsecutivoService } from '../empresa/consecutivo.service';
import { Contrato, EstadoContrato } from '../contratos/entities/contrato.entity';
import { Rol } from '../../common/enums/roles.enum';
import { paginar } from '../../common/utils/paginar.util';

@Injectable()
export class InmueblesService {
  constructor(
    @InjectRepository(Inmueble) private readonly repo: Repository<Inmueble>,
    private readonly dataSource: DataSource,
    private readonly consecutivoService: ConsecutivoService,
  ) {}

  crear(dto: CreateInmuebleDto): Promise<Inmueble> {
    return this.dataSource.transaction(async (manager) => {
      const { propietarioId, ...resto } = dto;
      const propietario = await this.resolverPropietario(manager, propietarioId);

      // Consecutivo atómico ("INM-000001"), obtenido dentro de esta misma transacción
      // para que quede ligado al inmueble (mismo patrón que recibos/novedades, ver AUD-004).
      const { formateado } = await this.consecutivoService.siguiente('INMUEBLE', 'INM-', manager);
      const inmueble = manager.create(Inmueble, { ...resto, propietario, consecutivo: formateado });
      return manager.save(inmueble);
    });
  }

  /**
   * Resuelve el propietario del inmueble (§4 de la especificación): si no se especifica uno
   * explícito, cae por defecto al propietario especial "INMOBILIARIA" — nunca deja un inmueble
   * sin propietario (hallazgo PROP-01 de la auditoría: la entidad Propietario no existía).
   */
  private async resolverPropietario(manager: EntityManager, propietarioId?: string): Promise<Propietario> {
    const repo = manager.getRepository(Propietario);
    if (propietarioId) {
      const propietario = await repo.findOne({ where: { id: propietarioId } });
      if (!propietario) throw new NotFoundException('Propietario no encontrado.');
      return propietario;
    }
    const inmobiliaria = await repo.findOne({ where: { esInmobiliaria: true } });
    if (!inmobiliaria) {
      throw new NotFoundException(
        'No existe el propietario especial "INMOBILIARIA". Verifique que la migración semilla se haya ejecutado.',
      );
    }
    return inmobiliaria;
  }

  private construirQueryListado(filtro: FilterInmuebleDto) {
    const qb = this.repo.createQueryBuilder('i').leftJoinAndSelect('i.propietario', 'propietario');

    if (filtro.busqueda) {
      qb.andWhere('(i.direccion LIKE :b OR i.barrio LIKE :b)', { b: `%${filtro.busqueda}%` });
    }
    if (filtro.barrio) {
      qb.andWhere('i.barrio = :barrio', { barrio: filtro.barrio });
    }
    if (filtro.estado) {
      qb.andWhere('i.estado = :estado', { estado: filtro.estado });
    }

    return qb.orderBy('i.creadoEn', 'DESC');
  }

  async listar(filtro: FilterInmuebleDto) {
    return paginar(this.construirQueryListado(filtro), filtro.page, filtro.limit);
  }

  /** Sin paginar — uso exclusivo de exports (reportes .xlsx), donde se necesita el universo completo. */
  listarTodosParaExport(filtro: FilterInmuebleDto): Promise<Inmueble[]> {
    return this.construirQueryListado(filtro).getMany();
  }

  /** Lista de barrios distintos, usada para poblar el filtro desplegable del frontend. */
  async listarBarrios(): Promise<string[]> {
    const filas = await this.repo.createQueryBuilder('i').select('DISTINCT i.barrio', 'barrio').getRawMany();
    return filas.map((f) => f.barrio).sort();
  }

  async obtener(id: string): Promise<Inmueble> {
    const inmueble = await this.repo.findOne({ where: { id }, relations: ['propietario'] });
    if (!inmueble) throw new NotFoundException('Inmueble no encontrado.');
    return inmueble;
  }

  /**
   * Hallazgo CONT-03 de la auditoría: antes se aceptaba cualquier `estado` sin validar contra
   * la tabla `contrato`, permitiendo forzar DISPONIBLE en un inmueble con contrato ACTIVO
   * (violación directa de §5/§22 invariante 1) u OCUPADO sin que exista ningún contrato real
   * detrás. La disponibilidad/ocupación es una consecuencia del ciclo de vida del contrato
   * (`ContratosService.crear/reactivar/terminar`), no un campo libre de este endpoint.
   */
  async actualizar(id: string, dto: UpdateInmuebleDto, rol: string): Promise<Inmueble> {
    if ((dto.canonValor !== undefined || dto.depositoValor !== undefined) && rol !== Rol.ADMINISTRADOR) {
      throw new ForbiddenException(
        'Solo Administrador puede editar el canon o el depósito de un inmueble (decisión RDN-06).',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const inmueble = await manager
        .createQueryBuilder(Inmueble, 'i')
        .setLock('pessimistic_write')
        .where('i.id = :id', { id })
        .getOne();
      if (!inmueble) throw new NotFoundException('Inmueble no encontrado.');

      if (dto.estado !== undefined && dto.estado !== inmueble.estado) {
        if (dto.estado === EstadoInmueble.OCUPADO) {
          throw new BadRequestException(
            'Un inmueble solo puede quedar OCUPADO al crear o reactivar un contrato sobre él, no editando su estado directamente.',
          );
        }
        if (dto.estado === EstadoInmueble.DISPONIBLE) {
          const contratoActivo = await manager.findOne(Contrato, {
            where: { inmueble: { id }, estado: EstadoContrato.ACTIVO },
          });
          if (contratoActivo) {
            throw new BadRequestException(
              'Este inmueble tiene un contrato ACTIVO vigente; no puede marcarse como disponible.',
            );
          }
        }
        // MANTENIMIENTO/INACTIVO: sin restricción — son indicadores administrativos que no
        // afectan la invariante de doble-asignación (el selector de contratación filtra
        // estrictamente por DISPONIBLE).
      }

      const { propietarioId, ...resto } = dto;
      if (propietarioId !== undefined) {
        inmueble.propietario = await this.resolverPropietario(manager, propietarioId);
      }

      Object.assign(inmueble, resto);
      return manager.save(inmueble);
    });
  }

  /** Inmuebles disponibles para el flujo de contratación (selector estricto). */
  disponibles(): Promise<Inmueble[]> {
    return this.repo.find({ where: { estado: 'DISPONIBLE' as any }, order: { barrio: 'ASC' } });
  }
}
