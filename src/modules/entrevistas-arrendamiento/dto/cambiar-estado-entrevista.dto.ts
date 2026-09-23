import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EstadoEntrevistaArrendamiento } from '../entities/entrevista-arrendamiento.entity';

export class CambiarEstadoEntrevistaDto {
  @IsEnum(EstadoEntrevistaArrendamiento)
  estado: EstadoEntrevistaArrendamiento;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  motivo?: string;
}
