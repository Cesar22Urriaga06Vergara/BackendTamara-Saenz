import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MedioPago } from '../entities/detalle-pago.entity';

class DetallePagoInput {
  @IsEnum(MedioPago) medioPago: MedioPago;
  @IsNumber() @Min(1) monto: number;
  @IsOptional() @IsString() referencia?: string;
}

/** Registra un recibo de caja con uno o varios medios de pago combinados. */
export class RegistrarPagoDto {
  @IsUUID() contratoId: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => DetallePagoInput)
  detallesPago: DetallePagoInput[];

  /** Formato de impresión del recibo. */
  @IsOptional() @IsString() formato?: 'CARTA' | 'MEDIA_CARTA';

  /**
   * Decisión explícita del cliente (RDN-01): por defecto (`false`/ausente), cualquier
   * excedente sobre lo aplicado se devuelve de inmediato como cambio — sea efectivo o
   * transferencia, "como en cualquier lugar". Solo cuando el cliente pide expresamente dejar
   * un abono adelantado, se marca `true` y el excedente queda como saldo a favor acumulable
   * para pagos futuros, en vez de devolverse.
   */
  @IsOptional() @IsBoolean() dejarExcedenteComoSaldoFavor?: boolean;
}
