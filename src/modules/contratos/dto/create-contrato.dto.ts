import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MedioPago } from '../../../common/enums/medio-pago.enum';

/**
 * Creación de contrato por búsqueda estricta: se referencian IDs ya existentes
 * de Cliente, Codeudores e Inmueble (nunca se crean personas "inline" aquí).
 */
export class CreateContratoDto {
  @IsUUID() clienteId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  codeudorIds: string[];

  @IsUUID() inmuebleId: string;

  @IsDateString() fechaInicio: string;
  // fechaFin NO se recibe en creación: siempre inicia NULL.

  /** Opcional (§6.1): si no se envía, se deriva server-side del día de `fechaInicio`. */
  @IsOptional() @IsInt() @Min(1) @Max(31) diaPago?: number;

  /** COP no maneja centavos (hallazgo B3 de la auditoría contable 2026-09-01). */
  @IsOptional() @IsInt() @Min(0) depositoGarantia?: number;

  /**
   * Medio de pago con el que se recibió el depósito de garantía — obligatorio cuando
   * `depositoGarantia > 0` (validado en el servicio, no aquí, porque depende del otro campo).
   * Hallazgo B5 de la auditoría contable 2026-09-01: antes el depósito nunca generaba un
   * `Movimiento` de INGRESO al cobrarse, solo un EGRESO al devolverse — la caja quedaba
   * subestimada mientras el contrato estuviera vigente y se descuadraba al liquidar.
   */
  @IsOptional() @IsEnum(MedioPago) medioPagoDeposito?: MedioPago;

  @IsOptional() @IsString() @MaxLength(100) referenciaDeposito?: string;
}
