import { paginar } from './paginar.util';

/**
 * Unit test puro (sin base de datos): `paginar()` es la última línea de defensa contra
 * `page`/`limit` sin cota o no numéricos — algunos endpoints los leen como `@Query()` sueltos
 * sin pasar por `PaginacionDto`/`ValidationPipe` (ver `paginar.util.ts`), así que esta guardia
 * debe sostenerse por sí sola independientemente de cómo llegue el valor.
 */
function fakeQueryBuilder(totalFilas: number) {
  const llamadas: { skip?: number; take?: number } = {};
  const qb: any = {
    skip: (n: number) => {
      llamadas.skip = n;
      return qb;
    },
    take: (n: number) => {
      llamadas.take = n;
      return qb;
    },
    getManyAndCount: () => Promise.resolve([[], totalFilas]),
  };
  return { qb, llamadas };
}

describe('paginar()', () => {
  it('usa page=1/limit por defecto cuando no se pasa nada', async () => {
    const { qb, llamadas } = fakeQueryBuilder(0);
    const resultado = await paginar(qb, undefined, undefined, 10);
    expect(llamadas.skip).toBe(0);
    expect(llamadas.take).toBe(10);
    expect(resultado.page).toBe(1);
    expect(resultado.limit).toBe(10);
  });

  it('acota limit al techo (100) aunque el llamador pida más', async () => {
    const { qb, llamadas } = fakeQueryBuilder(0);
    await paginar(qb, 1, 999999999);
    expect(llamadas.take).toBe(100);
  });

  it('un limit no numérico cae al valor por defecto en vez de producir NaN', async () => {
    const { qb, llamadas } = fakeQueryBuilder(0);
    await paginar(qb, 'abc' as any, 'xyz' as any, 10);
    expect(Number.isNaN(llamadas.take)).toBe(false);
    expect(llamadas.take).toBe(10);
    expect(Number.isNaN(llamadas.skip)).toBe(false);
  });

  it('un page/limit negativo o cero cae a valores seguros', async () => {
    const { qb, llamadas } = fakeQueryBuilder(0);
    const resultado = await paginar(qb, -5, 0, 10);
    expect(resultado.page).toBe(1);
    expect(llamadas.take).toBe(10);
  });

  it('calcula skip correctamente para una página > 1', async () => {
    const { qb, llamadas } = fakeQueryBuilder(0);
    await paginar(qb, 3, 20);
    expect(llamadas.skip).toBe(40); // (3-1) * 20
    expect(llamadas.take).toBe(20);
  });
});
