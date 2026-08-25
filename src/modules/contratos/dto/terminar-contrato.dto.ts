import { IsDateString, IsString } from 'class-validator';

/** Solo aquí se solicita explícitamente la fecha de fin del contrato. */
export class TerminarContratoDto {
  @IsDateString() fechaFin: string;
  @IsString() motivoTerminacion: string;
}
