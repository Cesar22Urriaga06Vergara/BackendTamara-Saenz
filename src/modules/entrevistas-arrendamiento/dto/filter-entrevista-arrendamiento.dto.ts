import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';
import { EstadoEntrevistaArrendamiento } from '../entities/entrevista-arrendamiento.entity';

export class FilterEntrevistaArrendamientoDto extends PaginacionDto {
  @IsOptional() @IsString() busqueda?: string;
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(EstadoEntrevistaArrendamiento)
  estado?: EstadoEntrevistaArrendamiento;
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsDateString()
  fechaHasta?: string;
  @IsOptional() @IsUUID() inmuebleId?: string;
}
