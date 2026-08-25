import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MedioPago } from '../../../common/enums/medio-pago.enum';

/** Un descuento individual del depósito, con su propio concepto y valor (§19, hallazgo DEP-01). */
class DescuentoDepositoInput {
  @IsString() @IsNotEmpty() concepto: string;
  @IsNumber() @Min(0.01) valor: number;
}

/** Liquidación del depósito en custodia al terminar un contrato. */
export class LiquidarDepositoDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DescuentoDepositoInput)
  descuentos?: DescuentoDepositoInput[];

  /** Requerido únicamente cuando queda saldo por devolver (validado en el service). */
  @IsOptional() @IsEnum(MedioPago) medioPago?: MedioPago;

  @IsOptional() @IsString() referencia?: string;
  @IsOptional() @IsString() observaciones?: string;
}
