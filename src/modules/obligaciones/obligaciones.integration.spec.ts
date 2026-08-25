import { ObligacionesService } from './obligaciones.service';
import { TipoObligacion } from './entities/obligacion.entity';
import {
  bootstrapTestApp,
  limpiarBaseDeDatos,
  crearCliente,
  crearInmueble,
  crearContrato,
  configurarEmpresa,
  crearObligacion,
  TestApp,
} from '../../../test/test-app';

/**
 * Valida MORA-01: el off-by-one del cálculo de mora, reproduciendo el ejemplo exacto del
 * §11.1 de la especificación (fecha de pago 10-ago, gracia=5 → gracia inclusiva 10..14, la
 * mora inicia el 15-ago).
 */
describe('ObligacionesService (integración) — MORA-01', () => {
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

  async function crearEscenario(diasAtrasoDeseado: number, porcentajeMoraMensual = 1.5) {
    await configurarEmpresa(testApp.dataSource, { diasGraciaMora: 5, porcentajeMoraMensual });
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { canonValor: 500000 });
    const obligacion = await crearObligacion(testApp.dataSource, contrato, {
      tipo: TipoObligacion.CANON,
      valorOriginal: 500000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado,
    });
    return { contrato, obligacion };
  }

  it('dentro del período de gracia (0 días de atraso): mora = 0', async () => {
    const { contrato, obligacion } = await crearEscenario(0);
    const pendientes = await service.pendientesPorContrato(contrato.id);
    expect(Number(pendientes.find((o) => o.id === obligacion.id)!.valorMoraAcumulada)).toBe(0);
  });

  it('exactamente el último día de gracia (frontera): mora = 0', async () => {
    // diasAtrasoDeseado=0 YA representa el último día de gracia (14-ago del ejemplo) — este
    // test documenta explícitamente que la frontera pertenece a la gracia, no a la mora.
    const { contrato, obligacion } = await crearEscenario(0);
    const pendientes = await service.pendientesPorContrato(contrato.id);
    expect(Number(pendientes.find((o) => o.id === obligacion.id)!.valorMoraAcumulada)).toBe(0);
  });

  it('el PRIMER día fuera de gracia (15-ago del ejemplo) YA debe producir mora > 0 (antes de MORA-01 daba 0)', async () => {
    const { contrato, obligacion } = await crearEscenario(1, 1.5);
    const pendientes = await service.pendientesPorContrato(contrato.id);
    // mora = 500.000 * 1.5% / 30 * 1 día = 250
    expect(Number(pendientes.find((o) => o.id === obligacion.id)!.valorMoraAcumulada)).toBe(250);
  });

  it('varios días después (6 días de atraso, ejemplo de la auditoría): mora exacta, sin desfase', async () => {
    const { contrato, obligacion } = await crearEscenario(6, 1.5);
    const pendientes = await service.pendientesPorContrato(contrato.id);
    // mora = 500.000 * 1.5% / 30 * 6 días = 1.500
    expect(Number(pendientes.find((o) => o.id === obligacion.id)!.valorMoraAcumulada)).toBe(1500);
  });

  it('porcentaje de mora = 0 produce mora = 0 sin importar los días de atraso', async () => {
    const { contrato, obligacion } = await crearEscenario(30, 0);
    const pendientes = await service.pendientesPorContrato(contrato.id);
    expect(Number(pendientes.find((o) => o.id === obligacion.id)!.valorMoraAcumulada)).toBe(0);
  });
});
