import { ContratosService } from './contratos.service';
import { Contrato, EstadoContrato } from './entities/contrato.entity';
import { InmueblesService } from '../inmuebles/inmuebles.service';
import { Inmueble, EstadoInmueble } from '../inmuebles/entities/inmueble.entity';
import { Obligacion, EstadoObligacion, TipoObligacion } from '../obligaciones/entities/obligacion.entity';
import { ObligacionesService } from '../obligaciones/obligaciones.service';
import { Movimiento, OrigenMovimiento, TipoMovimiento } from '../movimientos/entities/movimiento.entity';
import { MedioPago } from '../../common/enums/medio-pago.enum';
import { Rol } from '../../common/enums/roles.enum';
import { TerminarContratoDto } from './dto/terminar-contrato.dto';
import { ReactivarContratoDto } from './dto/reactivar-contrato.dto';
import { CreateContratoDto } from './dto/create-contrato.dto';
import {
  bootstrapTestApp,
  limpiarBaseDeDatos,
  crearCliente,
  crearCodeudor,
  crearInmueble,
  crearContrato,
  TestApp,
} from '../../../test/test-app';

/** Valida CONT-01 (SUSPENDIDO eliminado) y CONT-02 (reactivación real TERMINADO→ACTIVO). */
describe('ContratosService (integración) — CONT-01/CONT-02', () => {
  let testApp: TestApp;
  let service: ContratosService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(ContratosService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  function dtoTerminar(fechaFin: string, motivoTerminacion: string): TerminarContratoDto {
    return { fechaFin, motivoTerminacion };
  }

  function dtoReactivar(motivo: string): ReactivarContratoDto {
    return { motivo };
  }

  async function recargarContrato(id: string) {
    return testApp.dataSource.getRepository(Contrato).findOneByOrFail({ id });
  }

  async function recargarInmueble(id: string) {
    return testApp.dataSource.getRepository(Inmueble).findOneByOrFail({ id });
  }

  it('CONT-01: el enum de estado solo admite ACTIVO/TERMINADO (SUSPENDIDO ya no existe)', () => {
    expect(Object.values(EstadoContrato)).toEqual(['ACTIVO', 'TERMINADO']);
  });

  it('CONT-02: rechaza reactivar un contrato que no está TERMINADO', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.ACTIVO });

    await expect(service.reactivar(contrato.id, dtoReactivar('motivo'), 'admin@test.com')).rejects.toThrow(
      'Solo un contrato TERMINADO puede reactivarse.',
    );
  });

  it('CONT-02: reactivar un contrato TERMINADO lo vuelve ACTIVO, reocupa el inmueble y registra el historial', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.DISPONIBLE });
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, {
      estado: EstadoContrato.TERMINADO,
      fechaFin: new Date('2026-01-15'),
      motivoTerminacion: 'Cliente se mudó',
    });

    const reactivado = await service.reactivar(
      contrato.id,
      dtoReactivar('El cliente decidió continuar'),
      'admin@test.com',
    );

    expect(reactivado.estado).toBe(EstadoContrato.ACTIVO);

    const inmuebleRecargado = await recargarInmueble(inmueble.id);
    expect(inmuebleRecargado.estado).toBe(EstadoInmueble.OCUPADO);

    // La fecha/motivo de la terminación original se conserva — NO se borra (§6.6).
    const contratoRecargado = await recargarContrato(contrato.id);
    expect(contratoRecargado.motivoTerminacion).toBe('Cliente se mudó');
    expect(contratoRecargado.fechaFin).not.toBeNull();

    const historial = await service.historial(contrato.id);
    expect(historial).toHaveLength(1);
    expect(historial[0].estadoAnterior).toBe(EstadoContrato.TERMINADO);
    expect(historial[0].estadoNuevo).toBe(EstadoContrato.ACTIVO);
    expect(historial[0].motivo).toBe('El cliente decidió continuar');
    expect(historial[0].usuarioEmail).toBe('admin@test.com');
  });

  it('REACT-01: reactivar un contrato TERMINADO sin cánones genera sus obligaciones en la misma operación', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, {
      estado: EstadoInmueble.DISPONIBLE,
      canonValor: 500000,
    });
    const hoy = new Date();
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, {
      estado: EstadoContrato.TERMINADO,
      // Mes 1 del día ⇒ sin overflow de `setMonth`: contrato que arrancó hace 2 meses.
      fechaInicio: new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1),
      fechaFin: new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1),
      motivoTerminacion: 'Terminación previa',
    });

    const canonRepo = testApp.dataSource.getRepository(Obligacion);
    // Precondición: el contrato no tiene cánones (el bug era que reactivar no los generaba,
    // dejándolo sin obligación pendiente hasta la corrida del CRON).
    expect(await canonRepo.count({ where: { contrato: { id: contrato.id }, tipo: TipoObligacion.CANON } })).toBe(0);

    await service.reactivar(contrato.id, dtoReactivar('El cliente decidió continuar'), 'admin@test.com');

    const canones = await canonRepo.find({
      where: { contrato: { id: contrato.id }, tipo: TipoObligacion.CANON },
    });
    // 2 meses previos + mes en curso + 2 de anticipación (horizonte default 3) = 5.
    expect(canones.length).toBe(5);
    expect(canones.every((c) => c.estado === EstadoObligacion.PENDIENTE)).toBe(true);

    // Idempotente: volver a generar (misma clave única de canon) no duplica nada.
    await testApp.app.get(ObligacionesService).generarCanonesParaContrato(contrato.id);
    expect(await canonRepo.count({ where: { contrato: { id: contrato.id }, tipo: TipoObligacion.CANON } })).toBe(5);
  });

  it('CONT-02: rechaza reactivar si el inmueble ya está ocupado por otro contrato activo', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.OCUPADO });
    const contratoTerminado = await crearContrato(testApp.dataSource, cliente, inmueble, {
      estado: EstadoContrato.TERMINADO,
      fechaFin: new Date(),
      motivoTerminacion: 'motivo',
    });
    // Otro contrato ACTIVO ya ocupa el mismo inmueble mientras tanto.
    await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.ACTIVO });

    await expect(service.reactivar(contratoTerminado.id, dtoReactivar('motivo'), 'admin@test.com')).rejects.toThrow(
      'El inmueble ya está ocupado por otro contrato activo; no se puede reactivar.',
    );
  });

  it('congela el canon del contrato y evita que cambios futuros del inmueble alteren la obligación histórica', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const codeudor = await crearCodeudor(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { canonValor: 500000, estado: EstadoInmueble.DISPONIBLE });

    const contratoCreado = await service.crear(
      {
        clienteId: cliente.id,
        codeudorIds: [codeudor.id],
        inmuebleId: inmueble.id,
        fechaInicio: '2026-09-01',
      },
      'admin@test.com',
    );

    const contrato = await recargarContrato(contratoCreado.id);

    const obligacionesAntes = await testApp.dataSource.getRepository(Obligacion).find({
      where: { contrato: { id: contrato.id } },
      order: { fechaVencimiento: 'ASC' },
    });

    expect(obligacionesAntes.length).toBeGreaterThan(0);
    expect(Number(obligacionesAntes[0].valorOriginal)).toBe(500000);

    await testApp.app.get(InmueblesService).actualizar(inmueble.id, { canonValor: 700000 }, Rol.ADMINISTRADOR);

    const contratoRecargado = await recargarContrato(contrato.id);
    expect(Number(contratoRecargado.canonValor)).toBe(500000);

    const obligacionesDespues = await testApp.dataSource.getRepository(Obligacion).find({
      where: { contrato: { id: contrato.id } },
      order: { fechaVencimiento: 'ASC' },
    });
    expect(obligacionesDespues.length).toBeGreaterThan(0);
    expect(Number(obligacionesDespues[0].valorOriginal)).toBe(500000);
  });

  it('CONT-02: el historial conserva TODOS los ciclos terminar→reactivar→terminar, sin perder el primero', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.OCUPADO });
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.ACTIVO });

    await service.terminar(contrato.id, dtoTerminar('2026-02-01', 'primer motivo de terminación'), 'admin@test.com');
    await service.reactivar(contrato.id, dtoReactivar('primer motivo de reactivación'), 'admin@test.com');
    await service.terminar(contrato.id, dtoTerminar('2026-03-01', 'segundo motivo de terminación'), 'admin@test.com');

    const historial = await service.historial(contrato.id);
    expect(historial).toHaveLength(3);
    expect(historial[0].motivo).toBe('primer motivo de terminación');
    expect(historial[1].motivo).toBe('primer motivo de reactivación');
    expect(historial[2].motivo).toBe('segundo motivo de terminación');

    // Las columnas del contrato solo reflejan el ÚLTIMO evento — es esperado; lo que
    // garantiza que el primer ciclo no se pierda es el historial completo de arriba.
    const contratoRecargado = await recargarContrato(contrato.id);
    expect(contratoRecargado.motivoTerminacion).toBe('segundo motivo de terminación');
  });
});

/**
 * Valida BD-03: el índice único generado (`claveUnicaInmuebleActivo`) es la garantía
 * ESTRUCTURAL contra dos contratos ACTIVO sobre el mismo inmueble — se prueba insertando
 * directamente por repositorio (bypass total de `ContratosService.crear()` y su lock
 * aplicativo) para confirmar que la propia base de datos, y no solo el service, rechaza la
 * duplicación.
 */
describe('ContratosService (integración) — BD-03', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  it('la base de datos rechaza un segundo contrato ACTIVO sobre el mismo inmueble, incluso sin pasar por el service', async () => {
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.OCUPADO });
    const cliente1 = await crearCliente(testApp.dataSource);
    const cliente2 = await crearCliente(testApp.dataSource);

    await crearContrato(testApp.dataSource, cliente1, inmueble, { estado: EstadoContrato.ACTIVO });

    await expect(
      crearContrato(testApp.dataSource, cliente2, inmueble, { estado: EstadoContrato.ACTIVO }),
    ).rejects.toThrow();
  });

  it('permite varios contratos TERMINADO históricos sobre el mismo inmueble sin chocar entre sí ni con uno ACTIVO', async () => {
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.OCUPADO });
    const cliente1 = await crearCliente(testApp.dataSource);
    const cliente2 = await crearCliente(testApp.dataSource);
    const cliente3 = await crearCliente(testApp.dataSource);

    await crearContrato(testApp.dataSource, cliente1, inmueble, {
      estado: EstadoContrato.TERMINADO,
      fechaFin: new Date(),
    });
    await crearContrato(testApp.dataSource, cliente2, inmueble, {
      estado: EstadoContrato.TERMINADO,
      fechaFin: new Date(),
    });
    const activo = await crearContrato(testApp.dataSource, cliente3, inmueble, { estado: EstadoContrato.ACTIVO });

    expect(activo.id).toBeTruthy();
    const total = await testApp.dataSource.getRepository(Contrato).count({ where: { inmueble: { id: inmueble.id } } });
    expect(total).toBe(3);
  });
});

/**
 * Valida CONT-04: si no se envía `diaPago`, debe derivarse del día de `fechaInicio` (§6.1),
 * en vez de quedar en un valor fijo. Prueba explícitamente que la derivación usa los
 * componentes del string de fecha, no `new Date(...).getDate()` (mismo mecanismo de bug que
 * MORA-01: en una zona horaria negativa esa combinación puede devolver el día anterior).
 */
describe('ContratosService (integración) — CONT-04', () => {
  let testApp: TestApp;
  let service: ContratosService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(ContratosService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  async function dtoBase(fechaInicio: string): Promise<CreateContratoDto> {
    const cliente = await crearCliente(testApp.dataSource);
    const codeudor = await crearCodeudor(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.DISPONIBLE });
    return {
      clienteId: cliente.id,
      codeudorIds: [codeudor.id],
      inmuebleId: inmueble.id,
      fechaInicio,
    };
  }

  it('sin diaPago explícito, lo deriva del día de fechaInicio', async () => {
    const contrato = await service.crear(await dtoBase('2026-08-21'), 'admin@test.com');
    expect(contrato.diaPago).toBe(21);
  });

  it('deriva correctamente el día 1 de un mes (caso límite de zona horaria)', async () => {
    const contrato = await service.crear(await dtoBase('2026-09-01'), 'admin@test.com');
    expect(contrato.diaPago).toBe(1); // si hubiera el bug de MORA-01, esto daría 31 (agosto)
  });

  it('con diaPago explícito, respeta el valor enviado en vez de derivarlo', async () => {
    const dto = await dtoBase('2026-08-21');
    dto.diaPago = 10;
    const contrato = await service.crear(dto, 'admin@test.com');
    expect(contrato.diaPago).toBe(10);
  });

  it('genera el canon del contrato desde fechaInicio hasta el horizonte al crearlo (no queda sin obligaciones)', async () => {
    const hoy = new Date();
    // Mes 1 del día ⇒ sin overflow de `setMonth`: contrato que arrancó hace 3 meses.
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1);
    const fechaInicio = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}-05`;

    const contrato = await service.crear(await dtoBase(fechaInicio), 'admin@test.com');

    const canones = await testApp.dataSource
      .getRepository(Obligacion)
      .find({ where: { contrato: { id: contrato.id }, tipo: TipoObligacion.CANON }, order: { periodo: 'ASC' } });

    // 3 meses vencidos + mes en curso + 2 de anticipación (horizonte default 3) = 6.
    expect(canones.length).toBe(6);
    // Sin huecos: cada periodo consecutivo un mes después del anterior. `periodo`/`fechaVencimiento`
    // se leen como string "YYYY-MM-DD" (type: 'date'); se comparan como texto, sin `new Date()`.
    const mesDe = (p: unknown) => String(p).slice(0, 7);
    for (let i = 1; i < canones.length; i++) {
      const [ya, ym] = mesDe(canones[i - 1].periodo)
        .split('-')
        .map(Number);
      const [aa, am] = mesDe(canones[i].periodo).split('-').map(Number);
      expect((aa - ya) * 12 + (am - ym)).toBe(1);
    }
    // El primer canon nunca vence antes del inicio del contrato (LB-7).
    expect(String(canones[0].fechaVencimiento).slice(0, 10) >= fechaInicio).toBe(true);
  });

  it('B5: al recibir depósito de garantía genera un Movimiento INGRESO origen DEPOSITO con su medio de pago', async () => {
    const dto = await dtoBase('2026-08-21');
    dto.depositoGarantia = 800000;
    dto.medioPagoDeposito = MedioPago.TRANSFERENCIA;
    dto.referenciaDeposito = 'REF-DEP-001';

    const contrato = await service.crear(dto, 'admin@test.com');

    const ingreso = await testApp.dataSource.getRepository(Movimiento).findOneOrFail({
      where: { contratoId: contrato.id, origen: OrigenMovimiento.DEPOSITO },
    });
    expect(ingreso.tipo).toBe(TipoMovimiento.INGRESO);
    expect(Number(ingreso.monto)).toBe(800000);
    expect(ingreso.medioPago).toBe(MedioPago.TRANSFERENCIA);
    expect(ingreso.referencia).toBe('REF-DEP-001');
  });

  it('B5: rechaza crear un contrato con depósito de garantía si no se indica el medio de pago', async () => {
    const dto = await dtoBase('2026-08-21');
    dto.depositoGarantia = 500000;

    await expect(service.crear(dto, 'admin@test.com')).rejects.toThrow('medio de pago');
  });

  it('sin depósito de garantía no genera ningún movimiento', async () => {
    const contrato = await service.crear(await dtoBase('2026-08-21'), 'admin@test.com');
    const movimientos = await testApp.dataSource
      .getRepository(Movimiento)
      .count({ where: { contratoId: contrato.id } });
    expect(movimientos).toBe(0);
  });
});

/**
 * Valida RDN-04 / CONT-05: al terminar un contrato, el canon ya generado por adelantado
 * para periodos POSTERIORES a la fecha de fin se anula automáticamente (sin importar cuál
 * sea el motivo de terminación) — pero solo si sigue PENDIENTE sin ningún abono. Una
 * obligación con abono parcial no debe tocarse: representa deuda real ya generada.
 */
describe('ContratosService (integración) — CONT-05', () => {
  let testApp: TestApp;
  let service: ContratosService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(ContratosService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  async function crearCanon(
    contrato: Contrato,
    fechaVencimiento: Date,
    overrides: Partial<Obligacion> = {},
  ): Promise<Obligacion> {
    const repo = testApp.dataSource.getRepository(Obligacion);
    return repo.save(
      repo.create({
        contrato,
        tipo: TipoObligacion.CANON,
        concepto: 'Canon de prueba',
        periodo: fechaVencimiento,
        fechaVencimiento,
        valorOriginal: 500000,
        estado: EstadoObligacion.PENDIENTE,
        ...overrides,
      }),
    );
  }

  it('anula el canon PENDIENTE con vencimiento posterior a la fecha de terminación', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.OCUPADO });
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.ACTIVO });

    const canonFuturo = await crearCanon(contrato, new Date('2026-06-01'));

    await service.terminar(
      contrato.id,
      { fechaFin: '2026-05-01', motivoTerminacion: 'Cliente se mudó' },
      'admin@test.com',
    );

    const recargado = await testApp.dataSource.getRepository(Obligacion).findOneByOrFail({ id: canonFuturo.id });
    expect(recargado.estado).toBe(EstadoObligacion.ANULADA);
    expect(recargado.motivoAnulacion).toContain('Contrato terminado');
  });

  it('NO anula el canon con vencimiento anterior o igual a la fecha de terminación (deuda real ya generada)', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.OCUPADO });
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.ACTIVO });

    const canonVencido = await crearCanon(contrato, new Date('2026-04-01'));

    await service.terminar(contrato.id, { fechaFin: '2026-05-01', motivoTerminacion: 'motivo' }, 'admin@test.com');

    const recargado = await testApp.dataSource.getRepository(Obligacion).findOneByOrFail({ id: canonVencido.id });
    expect(recargado.estado).toBe(EstadoObligacion.PENDIENTE);
  });

  it('NO anula el canon futuro si ya tiene un abono parcial (no oculta deuda real, §8.3)', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.OCUPADO });
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.ACTIVO });

    const canonParcial = await crearCanon(contrato, new Date('2026-06-01'), {
      estado: EstadoObligacion.PARCIAL,
      valorAbonado: 100000,
    });

    await service.terminar(contrato.id, { fechaFin: '2026-05-01', motivoTerminacion: 'motivo' }, 'admin@test.com');

    const recargado = await testApp.dataSource.getRepository(Obligacion).findOneByOrFail({ id: canonParcial.id });
    expect(recargado.estado).toBe(EstadoObligacion.PARCIAL);
  });
});
