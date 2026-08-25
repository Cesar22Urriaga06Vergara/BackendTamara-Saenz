import { EmpresaService } from './empresa.service';
import { bootstrapTestApp, limpiarBaseDeDatos, TestApp } from '../../../test/test-app';

/**
 * Valida que `EmpresaService` se autorepare con la base de datos en blanco: producción ya no
 * depende de `npm run seed` para tener la fila única de Empresa antes de poder usar
 * `/configuracion`, el registro inicial, o cualquier cálculo que dependa de sus parámetros.
 */
describe('EmpresaService (integración) — autoseed', () => {
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

  it('crea la fila única de Empresa con valores por defecto si la tabla está vacía', async () => {
    const empresa = await service.obtener();
    expect(empresa.id).toBeDefined();
    expect(empresa.diasGraciaMora).toBe(5);
    expect(Number(empresa.porcentajeMoraMensual)).toBe(1.5);
  });

  it('no crea una segunda fila si ya existe una', async () => {
    const primera = await service.obtener();
    const segunda = await service.obtener();
    expect(segunda.id).toBe(primera.id);
  });

  it('obtenerBranding expone solo nombre/slogan/logoUrl, sin parámetros financieros', async () => {
    const branding = await service.obtenerBranding();
    expect(Object.keys(branding).sort()).toEqual(['logoUrl', 'nombre', 'slogan']);
  });
});
