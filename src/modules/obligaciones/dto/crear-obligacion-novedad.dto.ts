import { IsInt, IsString, IsUUID, Min } from 'class-validator';

/** Usado internamente por NovedadesService al aprobar "Cargo a Arrendatario". */
export class CrearObligacionNovedadDto {
  @IsUUID() contratoId: string;
  /** COP no maneja centavos (hallazgo B3 de la auditoría contable 2026-09-01). */
  @IsInt() @Min(1) monto: number;
  @IsString() concepto: string;
  @IsUUID() novedadId: string;
}
