import { IsNumber, IsString, Min } from 'class-validator';

/** El Admin aprueba: genera obligación tipo NOVEDAD cobrable en el próximo recaudo. */
export class AprobarCargoArrendatarioDto {
  @IsNumber() @Min(0) monto: number;
  @IsString() concepto: string;
}
