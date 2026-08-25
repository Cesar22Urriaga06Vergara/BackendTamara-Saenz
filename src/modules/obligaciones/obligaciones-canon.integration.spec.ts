import { ObligacionesService } from './obligaciones.service';
import { Obligacion, TipoObligacion } from './entities/obligacion.entity';
import { bootstrapTestApp, limpiarBaseDeDatos, crearCliente, crearInmueble, crearContrato, TestApp } from '../../../test/test-app';

/** Valida CONC-01: dos generaciones de canon concurrentes para el mismo contrato nunca duplican. */
describe('ObligacionesService.generarCanonesMensuales (integración) — CONC-01', () => {
  let testApp: TestApp;
  let service: ObligacionesService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(ObligacionesService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  it('dos generaciones concurrentes del mismo contrato no producen canon duplicado', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { canonValor: 450000, diaPago: 5 });

    // Simula el cron nocturno solapado con un disparo manual del Administrador.
    await Promise.all([service.generarCanonesMensuales(), service.generarCanonesMensuales()]);

    const canones = await testApp.dataSource
      .getRepository(Obligacion)
      .find({ where: { contrato: { id: contrato.id }, tipo: TipoObligacion.CANON } });

    // Horizonte default de Empresa = 3 meses -> exactamente 3 obligaciones, sin duplicados.
    expect(canones).toHaveLength(3);
    const periodos = canones.map((o) => new Date(o.periodo).toISOString().slice(0, 7));
    expect(new Set(periodos).size).toBe(periodos.length); // ningún periodo repetido
  });

  it('correr la generación una tercera vez, secuencialmente, sigue siendo idempotente (0 nuevas)', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { canonValor: 450000, diaPago: 5 });

    await service.generarCanonesMensuales();
    const segunda = await service.generarCanonesMensuales();

    expect(segunda.generadas).toBe(0);

    const canones = await testApp.dataSource
      .getRepository(Obligacion)
      .find({ where: { contrato: { id: contrato.id }, tipo: TipoObligacion.CANON } });
    expect(canones).toHaveLength(3);
  });
});
