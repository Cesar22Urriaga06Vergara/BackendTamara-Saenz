import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MedioPago } from '../../../common/enums/medio-pago.enum';

/**
 * Pago real de un gasto de inmobiliaria ya APROBADO (NOV-01): es el único paso que
 * genera el movimiento de caja tipo EGRESO — la aprobación, por sí sola, no mueve dinero.
 */
export class PagarGastoInmobiliariaDto {
  @IsEnum(MedioPago) medioPago: MedioPago;
  @IsOptional() @IsString() referencia?: string;
}
