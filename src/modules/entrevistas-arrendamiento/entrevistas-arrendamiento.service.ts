import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from '../../common/enums/roles.enum';
import { paginar } from '../../common/utils/paginar.util';
import { ConsecutivoService } from '../empresa/consecutivo.service';
import { CambiarEstadoEntrevistaDto } from './dto/cambiar-estado-entrevista.dto';
import { CreateEntrevistaArrendamientoDto } from './dto/create-entrevista-arrendamiento.dto';
import { FilterEntrevistaArrendamientoDto } from './dto/filter-entrevista-arrendamiento.dto';
import {
  EntrevistaArrendamiento,
  EstadoEntrevistaArrendamiento,
  TipoDocumentoEntrevista,
} from './entities/entrevista-arrendamiento.entity';

@Injectable()
export class EntrevistasArrendamientoService {
  constructor(
    @InjectRepository(EntrevistaArrendamiento) private readonly repo: Repository<EntrevistaArrendamiento>,
    private readonly consecutivoService: ConsecutivoService,
  ) {}

  async crear(dto: CreateEntrevistaArrendamientoDto, creadoPorEmail: string): Promise<EntrevistaArrendamiento> {
    this.validarDatosNegocio(dto);
    const { formateado } = await this.consecutivoService.siguiente('ENTREVISTA_ARRENDAMIENTO', 'ENT-');
    const entrevista = this.repo.create({
      ...dto,
      consecutivo: formateado,
      estado: EstadoEntrevistaArrendamiento.BORRADOR,
      creadoPorEmail: creadoPorEmail.trim().toLowerCase(),
      decididoPorEmail: null,
      motivoDecision: null,
      decididoEn: null,
      tipoDocumento: dto.tipoDocumento ?? TipoDocumentoEntrevista.CC,
      presentaSoportes: dto.presentaSoportes ?? false,
      aceptaEstudioCredito: dto.aceptaEstudioCredito ?? false,
      cliente: dto.clienteId ? { id: dto.clienteId } : null,
      inmueble: dto.inmuebleId ? { id: dto.inmuebleId } : null,
      contrato: dto.contratoId ? { id: dto.contratoId } : null,
    });
    return this.repo.save(entrevista);
  }

  async listar(filtro: FilterEntrevistaArrendamientoDto, rol?: string, usuarioEmail?: string) {
    const qb = this.repo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.cliente', 'cliente')
      .leftJoinAndSelect('e.inmueble', 'inmueble')
      .leftJoinAndSelect('e.contrato', 'contrato')
      .orderBy('e.creadoEn', 'DESC');
    if (filtro.busqueda) {
      qb.andWhere('(e.nombreCompleto LIKE :busqueda OR e.numeroDocumento LIKE :busqueda)', {
        busqueda: `%${filtro.busqueda}%`,
      });
    }
    if (filtro.estado) qb.andWhere('e.estado = :estado', { estado: filtro.estado });
    if (filtro.fechaDesde) qb.andWhere('e.creadoEn >= :fechaDesde', { fechaDesde: filtro.fechaDesde });
    if (filtro.fechaHasta) qb.andWhere('e.creadoEn <= :fechaHasta', { fechaHasta: filtro.fechaHasta });
    if (filtro.inmuebleId) qb.andWhere('inmueble.id = :inmuebleId', { inmuebleId: filtro.inmuebleId });
    if (rol === Rol.RECEPCIONISTA && usuarioEmail) {
      qb.andWhere('(e.estado <> :estadoBorrador OR e.creadoPorEmail = :usuarioEmail)', {
        estadoBorrador: EstadoEntrevistaArrendamiento.BORRADOR,
        usuarioEmail: usuarioEmail.trim().toLowerCase(),
      });
    }
    return paginar(qb, filtro.page, filtro.limit);
  }

  async obtener(id: string): Promise<EntrevistaArrendamiento> {
    const entrevista = await this.repo.findOne({
      where: { id },
      relations: ['cliente', 'inmueble', 'contrato'],
    });
    if (!entrevista) throw new NotFoundException('Entrevista de arrendamiento no encontrada.');
    return entrevista;
  }

  async actualizar(id: string, dto: Partial<CreateEntrevistaArrendamientoDto>): Promise<EntrevistaArrendamiento> {
    const entrevista = await this.obtener(id);
    const estadoActual = String(entrevista.estado ?? '').toUpperCase();
    if (estadoActual !== EstadoEntrevistaArrendamiento.BORRADOR) {
      throw new BadRequestException('Solo se pueden editar entrevistas en borrador.');
    }

    const { estado, creadoPorEmail, decididoPorEmail, motivoDecision, decididoEn, ...camposEditables } = dto as Record<string, any>;
    const datosParaValidar = { ...entrevista, ...camposEditables } as unknown as Partial<CreateEntrevistaArrendamientoDto>;
    this.validarDatosNegocio(datosParaValidar as CreateEntrevistaArrendamientoDto);
    Object.assign(entrevista, camposEditables);
    return this.repo.save(entrevista);
  }

  async cambiarEstado(
    id: string,
    dto: CambiarEstadoEntrevistaDto,
    rol: string,
    decididoPorEmail: string,
  ): Promise<EntrevistaArrendamiento> {
    const entrevista = await this.obtener(id);
    if (
      dto.estado === EstadoEntrevistaArrendamiento.APROBADA ||
      dto.estado === EstadoEntrevistaArrendamiento.RECHAZADA
    ) {
      if (rol !== Rol.ADMINISTRADOR) throw new ForbiddenException('Solo el Administrador puede decidir la entrevista.');
      if (dto.estado === EstadoEntrevistaArrendamiento.RECHAZADA && !dto.motivo?.trim()) {
        throw new BadRequestException('El motivo de rechazo es obligatorio.');
      }
      if (entrevista.estado !== EstadoEntrevistaArrendamiento.REALIZADA) {
        throw new BadRequestException('Solo se puede decidir una entrevista realizada.');
      }
    } else if (
      dto.estado === EstadoEntrevistaArrendamiento.REALIZADA &&
      entrevista.estado !== EstadoEntrevistaArrendamiento.BORRADOR
    ) {
      throw new BadRequestException('Solo un borrador puede marcarse como realizado.');
    } else if (
      dto.estado === EstadoEntrevistaArrendamiento.BORRADOR &&
      entrevista.estado !== EstadoEntrevistaArrendamiento.BORRADOR
    ) {
      throw new BadRequestException('Una entrevista realizada no puede volver a borrador.');
    }
    entrevista.estado = dto.estado;
    entrevista.decididoPorEmail = dto.estado === EstadoEntrevistaArrendamiento.REALIZADA ? null : decididoPorEmail;
    entrevista.motivoDecision = dto.motivo?.trim() || null;
    entrevista.decididoEn = dto.estado === EstadoEntrevistaArrendamiento.REALIZADA ? null : new Date();
    return this.repo.save(entrevista);
  }

  private validarDatosNegocio(dto: CreateEntrevistaArrendamientoDto): void {
    if (dto.fechaNacimiento && this.esMenorDeEdad(dto.fechaNacimiento)) {
      throw new BadRequestException('El solicitante debe ser mayor de edad.');
    }

    if (dto.tieneFiador === true) {
      const completos = [
        dto.fiadorNombreCompleto,
        dto.fiadorTipoDocumento,
        dto.fiadorNumeroDocumento,
        dto.fiadorTelefono,
        dto.fiadorDireccion,
        dto.fiadorRelacion,
      ].every((valor) => typeof valor === 'string' && valor.trim().length > 0);
      if (!completos) throw new BadRequestException('Debe registrar los datos completos del fiador.');
    }
  }

  private esMenorDeEdad(fechaNacimiento: string): boolean {
    const nacimiento = new Date(`${fechaNacimiento}T00:00:00Z`);
    if (Number.isNaN(nacimiento.getTime())) return false;
    const hoy = new Date();
    let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
    const mes = hoy.getUTCMonth() - nacimiento.getUTCMonth();
    if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nacimiento.getUTCDate())) edad--;
    return edad < 18;
  }
}
