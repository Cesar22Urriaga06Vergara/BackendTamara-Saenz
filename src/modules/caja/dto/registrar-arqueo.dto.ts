import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Conteo físico real de caja, ingresado por el Administrador al cerrar un arqueo (§15). */
export class RegistrarArqueoDto {
  /** COP no maneja centavos (hallazgo B3 de la auditoría contable 2026-09-01). */
  @IsInt() @Min(0) saldoContado: number;
  @IsOptional() @IsString() observaciones?: string;
}
