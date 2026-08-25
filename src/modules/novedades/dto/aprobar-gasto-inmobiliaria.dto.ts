import { IsNumber, IsString, Min } from 'class-validator';

/** El Admin aprueba: genera movimiento de caja tipo EGRESO. */
export class AprobarGastoInmobiliariaDto {
  @IsNumber() @Min(0) monto: number;
  @IsString() concepto: string;
}
