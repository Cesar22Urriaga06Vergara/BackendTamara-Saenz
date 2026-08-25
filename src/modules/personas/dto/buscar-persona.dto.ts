import { IsOptional, IsString } from 'class-validator';

/** Búsqueda estricta por cédula/documento (preferente) o nombre. */
export class BuscarPersonaDto {
  @IsOptional() @IsString() documento?: string;
  @IsOptional() @IsString() nombre?: string;
}
