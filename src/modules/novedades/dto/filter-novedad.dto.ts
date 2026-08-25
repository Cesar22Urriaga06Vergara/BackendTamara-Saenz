import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { EstadoNovedad } from '../entities/novedad.entity';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/** Filtro por barrio del inmueble + estado + rango de fechas. */
export class FilterNovedadDto extends PaginacionDto {
  @IsOptional() @IsString() barrio?: string;
  // El frontend siempre manda "estado" en el querystring (aunque el filtro esté sin seleccionar,
  // llega como cadena vacía); sin este Transform, @IsEnum rechaza esa cadena vacía con 400.
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(EstadoNovedad)
  estado?: EstadoNovedad;
  @IsOptional() @IsString() fechaDesde?: string;
  @IsOptional() @IsString() fechaHasta?: string;
}
