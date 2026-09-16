import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inmueble } from '../inmuebles/entities/inmueble.entity';
import { paginar } from '../../common/utils/paginar.util';
import { CreateServicioPublicoDto } from './dto/create-servicio-publico.dto';
import { AprobarResponsableDto } from './dto/aprobar-responsable.dto';
import { EstadoPagoServicio, ReciboPublico, ResponsablePago } from './entities/recibo-publico.entity';
import { FilterServicioPublicoDto } from './dto/filter-servicio-publico.dto';

@Injectable()
export class ServiciosPublicosService {
  constructor(
    @InjectRepository(ReciboPublico) private readonly repo: Repository<ReciboPublico>,
    @InjectRepository(Inmueble) private readonly inmuebleRepo: Repository<Inmueble>,
  ) {}

  async crear(dto: CreateServicioPublicoDto, registradoPorEmail: string): Promise<ReciboPublico> {
    const inmueble = await this.inmuebleRepo.findOne({ where: { id: dto.inmuebleId } });
    if (!inmueble) throw new NotFoundException('Inmueble no encontrado.');

    const recibo = this.repo.create({
      inmueble,
      tipoServicio: dto.tipoServicio,
      periodo: dto.periodo,
      numeroFactura: dto.numeroFactura,
      valor: dto.valor,
      fechaEmision: new Date(dto.fechaEmision),
      fechaVencimiento: new Date(dto.fechaVencimiento),
      observaciones: dto.observaciones ?? null,
      registradoPorEmail,
      responsablePago: ResponsablePago.PENDIENTE,
      estadoPago: EstadoPagoServicio.PENDIENTE,
    });

    return this.repo.save(recibo);
  }

  async obtener(id: string): Promise<ReciboPublico> {
    const recibo = await this.repo.findOne({ where: { id }, relations: ['inmueble'] });
    if (!recibo) throw new NotFoundException('Recibo público no encontrado.');
    return recibo;
  }

  async listar(filtro: FilterServicioPublicoDto) {
    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.inmueble', 'inmueble')
      .orderBy('r.creadoEn', 'DESC');

    if (filtro.tipoServicio) {
      qb.andWhere('r.tipoServicio = :tipoServicio', { tipoServicio: filtro.tipoServicio });
    }

    return paginar(qb, filtro.page, filtro.limit);
  }

  async aprobarResponsable(id: string, dto: AprobarResponsableDto, aprobadoPorEmail: string): Promise<ReciboPublico> {
    const recibo = await this.obtener(id);
    recibo.responsablePago = dto.responsablePago;
    recibo.aprobadoPorEmail = aprobadoPorEmail;
    recibo.aprobadoEn = new Date();
    if (dto.estadoPago) {
      recibo.estadoPago = dto.estadoPago;
    }
    return this.repo.save(recibo);
  }
}
