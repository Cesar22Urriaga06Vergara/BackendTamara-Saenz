import { DashboardService } from './dashboard.service';
import { RecaudoService } from '../recaudo/recaudo.service';
import { EstadoContrato } from '../contratos/entities/contrato.entity';
import { Novedad, EstadoNovedad } from '../novedades/entities/novedad.entity';
import { Obligacion, TipoObligacion, EstadoObligacion } from '../obligaciones/entities/obligacion.entity';
import { MedioPago } from '../../common/enums/medio-pago.enum';
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
    it('carteraTotal suma el capital pendiente de las obligaciones VENCIDAS, y excluye PAGADA y canon por vencer', async () => {
      await configurarEmpresa(testApp.dataSource, {});
      const cliente = await crearCliente(testApp.dataSource);
      const inmueble = await crearInmueble(testApp.dataSource);
      const contrato = await crearContrato(testApp.dataSource, cliente, inmueble);
      const obligacionRepo = testApp.dataSource.getRepository(Obligacion);

      // Vencida, PARCIAL: 300.000 de capital pendiente (500.000 - 200.000 abonado).
      await crearObligacion(testApp.dataSource, contrato, {
        tipo: TipoObligacion.CANON,
        valorOriginal: 500000,
        diasVencida: 14,
        concepto: 'Canon vencido (parcial)',
      }).then((o) => obligacionRepo.update(o.id, { valorAbonado: 200000, estado: EstadoObligacion.PARCIAL }));

      // PAGADA: no suma.
      await crearObligacion(testApp.dataSource, contrato, {
        tipo: TipoObligacion.NOVEDAD,
        valorOriginal: 150000,
        diasVencida: 4,
        concepto: 'Novedad pagada',
      }).then((o) => obligacionRepo.update(o.id, { valorAbonado: 150000, estado: EstadoObligacion.PAGADA }));

      // Canon de un mes que aún NO vence: NO cuenta como cartera (decisión de negocio).
      const dentroDe20Dias = new Date();
      dentroDe20Dias.setDate(dentroDe20Dias.getDate() + 20);
      await obligacionRepo.save(
        obligacionRepo.create({
          contrato,
          tipo: TipoObligacion.CANON,
          concepto: 'Canon por vencer',
          periodo: dentroDe20Dias,
          fechaVencimiento: dentroDe20Dias,
          valorOriginal: 500000,
          valorAbonado: 0,
          estado: EstadoObligacion.PENDIENTE,
        }),
      );

      const metricas = await service.metricasFinancieras();
      expect(metricas.carteraTotal).toBe(300000); // 500000 - 200000, solo capital
    });

    it('recaudoMesActual excluye los recibos de liquidación de depósito (B4)', async () => {
      await configurarEmpresa(testApp.dataSource, {});
      const recaudo = testApp.app.get(RecaudoService);
      const cliente = await crearCliente(testApp.dataSource);
      const inmueble = await crearInmueble(testApp.dataSource);
      const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, {
        estado: EstadoContrato.TERMINADO,
        fechaFin: new Date(),
        depositoGarantia: 1000000,
        canonValor: 400000,
      });
      await crearObligacion(testApp.dataSource, contrato, {
        tipo: TipoObligacion.CANON,
        valorOriginal: 400000,
        diasVencida: 4,
      });

      // Descuento tipo DEUDA: genera un recibo interno `esLiquidacionDeposito` por 300.000,
      // que NO debe contar como recaudo del mes (nunca movió caja).
      await recaudo.liquidarDeposito(
        contrato.id,
        {
          descuentos: [{ concepto: 'Arriendo debido', valor: 300000, tipo: 'DEUDA' as any }],
          medioPago: MedioPago.EFECTIVO,
        },
        'admin@test.com',
      );

      const metricas = await service.metricasFinancieras();
      expect(metricas.recaudoMesActual).toBe(0);
    });

    it('sin ninguna obligación pendiente, carteraTotal es 0 (no null/undefined)', async () => {
      const metricas = await service.metricasFinancieras();
      expect(metricas.carteraTotal).toBe(0);
      expect(metricas.recaudoMesActual).toBe(0);
    });

    it('recaudoMesActual descuenta el excedente devuelto como cambio (F17)', async () => {
      await configurarEmpresa(testApp.dataSource, {});
      const recaudo = testApp.app.get(RecaudoService);
      const cliente = await crearCliente(testApp.dataSource);
      const inmueble = await crearInmueble(testApp.dataSource);
      const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { canonValor: 400000 });
      await crearObligacion(testApp.dataSource, contrato, {
        tipo: TipoObligacion.CANON,
        valorOriginal: 400000,
        diasVencida: 4,
      });

      // Paga 450.000: 400.000 al canon + 50.000 de cambio devuelto.
      await recaudo.registrarPago(
        { contratoId: contrato.id, detallesPago: [{ medioPago: MedioPago.EFECTIVO, monto: 450000 }] },
        'admin@test.com',
      );

      const metricas = await service.metricasFinancieras();
      expect(metricas.recaudoMesActual).toBe(400000); // 450.000 - 50.000 de cambio
    });
  });
});
