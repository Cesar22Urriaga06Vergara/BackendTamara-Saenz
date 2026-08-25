import { IsEnum } from 'class-validator';
import { EstadoNovedad } from '../entities/novedad.entity';

export class CambiarEstadoNovedadDto {
  @IsEnum(EstadoNovedad) estado: EstadoNovedad;
}
