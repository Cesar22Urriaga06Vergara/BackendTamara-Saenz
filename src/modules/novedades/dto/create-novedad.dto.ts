import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ResponsableSugerido } from '../entities/novedad.entity';

/** Registro rápido en recepción: sin ningún dato financiero. */
export class CreateNovedadDto {
  @IsUUID() inmuebleId: string;
  @IsOptional() @IsUUID() contratoId?: string;

  @IsString() descripcion: string;
  @IsDateString() fecha: string;
  @IsOptional() @IsString() observaciones?: string;

  @IsEnum(ResponsableSugerido) responsableSugerido: ResponsableSugerido;
}
