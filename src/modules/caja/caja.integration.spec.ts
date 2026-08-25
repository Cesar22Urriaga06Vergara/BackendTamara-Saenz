import { CajaService } from './caja.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { OrigenMovimiento } from '../movimientos/entities/movimiento.entity';
import { MedioPago } from '../../common/enums/medio-pago.enum';
import { bootstrapTestApp, limpiarBaseDeDatos, configurarEmpresa, TestApp } from '../../../test/test-app';

/**
 * Valida CAJA-02: el módulo de Caja debe reconciliar el saldo esperado (§15: saldo inicial +
 * ingresos efectivo - egresos efectivo - devoluciones efectivo) contra el conteo físico real,
 * apoyándose EXCLUSIVAMENTE en `Movimiento.medioPago` (CAJA-01) — Caja nunca genera sus propios
 * movimientos, solo reconcilia lo que el resto del sistema ya registró.
 */
describe('CajaService (integración) — CAJA-02', () => {
  let testApp: TestApp;
  let caja: CajaService;
  let movimientos: MovimientosService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    caja = testApp.app.get(CajaService);
    movimientos = testApp.app.get(MovimientosService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  it('calcula el saldo esperado como saldo inicial + ingresos - egresos - devoluciones (solo EFECTIVO)', async () => {
    await configurarEmpresa(testApp.dataSource, { saldoInicialCaja: 1000000 });

    const ingreso = await movimientos.registrarIngreso({
      origen: OrigenMovimiento.MANUAL,
      concepto: 'Ingreso de prueba',
      monto: 500000,
      registradoPorEmail: 'admin@test.com',
      medioPago: MedioPago.EFECTIVO,
    });
    await movimientos.registrarEgreso({
      origen: OrigenMovimiento.MANUAL,
      concepto: 'Egreso de prueba',
      monto: 100000,
      registradoPorEmail: 'admin@test.com',
      medioPago: MedioPago.EFECTIVO,
    });
    // Devolución = reverso de un ingreso (dinero que sale de caja como corrección).
    await movimientos.reversar(ingreso.id, 'devolución al cliente', 'admin@test.com');

    // Movimiento por TRANSFERENCIA: no debe afectar el cálculo de caja física en absoluto.
    await movimientos.registrarIngreso({
      origen: OrigenMovimiento.MANUAL,
      concepto: 'Transferencia que no debe contar',
      monto: 999999,
      registradoPorEmail: 'admin@test.com',
      medioPago: MedioPago.TRANSFERENCIA,
    });

    const saldo = await caja.saldoEsperadoActual();

    expect(Number(saldo.saldoInicial)).toBe(1000000);
    expect(Number(saldo.ingresosEfectivo)).toBe(500000);
    expect(Number(saldo.egresosEfectivo)).toBe(100000);
    expect(Number(saldo.devolucionesEfectivo)).toBe(500000);
    expect(Number(saldo.saldoEsperado)).toBe(900000); // 1.000.000 + 500.000 - 100.000 - 500.000
  });

  it('registrarArqueo congela el saldo esperado y calcula la diferencia contra el conteo físico', async () => {
    await configurarEmpresa(testApp.dataSource, { saldoInicialCaja: 200000 });
    await movimientos.registrarIngreso({
      origen: OrigenMovimiento.MANUAL,
      concepto: 'Ingreso de prueba',
      monto: 300000,
      registradoPorEmail: 'admin@test.com',
      medioPago: MedioPago.EFECTIVO,
    });
    // saldoEsperado = 200.000 + 300.000 = 500.000

    const arqueoConFaltante = await caja.registrarArqueo({ saldoContado: 495000, observaciones: 'faltó revisar' }, 'admin@test.com');
    expect(Number(arqueoConFaltante.saldoEsperado)).toBe(500000);
    expect(Number(arqueoConFaltante.saldoContado)).toBe(495000);
    expect(Number(arqueoConFaltante.diferencia)).toBe(-5000); // faltante

    const arqueoExacto = await caja.registrarArqueo({ saldoContado: 500000 }, 'admin@test.com');
    expect(Number(arqueoExacto.diferencia)).toBe(0);

    const listado = await caja.listar();
    expect(listado.total).toBe(2);

    const recargado = await caja.obtener(arqueoExacto.id);
    expect(Number(recargado.saldoContado)).toBe(500000);
  });
});
