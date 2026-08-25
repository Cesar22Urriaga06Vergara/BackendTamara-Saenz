import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { EstadoNovedad, ImpactoFinanciero } from '../entities/novedad.entity';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/** Filtro por barrio del inmueble + estado + rango de fechas + impacto financiero. */
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
  // Pantalla Gastos (Track B5): solo novedades ya aprobadas como gasto de la inmobiliaria.
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(ImpactoFinanciero)
  impactoFinanciero?: ImpactoFinanciero;
  @Transform(({ value }) => (value === '' ? undefined : value === 'true' || value === true))
  @IsOptional()
  @IsBoolean()
  gastoPagado?: boolean;
}
