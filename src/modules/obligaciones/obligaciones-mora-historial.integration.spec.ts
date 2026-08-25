import { DataSource } from 'typeorm';
import { ObligacionesService } from './obligaciones.service';
import { TipoObligacion } from './entities/obligacion.entity';
import { HistorialTasaMora } from '../empresa/entities/historial-tasa-mora.entity';
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
 * Valida MORA-02: un cambio de tasa de mora a mitad de la vida de una obligación morosa no
 * debe recalcular retroactivamente los días que ya transcurrieron bajo la tasa anterior — cada
 * tramo de días paga la tasa que efectivamente estuvo vigente durante esos días.
 */
describe('ObligacionesService (integración) — MORA-02', () => {
  let testApp: TestApp;
  let service: ObligacionesService;
  let dataSource: DataSource;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(ObligacionesService);
    dataSource = testApp.dataSource;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(dataSource);
  });

  it('prorratea la mora por tramos cuando la tasa cambia a mitad del período de atraso', async () => {
    // Tasa vigente desde el año 2000: 1.5% mensual, gracia=5 (sembrada por configurarEmpresa).
    await configurarEmpresa(dataSource, { diasGraciaMora: 5, porcentajeMoraMensual: 1.5 });

    const cliente = await crearCliente(dataSource);
    const inmueble = await crearInmueble(dataSource);
    const contrato = await crearContrato(dataSource, cliente, inmueble, { canonValor: 500000 });

    // 10 días de atraso en total: fechaVencimiento queda fijada de forma que hoy sea
    // exactamente el día 10 de mora (ver crearObligacion).
    const obligacion = await crearObligacion(dataSource, contrato, {
      tipo: TipoObligacion.CANON,
      valorOriginal: 500000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 10,
    });

    // La tasa sube a 3.0% empezando hace 3 días: de los 10 días de atraso, los primeros 6
    // pagan 1.5% y los últimos 4 pagan 3.0%.
    const hoy = new Date();
    const vigenteDesdeNuevaTasa = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 3);
    const historialRepo = dataSource.getRepository(HistorialTasaMora);
    await historialRepo.save(
      historialRepo.create({ diasGraciaMora: 5, porcentajeMoraMensual: 3.0, vigenteDesde: vigenteDesdeNuevaTasa }),
    );

    const pendientes = await service.pendientesPorContrato(contrato.id);
    const moraCalculada = Number(pendientes.find((o) => o.id === obligacion.id)!.valorMoraAcumulada);

    // 6 días × (500000×1.5%/30) + 4 días × (500000×3.0%/30) = 6×250 + 4×500 = 1500 + 2000
    expect(moraCalculada).toBe(3500);
  });

  it('sin cambio de tasa, se comporta igual que una tasa plana única', async () => {
    await configurarEmpresa(dataSource, { diasGraciaMora: 5, porcentajeMoraMensual: 1.5 });

    const cliente = await crearCliente(dataSource);
    const inmueble = await crearInmueble(dataSource);
    const contrato = await crearContrato(dataSource, cliente, inmueble, { canonValor: 500000 });
    const obligacion = await crearObligacion(dataSource, contrato, {
      tipo: TipoObligacion.CANON,
      valorOriginal: 500000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 10,
    });

    const pendientes = await service.pendientesPorContrato(contrato.id);
    const moraCalculada = Number(pendientes.find((o) => o.id === obligacion.id)!.valorMoraAcumulada);

    // 10 días × (500000×1.5%/30) = 10×250 = 2500
    expect(moraCalculada).toBe(2500);
  });
});
