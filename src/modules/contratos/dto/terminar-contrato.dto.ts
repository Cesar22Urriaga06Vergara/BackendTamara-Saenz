import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Solo aquí se solicita explícitamente la fecha de fin del contrato. */
export class TerminarContratoDto {
  @IsDateString() fechaFin: string;
  /** No vacío (hallazgo B7 de la auditoría contable 2026-09-01): un evento contable — termina
   * el contrato y anula el canon futuro — no debe quedar sin motivo registrado. */
  @IsString() @IsNotEmpty() @MaxLength(300) motivoTerminacion: string;
}
