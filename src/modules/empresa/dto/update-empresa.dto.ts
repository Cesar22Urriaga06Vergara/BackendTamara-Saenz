import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateEmpresaDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() nit?: string;
  @IsOptional() @IsString() slogan?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() telefono?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  horizonteMesesCanon?: number;

  /** COP no maneja centavos (hallazgo B3 de la auditoría contable 2026-09-01). */
  @IsOptional()
  @IsInt()
  @Min(0)
  saldoInicialCaja?: number;
}
