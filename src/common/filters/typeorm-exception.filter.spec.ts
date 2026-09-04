import { QueryFailedError } from 'typeorm';
import { TypeOrmExceptionFilter } from './typeorm-exception.filter';

function ejecutarFiltro(code: string | undefined) {
  const filtro = new TypeOrmExceptionFilter();
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host: any = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  };
  const error = new QueryFailedError('SELECT 1', [], new Error('x') as any);
  (error as any).driverError = code ? { code } : {};
  filtro.catch(error, host);
  return { statusCode: status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
}

describe('TypeOrmExceptionFilter', () => {
  it('mapea ER_LOCK_DEADLOCK a 503 (transitorio, reintentable)', () => {
    const { statusCode, body } = ejecutarFiltro('ER_LOCK_DEADLOCK');
    expect(statusCode).toBe(503);
    expect(JSON.stringify(body)).toMatch(/intentarlo/i);
  });

  it('mapea ER_LOCK_WAIT_TIMEOUT a 503', () => {
    expect(ejecutarFiltro('ER_LOCK_WAIT_TIMEOUT').statusCode).toBe(503);
  });

  it('mapea ER_QUERY_INTERRUPTED a 503', () => {
    expect(ejecutarFiltro('ER_QUERY_INTERRUPTED').statusCode).toBe(503);
  });

  it('mapea ER_DUP_ENTRY a 409 (sin cambio)', () => {
    expect(ejecutarFiltro('ER_DUP_ENTRY').statusCode).toBe(409);
  });

  it('un código de BD desconocido sigue devolviendo 400', () => {
    expect(ejecutarFiltro('ER_ALGO_RARO').statusCode).toBe(400);
  });

  it('sin código de driver devuelve 400', () => {
    expect(ejecutarFiltro(undefined).statusCode).toBe(400);
  });
});
