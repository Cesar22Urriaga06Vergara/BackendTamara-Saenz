import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export interface ResultadoPaginado<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Aplica skip/take sobre el query builder ya filtrado/ordenado y devuelve el resultado paginado. */
export async function paginar<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  page?: string | number,
  limit?: string | number,
  limitPorDefecto = 10,
): Promise<ResultadoPaginado<T>> {
  const paginaActual = Number(page ?? 1);
  const limiteActual = Number(limit ?? limitPorDefecto);

  qb.skip((paginaActual - 1) * limiteActual).take(limiteActual);

  const [data, total] = await qb.getManyAndCount();
  return { data, total, page: paginaActual, limit: limiteActual, totalPages: Math.ceil(total / limiteActual) };
}
