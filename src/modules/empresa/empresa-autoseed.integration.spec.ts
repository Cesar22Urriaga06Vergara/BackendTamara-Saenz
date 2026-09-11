import { EmpresaService } from './empresa.service';
import { bootstrapTestApp, limpiarBaseDeDatos, TestApp } from '../../../test/test-app';

/**
 * La empresa no se auto-crea con valores genéricos: la primera vez debe configurarse
 * explícitamente desde la pantalla de configuración y nunca con un "Mi Empresa" inventado.
 */
describe('EmpresaService (integración) — configuración inicial', () => {
  let testApp: TestApp;
  let service: EmpresaService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(EmpresaService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  it('retorna un objeto predeterminado si la base está vacía y no lanza error', async () => {
    const empresa = await service.obtener();
    expect(empresa.nombre).toBeTruthy();
    expect(empresa.slogan).toBeTruthy();
    expect(empresa.logoUrl).toBeNull();
    const count = await testApp.dataSource.getRepository('empresa').count();
    expect(count).toBe(0);
  });

  it('crea la fila al guardar la configuración inicial con los valores reales del negocio', async () => {
    const empresa = await service.actualizarParametros({
      nombre: 'Inversiones Tamara & Saenz',
      nit: '900123456-1',
      slogan: 'Soluciones inmobiliarias',
      direccion: 'Calle 123',
      telefono: '3001112233',
      horizonteMesesCanon: 6,
      saldoInicialCaja: 2500000,
    });

    expect(empresa.id).toBeDefined();
    expect(empresa.nombre).toBe('Inversiones Tamara & Saenz');
    expect(empresa.nit).toBe('900123456-1');
    expect(empresa.horizonteMesesCanon).toBe(6);
    expect(empresa.saldoInicialCaja).toBe(2500000);
  });

  it('obtenerBranding devuelve la marca por defecto del sistema sin exigir una empresa guardada', async () => {
    const branding = await service.obtenerBranding();
    expect(Object.keys(branding).sort()).toEqual(['logoUrl', 'nombre', 'slogan']);
    expect(branding.nombre).toBeTruthy();
    expect(branding.slogan).toBeTruthy();
    expect(branding.logoUrl).toBeNull();
  });
});
