import { IsEnum, IsOptional } from 'class-validator';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';
import { TipoServicioPublico } from '../entities/recibo-publico.entity';

export class FilterServicioPublicoDto extends PaginacionDto {
  @IsOptional()
  @IsEnum(TipoServicioPublico)
  tipoServicio?: TipoServicioPublico;
}
