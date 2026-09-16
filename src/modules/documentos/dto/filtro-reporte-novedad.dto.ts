import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EstadoNovedad } from '../../novedades/entities/novedad.entity';

/** Filtros compartidos por los reportes operativos de novedades. */
export class FiltroReporteNovedadDto {
  @IsOptional() @IsUUID() inmuebleId?: string;

  @IsOptional() @IsDateString() fechaDesde?: string;

  @IsOptional() @IsDateString() fechaHasta?: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(EstadoNovedad)
  estado?: EstadoNovedad;
}
