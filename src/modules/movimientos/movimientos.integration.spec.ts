import { MovimientosService } from './movimientos.service';
import { Movimiento, OrigenMovimiento, TipoMovimiento } from './entities/movimiento.entity';
import { NovedadesService } from '../novedades/novedades.service';
import { RecaudoService } from '../recaudo/recaudo.service';
import { Novedad, ResponsableSugerido } from '../novedades/entities/novedad.entity';
import { Contrato, EstadoContrato } from '../contratos/entities/contrato.entity';
import { DescuentoDeposito } from '../recaudo/entities/descuento-deposito.entity';
import { MedioPago } from '../../common/enums/medio-pago.enum';
import {
  bootstrapTestApp,
  limpiarBaseDeDatos,
  crearCliente,
  crearInmueble,
  crearContrato,
  configurarEmpresa,
  TestApp,
} from '../../../test/test-app';

/**
 * Valida CONC-02 (doble reverso bajo concurrencia) y CAJA-01 (caja física separada de
 * transferencias) contra la base de datos real de pruebas — transacciones y locks incluidos,
 * no mocks.
 */
describe('MovimientosService (integración)', () => {
  let testApp: TestApp;
  let service: MovimientosService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(MovimientosService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  describe('CAJA-01 — separación de caja física y transferencias', () => {
    it('saldoPorMedio() distingue efectivo, transferencia y sin medio identificado', async () => {
      await service.registrarIngreso({
        origen: OrigenMovimiento.RECAUDO,
        concepto: 'Ingreso efectivo',
        monto: 300000,
        registradoPorEmail: 'test@test.com',
        medioPago: MedioPago.EFECTIVO,
      });
      await service.registrarIngreso({
        origen: OrigenMovimiento.RECAUDO,
        concepto: 'Ingreso transferencia',
        monto: 200000,
        registradoPorEmail: 'test@test.com',
        medioPago: MedioPago.TRANSFERENCIA,
      });
      // Origen NOVEDAD/DEPOSITO aún no capturan medio (ver NOV-01/DEP-01) — debe quedar aparte.
      await service.registrarEgreso({
        origen: OrigenMovimiento.NOVEDAD,
        concepto: 'Egreso sin medio identificado',
        monto: 50000,
        registradoPorEmail: 'test@test.com',
      });

      const saldo = await service.saldoPorMedio();

      expect(saldo.efectivo).toBe(300000);
      expect(saldo.transferencia).toBe(200000);
      expect(saldo.sinMedio).toBe(-50000);
      expect(saldo.total).toBe(300000 + 200000 - 50000);
    });

    it('el reverso de un movimiento conserva el medio del original', async () => {
      const original = await service.registrarIngreso({
        origen: OrigenMovimiento.NOVEDAD,
        concepto: 'Ingreso a reversar',
        monto: 100000,
        registradoPorEmail: 'test@test.com',
        medioPago: MedioPago.TRANSFERENCIA,
        referencia: 'REF-123',
      });

      const reverso = await service.reversarManual(original.id, 'motivo de prueba', 'admin@test.com');

      expect(reverso.medioPago).toBe(MedioPago.TRANSFERENCIA);
      expect(reverso.referencia).toBe('REF-123');
      expect(reverso.tipo).toBe(TipoMovimiento.EGRESO); // contrario al INGRESO original
      expect(reverso.movimientoOriginalId).toBe(original.id);
    });
  });

  describe('CONC-02 — el reverso manual no admite doble reverso bajo concurrencia', () => {
    it('dos solicitudes simultáneas de reverso sobre el mismo movimiento producen exactamente UN reverso', async () => {
      const original = await service.registrarIngreso({
        origen: OrigenMovimiento.NOVEDAD,
        concepto: 'Ingreso a reversar dos veces en paralelo',
        monto: 80000,
        registradoPorEmail: 'test@test.com',
      });

      const resultados = await Promise.allSettled([
        service.reversarManual(original.id, 'primer intento', 'admin@test.com'),
        service.reversarManual(original.id, 'segundo intento', 'admin@test.com'),
      ]);

      const exitosos = resultados.filter((r) => r.status === 'fulfilled');
      const fallidos = resultados.filter((r) => r.status === 'rejected');
      expect(exitosos).toHaveLength(1);
      expect(fallidos).toHaveLength(1);

      const reversos = await testApp.dataSource
        .getRepository(Movimiento)
        .createQueryBuilder('m')
        .where('m.movimientoOriginalId = :id', { id: original.id })
        .getMany();
      expect(reversos).toHaveLength(1);
    });

    it('rechaza reversar un movimiento ya reversado secuencialmente', async () => {
      const original = await service.registrarIngreso({
        origen: OrigenMovimiento.NOVEDAD,
        concepto: 'Ingreso a reversar una vez',
        monto: 40000,
        registradoPorEmail: 'test@test.com',
      });

      await service.reversarManual(original.id, 'primer reverso', 'admin@test.com');
      await expect(service.reversarManual(original.id, 'segundo reverso', 'admin@test.com')).rejects.toThrow(
        'Este movimiento ya fue reversado previamente.',
      );
    });

    it('rechaza reversar un movimiento de origen RECAUDO (debe anularse el recibo, no reversarse aquí)', async () => {
      const original = await service.registrarIngreso({
        origen: OrigenMovimiento.RECAUDO,
        concepto: 'Ingreso de recaudo',
        monto: 40000,
        registradoPorEmail: 'test@test.com',
      });

      await expect(service.reversarManual(original.id, 'motivo', 'admin@test.com')).rejects.toThrow(/recibo asociado/);
    });
  });

  describe('F14 — el reverso manual devuelve la entidad de origen a su estado previo', () => {
    it('NOVEDAD: reversar el pago de un gasto deja la novedad como NO pagada, lista para volver a pagarse', async () => {
      const novedades = testApp.app.get(NovedadesService);
      await configurarEmpresa(testApp.dataSource, {});
      const inmueble = await crearInmueble(testApp.dataSource);
      const novedad = await novedades.crear(
        {
          inmuebleId: inmueble.id,
          descripcion: 'Gasto a reversar',
          fecha: new Date().toISOString().slice(0, 10),
          responsableSugerido: ResponsableSugerido.INMOBILIARIA,
        },
        'recepcion@test.com',
      );
      await novedades.aprobarGastoInmobiliaria(novedad.id, { monto: 90000, concepto: 'Plomería' }, 'admin@test.com');
      await novedades.pagarGastoInmobiliaria(novedad.id, { medioPago: MedioPago.EFECTIVO }, 'admin@test.com');

      const movimiento = await testApp.dataSource
        .getRepository(Movimiento)
        .findOneOrFail({ where: { novedadId: novedad.id, esReverso: false } });

      await service.reversarManual(movimiento.id, 'pago mal registrado', 'admin@test.com');

      const novedadRecargada = await testApp.dataSource
        .getRepository(Novedad)
        .findOneOrFail({ where: { id: novedad.id } });
      expect(novedadRecargada.gastoPagado).toBe(false);
      expect(novedadRecargada.fechaPagoGasto).toBeNull();

      // Se puede volver a pagar.
      const repagada = await novedades.pagarGastoInmobiliaria(
        novedad.id,
        { medioPago: MedioPago.TRANSFERENCIA, referencia: 'REF-9' },
        'admin@test.com',
      );
      expect(repagada.gastoPagado).toBe(true);
    });

    it('DEPOSITO: reversar la devolución deja el contrato como NO liquidado, con el depósito restaurado', async () => {
      const recaudo = testApp.app.get(RecaudoService);
      await configurarEmpresa(testApp.dataSource, {});
      const cliente = await crearCliente(testApp.dataSource);
      const inmueble = await crearInmueble(testApp.dataSource);
      const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, {
        estado: EstadoContrato.TERMINADO,
        fechaFin: new Date(),
        depositoGarantia: 1000000,
      });

      await recaudo.liquidarDeposito(
        contrato.id,
        { descuentos: [{ concepto: 'Aseo', valor: 200000 }], medioPago: MedioPago.EFECTIVO },
        'admin@test.com',
      );

      const movimiento = await testApp.dataSource
        .getRepository(Movimiento)
        .findOneOrFail({ where: { contratoId: contrato.id, origen: OrigenMovimiento.DEPOSITO, esReverso: false } });

      await service.reversarManual(movimiento.id, 'liquidación mal hecha', 'admin@test.com');

      const contratoRecargado = await testApp.dataSource
        .getRepository(Contrato)
        .findOneOrFail({ where: { id: contrato.id } });
      expect(contratoRecargado.depositoLiquidadoEn).toBeNull();
      expect(Number(contratoRecargado.depositoGarantia)).toBe(1000000); // 800.000 devuelto + 200.000 descontado

      const descuentos = await testApp.dataSource
        .getRepository(DescuentoDeposito)
        .find({ where: { contrato: { id: contrato.id } } });
      expect(descuentos).toHaveLength(0);
    });
  });
});
