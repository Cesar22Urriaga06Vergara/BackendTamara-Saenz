import { AuditoriaService } from './auditoria.service';
import { bootstrapTestApp, limpiarBaseDeDatos, TestApp } from '../../../test/test-app';

describe('AuditoriaService (integración)', () => {
  let testApp: TestApp;
  let service: AuditoriaService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(AuditoriaService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  async function registrar(overrides: Partial<Parameters<AuditoriaService['registrar']>[0]> = {}) {
    await service.registrar({
      modulo: 'CONTRATOS',
      accion: 'CREAR',
      usuarioEmail: 'admin@tamarasaenz.com',
      metodoHttp: 'POST',
      ruta: '/api/v1/contratos',
      duracionMs: 42,
      ...overrides,
    });
  }

  it('registra una entrada y la devuelve en el listado', async () => {
    await registrar();

    const resultado = await service.listar({});
    expect(resultado.total).toBe(1);
    expect(resultado.data[0].modulo).toBe('CONTRATOS');
    expect(resultado.data[0].ipOrigen).toBeNull();
  });

  it('filtra por módulo', async () => {
    await registrar({ modulo: 'CONTRATOS' });
    await registrar({ modulo: 'RECAUDO' });

    const resultado = await service.listar({ modulo: 'RECAUDO' });
    expect(resultado.total).toBe(1);
    expect(resultado.data[0].modulo).toBe('RECAUDO');
  });

  it('filtra por usuarioEmail', async () => {
    await registrar({ usuarioEmail: 'admin@tamarasaenz.com' });
    await registrar({ usuarioEmail: 'recepcion@tamarasaenz.com' });

    const resultado = await service.listar({ usuarioEmail: 'recepcion@tamarasaenz.com' });
    expect(resultado.total).toBe(1);
    expect(resultado.data[0].usuarioEmail).toBe('recepcion@tamarasaenz.com');
  });

  it('el filtro "hasta" incluye todo el día límite, no solo la medianoche (AUD-021)', async () => {
    await registrar();
    const hoyComoFecha = new Date().toISOString().slice(0, 10);

    const resultado = await service.listar({ hasta: hoyComoFecha });
    expect(resultado.total).toBe(1);
  });

  it('pagina correctamente el resultado', async () => {
    for (let i = 0; i < 5; i++) {
      await registrar({ ruta: `/api/v1/contratos/${i}` });
    }

    const pagina1 = await service.listar({ page: '1', limit: '2' });
    expect(pagina1.data).toHaveLength(2);
    expect(pagina1.total).toBe(5);
    expect(pagina1.totalPages).toBe(3);
  });
});
