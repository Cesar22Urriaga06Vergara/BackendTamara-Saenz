import { ArrayNotEmpty, IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * Creación de contrato por búsqueda estricta: se referencian IDs ya existentes
 * de Cliente, Codeudores e Inmueble (nunca se crean personas "inline" aquí).
 */
export class CreateContratoDto {
  @IsUUID() clienteId: string;

  @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true })
  codeudorIds: string[];

  @IsUUID() inmuebleId: string;

  @IsDateString() fechaInicio: string;
  // fechaFin NO se recibe en creación: siempre inicia NULL.

  /** Opcional (§6.1): si no se envía, se deriva server-side del día de `fechaInicio`. */
  @IsOptional() @IsInt() @Min(1) @Max(31) diaPago?: number;

  @IsOptional() @IsNumber() @Min(0) depositoCustodia?: number;

  @IsOptional() @IsString() observaciones?: string;
}
