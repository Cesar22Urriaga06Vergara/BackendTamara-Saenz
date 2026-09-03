import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { EstadoRecibo } from '../entities/recibo-caja.entity';
import { MedioPago } from '../../../common/enums/medio-pago.enum';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/** El frontend siempre manda los filtros, con `''` cuando están vacíos: `''` → `undefined`. */
const vacioAUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

/** Filtros del listado general de Recibos (módulo independiente de Finanzas). */
export class FilterReciboDto extends PaginacionDto {
  @IsOptional() @IsString() busqueda?: string; // cédula, nombre del cliente o consecutivo del recibo

  @Transform(vacioAUndefined) @IsOptional() @IsDateString() fechaDesde?: string;
  @Transform(vacioAUndefined) @IsOptional() @IsDateString() fechaHasta?: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(EstadoRecibo)
  estado?: EstadoRecibo;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEnum(MedioPago)
  medioPago?: MedioPago;
}
