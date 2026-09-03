import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export interface ResultadoPaginado<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LIMITE_MAXIMO_PAGINACION = 100;

/**
 * Aplica skip/take sobre el query builder ya filtrado/ordenado y devuelve el resultado
 * paginado. Guardia defensiva de última línea: no todos los endpoints que llaman a `paginar`
 * pasan por `PaginacionDto` (algunos leen `page`/`limit` como `@Query()` sueltos sin
 * decorador de DTO, sin pasar por `ValidationPipe`), así que se acota aquí también — un
 * `page`/`limit` no numérico o no positivo cae a un valor seguro en vez de producir `NaN`
 * (que TypeORM traduciría en un `LIMIT`/`OFFSET` inválido), y `limit` nunca excede el techo
 * aunque el llamador lo haya pasado sin validar.
 */
export async function paginar<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  page?: string | number,
  limit?: string | number,
  limitPorDefecto = 10,
): Promise<ResultadoPaginado<T>> {
  const paginaCruda = Number(page);
  const limiteCrudo = Number(limit);

  const paginaActual = Number.isFinite(paginaCruda) && paginaCruda >= 1 ? Math.floor(paginaCruda) : 1;
  const limiteActual =
    Number.isFinite(limiteCrudo) && limiteCrudo >= 1
      ? Math.min(Math.floor(limiteCrudo), LIMITE_MAXIMO_PAGINACION)
      : limitPorDefecto;

  qb.skip((paginaActual - 1) * limiteActual).take(limiteActual);

  const [data, total] = await qb.getManyAndCount();
  return { data, total, page: paginaActual, limit: limiteActual, totalPages: Math.ceil(total / limiteActual) };
}

/**
 * Igual que `paginar` pero sobre un array ya cargado/ordenado en memoria — para endpoints cuyo
 * resultado se agrega en JS (ej. cartera agrupada por contrato) y no se puede paginar en SQL.
 * Mismas guardias de `page`/`limit` que la versión de query builder.
 */
export function paginarArray<T>(
  items: T[],
  page?: string | number,
  limit?: string | number,
  limitPorDefecto = 10,
): ResultadoPaginado<T> {
  const paginaCruda = Number(page);
  const limiteCrudo = Number(limit);

  const paginaActual = Number.isFinite(paginaCruda) && paginaCruda >= 1 ? Math.floor(paginaCruda) : 1;
  const limiteActual =
    Number.isFinite(limiteCrudo) && limiteCrudo >= 1
      ? Math.min(Math.floor(limiteCrudo), LIMITE_MAXIMO_PAGINACION)
      : limitPorDefecto;

  const inicio = (paginaActual - 1) * limiteActual;
  return {
    data: items.slice(inicio, inicio + limiteActual),
    total: items.length,
    page: paginaActual,
    limit: limiteActual,
    totalPages: Math.ceil(items.length / limiteActual),
  };
}
