import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { EstadoRecibo } from '../entities/recibo-caja.entity';
import { MedioPago } from '../../../common/enums/medio-pago.enum';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/** Filtros del listado general de Recibos (módulo independiente de Finanzas). */
export class FilterReciboDto extends PaginacionDto {
  @IsOptional() @IsString() busqueda?: string; // cédula, nombre del cliente o consecutivo del recibo
  @IsOptional() @IsString() fechaDesde?: string;
  @IsOptional() @IsString() fechaHasta?: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional() @IsEnum(EstadoRecibo)
  estado?: EstadoRecibo;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional() @IsEnum(MedioPago)
  medioPago?: MedioPago;
}
