import { IsIn, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginacionDto } from '../../../common/dto/paginacion.dto';

/**
 * Filtros del listado de deudores de Recaudo (contratos con cartera VENCIDA, uno por fila).
 */
export class FilterDeudoresDto extends PaginacionDto {
  /** Cédula o nombre del arrendatario. */
  @IsOptional() @IsString() busqueda?: string;

  /**
   * `antiguedad_desc` (default): la obligación más antigua primero.
   * `deuda_desc`: mayor deuda total primero.
   */
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsIn(['antiguedad_desc', 'deuda_desc'])
  orden?: 'antiguedad_desc' | 'deuda_desc';
}
