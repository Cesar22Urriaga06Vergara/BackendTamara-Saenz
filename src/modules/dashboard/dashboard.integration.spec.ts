import { DashboardService } from './dashboard.service';
import { EstadoContrato } from '../contratos/entities/contrato.entity';
import { Novedad, EstadoNovedad } from '../novedades/entities/novedad.entity';
import { Obligacion, TipoObligacion, EstadoObligacion } from '../obligaciones/entities/obligacion.entity';
import {
  bootstrapTestApp,
  limpiarBaseDeDatos,
  crearCliente,
  crearInmueble,
  crearContrato,
  TestApp,
} from '../../../test/test-app';

describe('DashboardService (integración)', () => {
  let testApp: TestApp;
  let service: DashboardService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(DashboardService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  describe('metricasOperativas — visible para cualquier rol, sin cifras de dinero', () => {
    it('cuenta solo los contratos ACTIVO', async () => {
      const cliente = await crearCliente(testApp.dataSource);
      const inmueble1 = await crearInmueble(testApp.dataSource);
      const inmueble2 = await crearInmueble(testApp.dataSource);
      await crearContrato(testApp.dataSource, cliente, inmueble1, { estado: EstadoContrato.ACTIVO });
      await crearContrato(testApp.dataSource, cliente, inmueble2, {
        estado: EstadoContrato.TERMINADO,
        fechaFin: new Date(),
      });

      const metricas = await service.metricasOperativas();
      expect(metricas.contratosActivos).toBe(1);
    });

    it('cuenta novedades ABIERTA y EN_SEGUIMIENTO, pero no CERRADA ni ANULADA', async () => {
      const inmueble = await crearInmueble(testApp.dataSource);
      const repo = testApp.dataSource.getRepository(Novedad);
      const base = { inmueble, descripcion: 'desc', fecha: new Date() };
      await repo.save(repo.create({ ...base, estado: EstadoNovedad.ABIERTA }));
      await repo.save(repo.create({ ...base, estado: EstadoNovedad.EN_SEGUIMIENTO }));
      await repo.save(repo.create({ ...base, estado: EstadoNovedad.CERRADA }));
      await repo.save(repo.create({ ...base, estado: EstadoNovedad.ANULADA }));

      const metricas = await service.metricasOperativas();
      expect(metricas.novedadesAbiertas).toBe(2);
    });
  });

  describe('metricasFinancieras — exclusivo Administrador (validado en el controller)', () => {
    it('carteraTotal suma el saldo pendiente (valorOriginal - valorAbonado) de obligaciones abiertas', async () => {
      const cliente = await crearCliente(testApp.dataSource);
      const inmueble = await crearInmueble(testApp.dataSource);
      const contrato = await crearContrato(testApp.dataSource, cliente, inmueble);
      const obligacionRepo = testApp.dataSource.getRepository(Obligacion);

      await obligacionRepo.save(
        obligacionRepo.create({
          contrato,
          tipo: TipoObligacion.CANON,
          concepto: 'Canon agosto',
          periodo: new Date('2026-08-01'),
          fechaVencimiento: new Date('2026-08-05'),
          valorOriginal: 500000,
          valorAbonado: 200000,
          estado: EstadoObligacion.PARCIAL,
        }),
      );
      // Una obligación ya PAGADA no debe sumar a la cartera pendiente. Periodo distinto al de
      // arriba: dos CANON del mismo contrato en el mismo periodo violarían el índice único
      // IDX_obligacion_canon_unico (CONC-01).
      await obligacionRepo.save(
        obligacionRepo.create({
          contrato,
          tipo: TipoObligacion.CANON,
          concepto: 'Canon julio (ya pagado)',
          periodo: new Date('2026-07-01'),
          fechaVencimiento: new Date('2026-07-05'),
          valorOriginal: 300000,
          valorAbonado: 300000,
          estado: EstadoObligacion.PAGADA,
        }),
      );

      const metricas = await service.metricasFinancieras();
      expect(metricas.carteraTotal).toBe(300000); // 500000 - 200000
    });

    it('sin ninguna obligación pendiente, carteraTotal es 0 (no null/undefined)', async () => {
      const metricas = await service.metricasFinancieras();
      expect(metricas.carteraTotal).toBe(0);
      expect(metricas.recaudoMesActual).toBe(0);
    });
  });
});
