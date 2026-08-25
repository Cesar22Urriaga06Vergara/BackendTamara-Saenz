import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Propietario } from './entities/propietario.entity';
import { CreatePropietarioDto } from './dto/create-propietario.dto';
import { UpdatePropietarioDto } from './dto/update-propietario.dto';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { paginar } from '../../common/utils/paginar.util';

@Injectable()
export class PropietariosService {
  constructor(@InjectRepository(Propietario) private readonly repo: Repository<Propietario>) {}

  crear(dto: CreatePropietarioDto): Promise<Propietario> {
    return this.repo.save(this.repo.create({ ...dto, esInmobiliaria: false }));
  }

  listar(filtro: PaginacionDto) {
    const qb = this.repo.createQueryBuilder('p').orderBy('p.nombre', 'ASC');
    return paginar(qb, filtro.page, filtro.limit);
  }

  /** Sin paginar — para poblar selectores (ej: al crear/editar un inmueble). */
  listarTodos(): Promise<Propietario[]> {
    return this.repo.find({ order: { nombre: 'ASC' } });
  }

  async obtener(id: string): Promise<Propietario> {
    const propietario = await this.repo.findOne({ where: { id } });
    if (!propietario) throw new NotFoundException('Propietario no encontrado.');
    return propietario;
  }

  /** El propietario especial "INMOBILIARIA" (§4), usado como default cuando un inmueble no especifica propietario. */
  async obtenerInmobiliaria(): Promise<Propietario> {
    const propietario = await this.repo.findOne({ where: { esInmobiliaria: true } });
    if (!propietario) {
      throw new NotFoundException(
        'No existe el propietario especial "INMOBILIARIA". Verifique que la migración semilla se haya ejecutado.',
      );
    }
    return propietario;
  }

  async actualizar(id: string, dto: UpdatePropietarioDto): Promise<Propietario> {
    const propietario = await this.obtener(id);
    if (propietario.esInmobiliaria) {
      throw new BadRequestException('El propietario especial "INMOBILIARIA" no puede editarse desde aquí.');
    }
    Object.assign(propietario, dto);
    return this.repo.save(propietario);
  }
}
