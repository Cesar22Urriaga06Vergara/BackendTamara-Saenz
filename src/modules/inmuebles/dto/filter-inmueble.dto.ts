import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { EstadoInmueble } from '../entities/inmueble.entity';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/** Filtros combinados para la tabla de Inmuebles: búsqueda + barrio + estado. */
export class FilterInmuebleDto extends PaginacionDto {
  @IsOptional() @IsString() busqueda?: string; // dirección o barrio
  @IsOptional() @IsString() barrio?: string;
  // El frontend siempre manda "estado" en el querystring (aunque el filtro esté sin seleccionar,
  // llega como cadena vacía); sin este Transform, @IsEnum rechaza esa cadena vacía con 400.
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(EstadoInmueble)
  estado?: EstadoInmueble;
}
