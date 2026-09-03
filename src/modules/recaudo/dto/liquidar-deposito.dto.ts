import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MedioPago } from '../../../common/enums/medio-pago.enum';
import { TipoDescuentoDeposito } from '../entities/descuento-deposito.entity';

/** Un descuento individual del depósito, con su propio concepto y valor (§19, hallazgo DEP-01). */
class DescuentoDepositoInput {
  @IsString() @IsNotEmpty() concepto: string;
  /** COP no maneja centavos (hallazgo B3 de la auditoría contable 2026-09-01). */
  @IsInt() @Min(1) valor: number;

  /**
   * `GENERAL` (default): daños/aseo/servicios, solo baja el valor a devolver.
   * `DEUDA`: arriendo debido — además abona la obligación real del contrato (hallazgo LB-6).
   */
  @IsOptional() @IsEnum(TipoDescuentoDeposito) tipo?: TipoDescuentoDeposito;
}

/** Liquidación del depósito de garantía al terminar un contrato. */
export class LiquidarDepositoDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DescuentoDepositoInput)
  descuentos?: DescuentoDepositoInput[];

  /** Requerido únicamente cuando queda saldo por devolver (validado en el service). */
  @IsOptional() @IsEnum(MedioPago) medioPago?: MedioPago;

  @IsOptional() @IsString() referencia?: string;
  @IsOptional() @IsString() observaciones?: string;
}
