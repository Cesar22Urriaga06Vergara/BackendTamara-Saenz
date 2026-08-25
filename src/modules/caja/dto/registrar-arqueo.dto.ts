import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** Conteo físico real de caja, ingresado por el Administrador al cerrar un arqueo (§15). */
export class RegistrarArqueoDto {
  @IsNumber() @Min(0) saldoContado: number;
  @IsOptional() @IsString() observaciones?: string;
}
