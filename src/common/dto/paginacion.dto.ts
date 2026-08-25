import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const LIMITE_MAXIMO_PAGINACION = 100;

/**
 * Campos de paginación compartidos por los filtros de listado. Antes `page`/`limit` solo
 * exigían ser `string` (sin cota ni validación numérica): cualquier usuario autenticado podía
 * pedir `?limit=999999999` para traer una tabla completa en una sola consulta, o un valor no
 * numérico que `Number(...)` convertía silenciosamente en `NaN` dentro de `paginar()`. Se
 * acotan aquí a enteros positivos con un techo razonable.
 */
export class PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(LIMITE_MAXIMO_PAGINACION) limit?: number;
}
