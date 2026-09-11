import { bootstrapTestApp, limpiarBaseDeDatos, TestApp } from '../../../test/test-app';
import { ConsecutivoService } from './consecutivo.service';

describe('ConsecutivoService (integración)', () => {
  let testApp: TestApp;
  let service: ConsecutivoService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(ConsecutivoService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  it('crea y lista consecutivos configurados por el administrador', async () => {
    const creado = await service.guardar({ tipo: 'RECIBO_CAJA', prefijo: 'REC-', ultimoNumero: 42 });

    expect(creado.tipo).toBe('RECIBO_CAJA');
    expect(creado.prefijo).toBe('REC-');
    expect(creado.ultimoNumero).toBe(42);

    const lista = await service.listar();
    expect(lista).toHaveLength(1);
    expect(lista[0].tipo).toBe('RECIBO_CAJA');
  });

  it('actualiza el prefijo y el último número sin duplicar registros', async () => {
    await service.guardar({ tipo: 'EGRESO', prefijo: 'EGR-', ultimoNumero: 10 });
    const actualizado = await service.guardar({ tipo: 'EGRESO', prefijo: 'E-', ultimoNumero: 25 });

    expect(actualizado.prefijo).toBe('E-');
    expect(actualizado.ultimoNumero).toBe(25);
    expect((await service.listar()).length).toBe(1);
  });
});
