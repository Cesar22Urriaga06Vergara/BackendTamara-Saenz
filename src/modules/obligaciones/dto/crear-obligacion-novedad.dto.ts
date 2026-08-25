import { IsNumber, IsString, IsUUID, Min } from 'class-validator';

/** Usado internamente por NovedadesService al aprobar "Cargo a Arrendatario". */
export class CrearObligacionNovedadDto {
  @IsUUID() contratoId: string;
  @IsNumber() @Min(0) monto: number;
  @IsString() concepto: string;
  @IsUUID() novedadId: string;
}
