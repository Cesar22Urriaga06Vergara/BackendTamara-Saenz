import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { EstadoContrato } from '../entities/contrato.entity';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/** Filtros de la tabla de Contratos: cédula/nombre + barrio/inmueble + rango fecha inicio + estado. */
export class FilterContratoDto extends PaginacionDto {
  @IsOptional() @IsString() busqueda?: string; // cédula o nombre del cliente
  @IsOptional() @IsString() barrio?: string;
  @IsOptional() @IsUUID() inmuebleId?: string;
  @IsOptional() @IsString() fechaDesde?: string;
  @IsOptional() @IsString() fechaHasta?: string;
  // El frontend siempre manda "estado" en el querystring (aunque el filtro esté sin seleccionar,
  // llega como cadena vacía); sin este Transform, @IsEnum rechaza esa cadena vacía con 400.
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(EstadoContrato)
  estado?: EstadoContrato;
}
