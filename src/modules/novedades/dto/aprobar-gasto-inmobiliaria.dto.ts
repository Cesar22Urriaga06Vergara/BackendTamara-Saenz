import { IsInt, IsString, Min } from 'class-validator';

/** El Admin aprueba el gasto de la inmobiliaria (APROBADO ≠ PAGADO): no mueve dinero todavía. */
export class AprobarGastoInmobiliariaDto {
  /** COP no maneja centavos (hallazgo B3 de la auditoría contable 2026-09-01). */
  @IsInt() @Min(1) monto: number;
  @IsString() concepto: string;
}
