import { IsInt, IsString, Min } from 'class-validator';

/** El Admin aprueba: genera obligación tipo NOVEDAD cobrable en el próximo recaudo. */
export class AprobarCargoArrendatarioDto {
  /** COP no maneja centavos (hallazgo B3 de la auditoría contable 2026-09-01). */
  @IsInt() @Min(1) monto: number;
  @IsString() concepto: string;
}
