import { ObligacionesService } from './obligaciones.service';
import { Obligacion, TipoObligacion } from './entities/obligacion.entity';
import {
  bootstrapTestApp,
  limpiarBaseDeDatos,
  crearCliente,
  crearInmueble,
  crearContrato,
  TestApp,
} from '../../../test/test-app';

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

  it('back-fill: un contrato con fechaInicio hace 4 meses recibe el canon de TODOS los meses vencidos + el horizonte, sin huecos', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth() - 4, 1); // día 1 ⇒ sin overflow de setMonth
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, {
      canonValor: 450000,
      diaPago: 10,
      fechaInicio: inicioMes,
    });

    await service.generarCanonesMensuales();

    const canones = await testApp.dataSource
      .getRepository(Obligacion)
      .find({ where: { contrato: { id: contrato.id }, tipo: TipoObligacion.CANON }, order: { periodo: 'ASC' } });

    // 4 meses vencidos + mes en curso + 2 de anticipación (horizonte 3) = 7.
    expect(canones).toHaveLength(7);

    // La columna `periodo` (type: 'date') se lee como string "YYYY-MM-DD"; se compara por
    // "YYYY-MM" sin pasar por `new Date()` (parseo ISO-UTC que corre el día en zona negativa).
    const mesDe = (p: unknown) => String(p).slice(0, 7);
    const yyyymm = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // El primer periodo es el mes de fechaInicio y no hay ningún mes salteado (regresión del
    // bug de `sumarMeses`, que en un día 29-31 se comía un mes).
    expect(mesDe(canones[0].periodo)).toBe(yyyymm(inicioMes));
    for (let i = 1; i < canones.length; i++) {
      const [ya, ym] = mesDe(canones[i - 1].periodo)
        .split('-')
        .map(Number);
      const [aa, am] = mesDe(canones[i].periodo).split('-').map(Number);
      expect((aa - ya) * 12 + (am - ym)).toBe(1);
    }

    // Idempotente aunque ya haya deuda histórica.
    const segunda = await service.generarCanonesMensuales();
    expect(segunda.generadas).toBe(0);
  });
});
