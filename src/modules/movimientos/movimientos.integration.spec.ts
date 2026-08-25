import { MovimientosService } from './movimientos.service';
import { Movimiento, OrigenMovimiento, TipoMovimiento } from './entities/movimiento.entity';
import { MedioPago } from '../../common/enums/medio-pago.enum';
import { bootstrapTestApp, limpiarBaseDeDatos, TestApp } from '../../../test/test-app';

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
});
