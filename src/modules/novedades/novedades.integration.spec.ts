import { NovedadesService } from './novedades.service';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import { EstadoNovedad, ImpactoFinanciero, Novedad, ResponsableSugerido } from './entities/novedad.entity';
import { CreateNovedadDto } from './dto/create-novedad.dto';
import { MedioPago } from '../../common/enums/medio-pago.enum';
import { Rol } from '../../common/enums/roles.enum';
import { bootstrapTestApp, limpiarBaseDeDatos, crearInmueble, TestApp } from '../../../test/test-app';

/** Valida NOV-01: aprobar un gasto de inmobiliaria ya NO mueve dinero; solo el pago real lo hace. */
describe('NovedadesService (integración) — NOV-01', () => {
  let testApp: TestApp;
  let service: NovedadesService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(NovedadesService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  async function crearNovedadPendiente() {
    const inmueble = await crearInmueble(testApp.dataSource);
    const dto: CreateNovedadDto = {
      inmuebleId: inmueble.id,
      descripcion: 'Fuga de agua',
      fecha: new Date().toISOString().slice(0, 10),
      responsableSugerido: ResponsableSugerido.INMOBILIARIA,
    };
    return service.crear(dto, 'recepcion@test.com');
  }

  it('aprobar el gasto NO genera ningún movimiento de caja (APROBADO ≠ PAGADO)', async () => {
    const novedad = await crearNovedadPendiente();

    const aprobada = await service.aprobarGastoInmobiliaria(
      novedad.id,
      { monto: 200000, concepto: 'Reparación fuga' },
      'admin@test.com',
    );

    expect(aprobada.impactoFinanciero).toBe('GASTO_INMOBILIARIA');
    expect(aprobada.gastoPagado).toBe(false);

    const movimientos = await testApp.dataSource.getRepository(Movimiento).find({ where: { novedadId: novedad.id } });
    expect(movimientos).toHaveLength(0);
  });

  it('el pago real genera EXACTAMENTE un movimiento EGRESO con el medio indicado', async () => {
    const novedad = await crearNovedadPendiente();
    await service.aprobarGastoInmobiliaria(
      novedad.id,
      { monto: 200000, concepto: 'Reparación fuga' },
      'admin@test.com',
    );

    const pagada = await service.pagarGastoInmobiliaria(
      novedad.id,
      { medioPago: MedioPago.TRANSFERENCIA, referencia: 'REF-999' },
      'admin@test.com',
    );

    expect(pagada.gastoPagado).toBe(true);
    expect(pagada.medioPagoGasto).toBe(MedioPago.TRANSFERENCIA);
    expect(pagada.pagadoPorEmail).toBe('admin@test.com');

    const movimientos = await testApp.dataSource.getRepository(Movimiento).find({ where: { novedadId: novedad.id } });
    expect(movimientos).toHaveLength(1);
    expect(Number(movimientos[0].monto)).toBe(200000);
    expect(movimientos[0].medioPago).toBe(MedioPago.TRANSFERENCIA);
    expect(movimientos[0].referencia).toBe('REF-999');
  });

  it('rechaza pagar un gasto que ya fue pagado (no duplica el movimiento)', async () => {
    const novedad = await crearNovedadPendiente();
    await service.aprobarGastoInmobiliaria(
      novedad.id,
      { monto: 200000, concepto: 'Reparación fuga' },
      'admin@test.com',
    );
    await service.pagarGastoInmobiliaria(novedad.id, { medioPago: MedioPago.EFECTIVO }, 'admin@test.com');

    await expect(
      service.pagarGastoInmobiliaria(novedad.id, { medioPago: MedioPago.EFECTIVO }, 'admin@test.com'),
    ).rejects.toThrow('Este gasto ya fue pagado previamente.');

    const movimientos = await testApp.dataSource.getRepository(Movimiento).find({ where: { novedadId: novedad.id } });
    expect(movimientos).toHaveLength(1);
  });

  it('rechaza pagar un gasto que nunca fue aprobado', async () => {
    const novedad = await crearNovedadPendiente();

    await expect(
      service.pagarGastoInmobiliaria(novedad.id, { medioPago: MedioPago.EFECTIVO }, 'admin@test.com'),
    ).rejects.toThrow('Esta novedad no tiene un gasto de inmobiliaria aprobado.');
  });
});

/**
 * Valida RDN-07: Recepcionista no puede concluir (CERRAR o ANULAR) una novedad cuyo impacto
 * financiero sigue PENDIENTE de decidir por Administrador. Antes solo se bloqueaba ANULAR;
 * esta decisión de negocio extiende la misma protección a CERRADA.
 */
describe('NovedadesService (integración) — RDN-07', () => {
  let testApp: TestApp;
  let service: NovedadesService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(NovedadesService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  async function crearNovedadPendiente() {
    const inmueble = await crearInmueble(testApp.dataSource);
    const dto: CreateNovedadDto = {
      inmuebleId: inmueble.id,
      descripcion: 'Fuga de agua',
      fecha: new Date().toISOString().slice(0, 10),
      responsableSugerido: ResponsableSugerido.INMOBILIARIA,
    };
    return service.crear(dto, 'recepcion@test.com');
  }

  it('Recepcionista NO puede cerrar una novedad con impacto financiero pendiente', async () => {
    const novedad = await crearNovedadPendiente();

    await expect(
      service.cambiarEstado(novedad.id, { estado: EstadoNovedad.CERRADA }, Rol.RECEPCIONISTA),
    ).rejects.toThrow('solo el Administrador puede cerrarla o anularla');
  });

  it('Administrador SÍ puede cerrar una novedad con impacto financiero pendiente', async () => {
    const novedad = await crearNovedadPendiente();

    const cerrada = await service.cambiarEstado(novedad.id, { estado: EstadoNovedad.CERRADA }, Rol.ADMINISTRADOR);
    expect(cerrada.estado).toBe(EstadoNovedad.CERRADA);
  });

  it('Recepcionista SÍ puede cerrar una novedad una vez el impacto financiero ya fue resuelto', async () => {
    const novedad = await crearNovedadPendiente();
    // Las dos aprobaciones existentes (`aprobarCargoArrendatario`/`aprobarGastoInmobiliaria`)
    // dejan la novedad ya CERRADA como parte de la aprobación misma, por lo que nunca llegan
    // a `cambiarEstado` en ese estado intermedio. Se actualiza `impactoFinanciero` directamente
    // para aislar y probar SOLO la condición que le interesa a RDN-07 (¿está resuelto o no?),
    // independiente del flujo de aprobación que la haya resuelto.
    await testApp.dataSource
      .getRepository(Novedad)
      .update(novedad.id, { impactoFinanciero: ImpactoFinanciero.CARGO_ARRENDATARIO });

    const cerrada = await service.cambiarEstado(novedad.id, { estado: EstadoNovedad.CERRADA }, Rol.RECEPCIONISTA);
    expect(cerrada.estado).toBe(EstadoNovedad.CERRADA);
  });

  it('Recepcionista sigue sin poder anular con impacto pendiente (comportamiento previo, no debe romperse)', async () => {
    const novedad = await crearNovedadPendiente();

    await expect(
      service.cambiarEstado(novedad.id, { estado: EstadoNovedad.ANULADA }, Rol.RECEPCIONISTA),
    ).rejects.toThrow('solo el Administrador puede cerrarla o anularla');
  });
});

/** Valida el filtro por impactoFinanciero/gastoPagado (Track B5, pantalla Gastos del frontend). */
describe('NovedadesService (integración) — listar con filtro impactoFinanciero/gastoPagado', () => {
  let testApp: TestApp;
  let service: NovedadesService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(NovedadesService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  async function crearNovedadPendiente() {
    const inmueble = await crearInmueble(testApp.dataSource);
    const dto: CreateNovedadDto = {
      inmuebleId: inmueble.id,
      descripcion: 'Gasto de prueba',
      fecha: new Date().toISOString().slice(0, 10),
      responsableSugerido: ResponsableSugerido.INMOBILIARIA,
    };
    return service.crear(dto, 'recepcion@test.com');
  }

  it('impactoFinanciero=GASTO_INMOBILIARIA excluye PENDIENTE y CARGO_ARRENDATARIO', async () => {
    const gasto = await crearNovedadPendiente();
    await service.aprobarGastoInmobiliaria(gasto.id, { monto: 100000, concepto: 'Aseo' }, 'admin@test.com');

    const cargo = await crearNovedadPendiente();
    await testApp.dataSource
      .getRepository(Novedad)
      .update(cargo.id, { impactoFinanciero: ImpactoFinanciero.CARGO_ARRENDATARIO });

    await crearNovedadPendiente(); // queda PENDIENTE

    const resultado = await service.listar({ impactoFinanciero: ImpactoFinanciero.GASTO_INMOBILIARIA });
    expect(resultado.total).toBe(1);
    expect(resultado.data[0].id).toBe(gasto.id);
  });

  it('gastoPagado=false trae solo los gastos aprobados y aún no pagados', async () => {
    const gastoPagado = await crearNovedadPendiente();
    await service.aprobarGastoInmobiliaria(gastoPagado.id, { monto: 50000, concepto: 'Pintura' }, 'admin@test.com');
    await service.pagarGastoInmobiliaria(gastoPagado.id, { medioPago: MedioPago.EFECTIVO }, 'admin@test.com');

    const gastoPendiente = await crearNovedadPendiente();
    await service.aprobarGastoInmobiliaria(gastoPendiente.id, { monto: 70000, concepto: 'Plomería' }, 'admin@test.com');

    const resultado = await service.listar({
      impactoFinanciero: ImpactoFinanciero.GASTO_INMOBILIARIA,
      gastoPagado: false,
    });
    expect(resultado.total).toBe(1);
    expect(resultado.data[0].id).toBe(gastoPendiente.id);
  });
});
