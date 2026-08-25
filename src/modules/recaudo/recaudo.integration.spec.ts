import { RecaudoService } from './recaudo.service';
import { ObligacionesService } from '../obligaciones/obligaciones.service';
import { TipoObligacion, EstadoObligacion } from '../obligaciones/entities/obligacion.entity';
import { Movimiento, OrigenMovimiento } from '../movimientos/entities/movimiento.entity';
import { Contrato, EstadoContrato } from '../contratos/entities/contrato.entity';
import { DescuentoDeposito } from './entities/descuento-deposito.entity';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { AnularReciboDto } from './dto/anular-recibo.dto';
import { LiquidarDepositoDto } from './dto/liquidar-deposito.dto';
import { MedioPago } from '../../common/enums/medio-pago.enum';
import {
  bootstrapTestApp,
  limpiarBaseDeDatos,
  crearCliente,
  crearInmueble,
  crearContrato,
  configurarEmpresa,
  crearObligacion,
  recargarObligacion,
  TestApp,
} from '../../../test/test-app';

/**
 * Valida RECAUDO-01 (orden Canon → Novedad → Mora, mora realmente cobrable) y, de paso,
 * CAJA-01 (un movimiento por medio de pago en pagos mixtos) dentro del mismo flujo real de
 * recaudo — contra la base de datos de pruebas, con las transacciones/locks reales.
 */
describe('RecaudoService (integración) — RECAUDO-01', () => {
  let testApp: TestApp;
  let recaudo: RecaudoService;
  let obligaciones: ObligacionesService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    recaudo = testApp.app.get(RecaudoService);
    obligaciones = testApp.app.get(ObligacionesService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  function dtoPago(contratoId: string, detallesPago: RegistrarPagoDto['detallesPago']): RegistrarPagoDto {
    return { contratoId, detallesPago };
  }

  function dtoAnular(motivo: string): AnularReciboDto {
    return { motivo };
  }

  async function obtenerContrato(id: string): Promise<Contrato> {
    return testApp.dataSource.getRepository(Contrato).findOneByOrFail({ id });
  }

  /** Arma un contrato con una obligación CANON (sin mora, recién vencida) y una NOVEDAD con mora congelable. */
  async function armarEscenarioOficial() {
    // % y gracia elegidos para que la novedad acumule una mora exacta y verificable:
    // saldo 150.000 * 3% / 30 * 10 días = 1.500.
    await configurarEmpresa(testApp.dataSource, { diasGraciaMora: 5, porcentajeMoraMensual: 3 });
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { canonValor: 400000 });

    const canon = await crearObligacion(testApp.dataSource, contrato, {
      tipo: TipoObligacion.CANON,
      valorOriginal: 400000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 0, // recién vencido, dentro de gracia -> mora = 0
    });
    const novedad = await crearObligacion(testApp.dataSource, contrato, {
      tipo: TipoObligacion.NOVEDAD,
      valorOriginal: 150000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 10, // -> mora = 150000*0.03/30*10 = 1.500
    });

    return { contrato, canon, novedad };
  }

  it('reproduce el ejemplo del §10: Canon → Novedad, Mora aplicada $0 cuando el dinero solo alcanza para capital', async () => {
    const { contrato, canon, novedad } = await armarEscenarioOficial();

    // Pago = exactamente Canon(400.000) + parte de Novedad(100.000) = 500.000; no sobra para mora.
    const recibo = await recaudo.registrarPago(
      dtoPago(contrato.id, [{ medioPago: MedioPago.EFECTIVO, monto: 500000 }]),
      'admin@test.com',
    );

    const canonRecargado = await recargarObligacion(testApp.dataSource, canon.id);
    const novedadRecargada = await recargarObligacion(testApp.dataSource, novedad.id);

    expect(Number(canonRecargado.valorAbonado)).toBe(400000);
    expect(canonRecargado.estado).toBe(EstadoObligacion.PAGADA);

    expect(Number(novedadRecargada.valorAbonado)).toBe(100000); // Novedad pendiente: 50.000
    expect(novedadRecargada.estado).toBe(EstadoObligacion.PARCIAL);
    expect(Number(novedadRecargada.valorMoraPagada)).toBe(0); // Mora aplicada: $0
    expect(Number(novedadRecargada.valorMoraAcumulada)).toBe(1500); // Mora congelada, pendiente

    expect(Number(recibo.excedente)).toBe(0);
  });

  it('con dinero de sobra, aplica Canon → Novedad → Mora en ese orden, y el resto se devuelve de inmediato como cambio (RDN-01)', async () => {
    const { contrato, canon, novedad } = await armarEscenarioOficial();

    // Canon(400.000) + Novedad(150.000) + Mora(1.500) + 1.000 de excedente = 552.500
    const recibo = await recaudo.registrarPago(
      dtoPago(contrato.id, [{ medioPago: MedioPago.EFECTIVO, monto: 552500 }]),
      'admin@test.com',
    );

    const canonRecargado = await recargarObligacion(testApp.dataSource, canon.id);
    const novedadRecargada = await recargarObligacion(testApp.dataSource, novedad.id);

    expect(canonRecargado.estado).toBe(EstadoObligacion.PAGADA);
    expect(novedadRecargada.estado).toBe(EstadoObligacion.PAGADA); // capital saldado
    expect(Number(novedadRecargada.valorMoraPagada)).toBe(1500); // mora COBRADA de verdad
    expect(Number(novedadRecargada.valorMoraAcumulada)).toBe(1500);

    // Por defecto (sin pedirlo expresamente) el excedente NO queda como saldo a favor.
    const contratoActualizado = await obtenerContrato(contrato.id);
    expect(Number(contratoActualizado.saldoAFavor)).toBe(0);
    expect(recibo.excedenteComoSaldoFavor).toBe(false);

    // En su lugar, se devuelve de inmediato como un movimiento de "cambio".
    const cambio = await testApp.dataSource.getRepository(Movimiento).findOneOrFail({
      where: { reciboId: recibo.id, esReverso: false, concepto: `Cambio entregado — recibo ${recibo.consecutivo}` },
    });
    expect(Number(cambio.monto)).toBe(1000);
    expect(cambio.medioPago).toBe(MedioPago.EFECTIVO);
  });

  it('si el cliente pide expresamente dejar el excedente como abono adelantado, queda como saldo a favor (no como cambio)', async () => {
    const { contrato, canon, novedad } = await armarEscenarioOficial();

    const recibo = await recaudo.registrarPago(
      {
        contratoId: contrato.id,
        detallesPago: [{ medioPago: MedioPago.EFECTIVO, monto: 552500 }],
        dejarExcedenteComoSaldoFavor: true,
      },
      'admin@test.com',
    );

    await recargarObligacion(testApp.dataSource, canon.id);
    await recargarObligacion(testApp.dataSource, novedad.id);

    expect(recibo.excedenteComoSaldoFavor).toBe(true);
    const contratoActualizado = await obtenerContrato(contrato.id);
    expect(Number(contratoActualizado.saldoAFavor)).toBe(1000);

    const cambio = await testApp.dataSource
      .getRepository(Movimiento)
      .findOne({ where: { reciboId: recibo.id, concepto: `Cambio entregado — recibo ${recibo.consecutivo}` } });
    expect(cambio).toBeNull(); // no se devuelve cambio: quedó como saldo a favor
  });

  it('una obligación con capital PAGADA pero mora sin cobrar sigue apareciendo como pendiente (no desaparece)', async () => {
    const { contrato, novedad } = await armarEscenarioOficial();

    // Paga TODO el capital (canon 400k + novedad 150k = 550k) pero nada de mora.
    await recaudo.registrarPago(
      dtoPago(contrato.id, [{ medioPago: MedioPago.EFECTIVO, monto: 550000 }]),
      'admin@test.com',
    );

    const novedadRecargada = await recargarObligacion(testApp.dataSource, novedad.id);
    expect(novedadRecargada.estado).toBe(EstadoObligacion.PAGADA); // capital: pagada
    expect(Number(novedadRecargada.valorMoraPagada)).toBe(0); // mora: sin cobrar

    const pendientes = await obligaciones.pendientesPorContrato(contrato.id);
    const novedadEnCartera = pendientes.find((o) => o.id === novedad.id);
    expect(novedadEnCartera).toBeDefined(); // NO debe desaparecer de la cartera
    expect(Number(novedadEnCartera!.valorMoraAcumulada)).toBe(1500); // mora pendiente visible
  });

  it('paga Canon íntegro ANTES que una Novedad mucho más antigua (prueba directa de que ya NO es FIFO por fecha)', async () => {
    await configurarEmpresa(testApp.dataSource, { diasGraciaMora: 5, porcentajeMoraMensual: 1.5 });
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { canonValor: 300000 });

    // Novedad MUCHO más vencida que el canon (60 días de atraso vs. recién vencido).
    const novedadVieja = await crearObligacion(testApp.dataSource, contrato, {
      tipo: TipoObligacion.NOVEDAD,
      valorOriginal: 200000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 60,
    });
    const canonReciente = await crearObligacion(testApp.dataSource, contrato, {
      tipo: TipoObligacion.CANON,
      valorOriginal: 300000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 0,
    });

    // Solo alcanza para el canon completo, nada para la novedad.
    await recaudo.registrarPago(
      dtoPago(contrato.id, [{ medioPago: MedioPago.EFECTIVO, monto: 300000 }]),
      'admin@test.com',
    );

    const canonRecargado = await recargarObligacion(testApp.dataSource, canonReciente.id);
    const novedadRecargada = await recargarObligacion(testApp.dataSource, novedadVieja.id);

    // Si el motor siguiera ordenando por fecha (comportamiento anterior a RECAUDO-01), el
    // pago se habría aplicado a la novedad (mucho más antigua) y el canon seguiría intacto.
    expect(canonRecargado.estado).toBe(EstadoObligacion.PAGADA);
    expect(Number(novedadRecargada.valorAbonado)).toBe(0);
    expect(novedadRecargada.estado).toBe(EstadoObligacion.PENDIENTE);
  });

  it('CAJA-01: un pago mixto genera un movimiento por cada medio, no uno agregado', async () => {
    const { contrato } = await armarEscenarioOficial();

    const recibo = await recaudo.registrarPago(
      dtoPago(contrato.id, [
        { medioPago: MedioPago.EFECTIVO, monto: 300000 },
        { medioPago: MedioPago.TRANSFERENCIA, monto: 200000, referencia: 'REF-777' },
      ]),
      'admin@test.com',
    );

    const movimientos = await testApp.dataSource
      .getRepository(Movimiento)
      .find({ where: { reciboId: recibo.id }, order: { monto: 'DESC' } });

    expect(movimientos).toHaveLength(2);
    expect(movimientos[0].medioPago).toBe(MedioPago.EFECTIVO);
    expect(Number(movimientos[0].monto)).toBe(300000);
    expect(movimientos[1].medioPago).toBe(MedioPago.TRANSFERENCIA);
    expect(Number(movimientos[1].monto)).toBe(200000);
    expect(movimientos[1].referencia).toBe('REF-777');
  });

  it('anular el recibo revierte capital Y mora, dejando la obligación como si el pago nunca hubiera ocurrido (excedente dejado como saldo a favor)', async () => {
    const { contrato, canon, novedad } = await armarEscenarioOficial();

    const recibo = await recaudo.registrarPago(
      {
        contratoId: contrato.id,
        detallesPago: [{ medioPago: MedioPago.EFECTIVO, monto: 552500 }],
        dejarExcedenteComoSaldoFavor: true,
      },
      'admin@test.com',
    );

    await recaudo.anular(recibo.id, dtoAnular('error de digitación'), 'admin@test.com');

    const canonRecargado = await recargarObligacion(testApp.dataSource, canon.id);
    const novedadRecargada = await recargarObligacion(testApp.dataSource, novedad.id);

    expect(Number(canonRecargado.valorAbonado)).toBe(0);
    expect(canonRecargado.estado).toBe(EstadoObligacion.PENDIENTE);
    expect(Number(novedadRecargada.valorAbonado)).toBe(0);
    expect(Number(novedadRecargada.valorMoraPagada)).toBe(0); // la mora COBRADA también se revierte
    expect(novedadRecargada.estado).toBe(EstadoObligacion.PENDIENTE);

    const contratoActualizado = await obtenerContrato(contrato.id);
    expect(Number(contratoActualizado.saldoAFavor)).toBe(0); // el crédito por excedente también se revierte

    const movimientos = await testApp.dataSource.getRepository(Movimiento).find({ where: { reciboId: recibo.id } });
    expect(movimientos.some((m) => m.esReverso)).toBe(true); // el original NUNCA se borra, se contrapartida
  });

  it('anular el recibo también revierte el cambio entregado (RDN-01), cuando el excedente NO se dejó como saldo a favor', async () => {
    const { contrato } = await armarEscenarioOficial();

    const recibo = await recaudo.registrarPago(
      dtoPago(contrato.id, [{ medioPago: MedioPago.EFECTIVO, monto: 552500 }]),
      'admin@test.com',
    );

    await recaudo.anular(recibo.id, dtoAnular('error de digitación'), 'admin@test.com');

    const movimientos = await testApp.dataSource.getRepository(Movimiento).find({ where: { reciboId: recibo.id } });
    const cambioOriginal = movimientos.find((m) => m.concepto === `Cambio entregado — recibo ${recibo.consecutivo}`);
    expect(cambioOriginal).toBeDefined();

    const reversoDelCambio = movimientos.find((m) => m.movimientoOriginalId === cambioOriginal!.id);
    expect(reversoDelCambio).toBeDefined(); // el cambio entregado también se recupera al anular
    expect(reversoDelCambio!.esReverso).toBe(true);
  });
});

/**
 * Valida RECAUDO-03: el recibo (vía `RecaudoService.obtener`, fuente única también del PDF)
 * debe poder mostrar a qué obligación/concepto se aplicó cada monto, con período y saldo
 * posterior — antes `obtener()` no cargaba `AplicacionPago` y el recibo era indistinguible de
 * un simple total por medio de pago, sin explicar cómo se aplicó el dinero (§20).
 */
describe('RecaudoService (integración) — RECAUDO-03', () => {
  let testApp: TestApp;
  let recaudo: RecaudoService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    recaudo = testApp.app.get(RecaudoService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  it('obtener() incluye el desglose de aplicación con concepto, período y saldo posterior por obligación', async () => {
    await configurarEmpresa(testApp.dataSource, { diasGraciaMora: 5, porcentajeMoraMensual: 3 });
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { canonValor: 400000 });

    const canon = await crearObligacion(testApp.dataSource, contrato, {
      tipo: TipoObligacion.CANON,
      valorOriginal: 400000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 0,
    });
    const novedad = await crearObligacion(testApp.dataSource, contrato, {
      tipo: TipoObligacion.NOVEDAD,
      valorOriginal: 150000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 10, // mora = 150000*0.03/30*10 = 1.500
    });

    // Canon(400.000) + Novedad(150.000) + Mora(1.500), exacto, sin excedente.
    const recibo = await recaudo.registrarPago(
      { contratoId: contrato.id, detallesPago: [{ medioPago: MedioPago.EFECTIVO, monto: 551500 }] },
      'admin@test.com',
    );

    const reciboCompleto = await recaudo.obtener(recibo.id);

    expect(reciboCompleto.aplicaciones).toHaveLength(3); // canon-capital, novedad-capital, novedad-mora

    const aplicacionCanon = reciboCompleto.aplicaciones.find((a) => a.obligacion.id === canon.id);
    expect(aplicacionCanon).toBeDefined();
    expect(aplicacionCanon!.obligacion.concepto).toBeTruthy(); // concepto de la obligación viaja en el recibo
    expect(aplicacionCanon!.obligacion.periodo).toBeTruthy(); // período viaja en el recibo
    expect(Number(aplicacionCanon!.montoAplicado)).toBe(400000);
    expect(Number(aplicacionCanon!.saldoPosterior)).toBe(0); // canon quedó totalmente pagado

    const aplicacionNovedadMora = reciboCompleto.aplicaciones.find(
      (a) => a.obligacion.id === novedad.id && a.concepto === 'MORA',
    );
    expect(aplicacionNovedadMora).toBeDefined();
    expect(Number(aplicacionNovedadMora!.montoAplicado)).toBe(1500);
    expect(Number(aplicacionNovedadMora!.saldoPosterior)).toBe(0); // mora quedó totalmente cobrada
  });
});

/**
 * Valida DEP-01: la liquidación del depósito debe aceptar una lista de descuentos con
 * concepto/valor propios (no un único número agregado) y exigir medio de pago cuando
 * efectivamente queda saldo por devolver.
 */
describe('RecaudoService (integración) — DEP-01', () => {
  let testApp: TestApp;
  let recaudo: RecaudoService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    recaudo = testApp.app.get(RecaudoService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  async function crearContratoTerminadoConDeposito(depositoCustodia: number) {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    return crearContrato(testApp.dataSource, cliente, inmueble, {
      estado: EstadoContrato.TERMINADO,
      fechaFin: new Date(),
      depositoCustodia,
    });
  }

  it('persiste cada descuento con su propio concepto/valor y devuelve el neto por el medio indicado', async () => {
    const contrato = await crearContratoTerminadoConDeposito(1000000);

    const dto: LiquidarDepositoDto = {
      descuentos: [
        { concepto: 'Aseo general', valor: 150000 },
        { concepto: 'Reparación de puerta', valor: 200000 },
      ],
      medioPago: MedioPago.TRANSFERENCIA,
      referencia: 'REF-DEV-001',
    };

    const resultado = await recaudo.liquidarDeposito(contrato.id, dto, 'admin@test.com');

    expect(resultado.valorDescontado).toBe(350000);
    expect(resultado.valorDevuelto).toBe(650000); // 1.000.000 - 350.000

    const descuentosGuardados = await testApp.dataSource
      .getRepository(DescuentoDeposito)
      .find({ where: { contrato: { id: contrato.id } } });
    expect(descuentosGuardados).toHaveLength(2);
    expect(descuentosGuardados.map((d) => d.concepto).sort()).toEqual(['Aseo general', 'Reparación de puerta'].sort());
    expect(Number(descuentosGuardados.find((d) => d.concepto === 'Aseo general')!.valor)).toBe(150000);

    const movimiento = await testApp.dataSource
      .getRepository(Movimiento)
      .findOneOrFail({ where: { contratoId: contrato.id, origen: OrigenMovimiento.DEPOSITO } });
    expect(Number(movimiento.monto)).toBe(650000);
    expect(movimiento.medioPago).toBe(MedioPago.TRANSFERENCIA);
    expect(movimiento.referencia).toBe('REF-DEV-001');

    const contratoRecargado = await testApp.dataSource.getRepository(Contrato).findOneByOrFail({ id: contrato.id });
    expect(Number(contratoRecargado.depositoCustodia)).toBe(0);
  });

  it('exige medio de pago cuando queda saldo por devolver', async () => {
    const contrato = await crearContratoTerminadoConDeposito(500000);

    await expect(
      recaudo.liquidarDeposito(contrato.id, { descuentos: [{ concepto: 'Aseo', valor: 100000 }] }, 'admin@test.com'),
    ).rejects.toThrow('Debe indicar el medio de pago');
  });

  it('sin descuentos, devuelve el depósito completo sin crear ningún descuento', async () => {
    const contrato = await crearContratoTerminadoConDeposito(300000);

    const resultado = await recaudo.liquidarDeposito(contrato.id, { medioPago: MedioPago.EFECTIVO }, 'admin@test.com');

    expect(resultado.valorDescontado).toBe(0);
    expect(resultado.valorDevuelto).toBe(300000);

    const descuentosGuardados = await testApp.dataSource
      .getRepository(DescuentoDeposito)
      .find({ where: { contrato: { id: contrato.id } } });
    expect(descuentosGuardados).toHaveLength(0);
  });

  /**
   * Sin esta guardia, una segunda liquidación sobre el mismo contrato no duplicaba el pago
   * (el depósito ya quedaba en 0 tras la primera), pero sí insertaba una fila `DescuentoDeposito`
   * duplicada con efecto cero si se reenviaban descuentos — contaminando el rastro de auditoría.
   */
  it('rechaza una segunda liquidación sobre el mismo contrato (idempotencia)', async () => {
    const contrato = await crearContratoTerminadoConDeposito(500000);

    await recaudo.liquidarDeposito(contrato.id, { medioPago: MedioPago.EFECTIVO }, 'admin@test.com');

    await expect(
      recaudo.liquidarDeposito(
        contrato.id,
        { descuentos: [{ concepto: 'Reintento', valor: 50000 }], medioPago: MedioPago.EFECTIVO },
        'admin@test.com',
      ),
    ).rejects.toThrow('El depósito de este contrato ya fue liquidado previamente.');

    const descuentosGuardados = await testApp.dataSource
      .getRepository(DescuentoDeposito)
      .find({ where: { contrato: { id: contrato.id } } });
    expect(descuentosGuardados).toHaveLength(0);
  });
});

/**
 * Valida que `simularPago` (previsualización, solo lectura) devuelva EXACTAMENTE el mismo
 * desglose que `registrarPago` va a persistir — ambos comparten `calcularPlanAplicacion`, así
 * que este test es la prueba de que no hay una segunda copia de la regla de aplicación en
 * ningún otro lugar (ni backend ni frontend) que pueda desviarse con el tiempo.
 */
describe('RecaudoService (integración) — simularPago == registrarPago', () => {
  let testApp: TestApp;
  let recaudo: RecaudoService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    recaudo = testApp.app.get(RecaudoService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  it('la previsualización no persiste nada y coincide exactamente con el recibo real', async () => {
    await configurarEmpresa(testApp.dataSource, { diasGraciaMora: 5, porcentajeMoraMensual: 3 });
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    const contrato = await crearContrato(testApp.dataSource, cliente, inmueble, { canonValor: 400000 });
    const canon = await crearObligacion(testApp.dataSource, contrato, {
      tipo: TipoObligacion.CANON,
      valorOriginal: 400000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 0,
    });
    await crearObligacion(testApp.dataSource, contrato, {
      tipo: TipoObligacion.NOVEDAD,
      valorOriginal: 150000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 10, // mora = 150000*0.03/30*10 = 1.500
    });

    const dto = {
      contratoId: contrato.id,
      detallesPago: [{ medioPago: MedioPago.EFECTIVO, monto: 552500 }], // Canon+Novedad+Mora+1000 excedente
    } as RegistrarPagoDto;

    const simulacion = await recaudo.simularPago(dto);

    // La simulación NO debe haber persistido nada: obligaciones intactas.
    const canonSinTocar = await recargarObligacion(testApp.dataSource, canon.id);
    expect(Number(canonSinTocar.valorAbonado)).toBe(0);
    const reciboRepo = testApp.dataSource.getRepository(Movimiento);
    expect(await reciboRepo.count()).toBe(0);

    const recibo = await recaudo.registrarPago(dto, 'admin@test.com');
    const reciboCompleto = await recaudo.obtener(recibo.id);

    // Mismo excedente, mismo número de aplicaciones y mismos montos por obligación/concepto.
    expect(Number(simulacion.excedente)).toBe(Number(reciboCompleto.excedente));
    expect(simulacion.aplicaciones).toHaveLength(reciboCompleto.aplicaciones.length);

    for (const aplicacionReal of reciboCompleto.aplicaciones) {
      const aplicacionSimulada = simulacion.aplicaciones.find(
        (a) => a.obligacionId === aplicacionReal.obligacion.id && a.concepto === aplicacionReal.concepto,
      );
      expect(aplicacionSimulada).toBeDefined();
      expect(Number(aplicacionSimulada!.monto)).toBe(Number(aplicacionReal.montoAplicado));
      expect(Number(aplicacionSimulada!.saldoPosterior)).toBe(Number(aplicacionReal.saldoPosterior));
    }
  });
});

/** Valida el listado general de recibos (módulo Recibos): búsqueda, filtros y paginación. */
describe('RecaudoService (integración) — listar (módulo Recibos)', () => {
  let testApp: TestApp;
  let recaudo: RecaudoService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    recaudo = testApp.app.get(RecaudoService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  it('lista, busca por cédula del cliente y filtra por medio de pago', async () => {
    await configurarEmpresa(testApp.dataSource, {});
    const clienteA = await crearCliente(testApp.dataSource, { numeroDocumento: '111222333' });
    const clienteB = await crearCliente(testApp.dataSource, { numeroDocumento: '999888777' });
    const inmuebleA = await crearInmueble(testApp.dataSource);
    const inmuebleB = await crearInmueble(testApp.dataSource);
    const contratoA = await crearContrato(testApp.dataSource, clienteA, inmuebleA, { canonValor: 100000 });
    const contratoB = await crearContrato(testApp.dataSource, clienteB, inmuebleB, { canonValor: 100000 });
    await crearObligacion(testApp.dataSource, contratoA, {
      tipo: TipoObligacion.CANON,
      valorOriginal: 100000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 0,
    });
    await crearObligacion(testApp.dataSource, contratoB, {
      tipo: TipoObligacion.CANON,
      valorOriginal: 100000,
      diasGraciaEmpresa: 5,
      diasAtrasoDeseado: 0,
    });

    await recaudo.registrarPago(
      {
        contratoId: contratoA.id,
        detallesPago: [{ medioPago: MedioPago.EFECTIVO, monto: 100000 }],
      },
      'admin@test.com',
    );
    await recaudo.registrarPago(
      {
        contratoId: contratoB.id,
        detallesPago: [{ medioPago: MedioPago.TRANSFERENCIA, monto: 100000 }],
      },
      'admin@test.com',
    );

    const todos = await recaudo.listar({});
    expect(todos.total).toBe(2);
    // detallesPago se trae por una segunda consulta (no por JOIN 1:N en la query paginada,
    // para no corromper la paginación) — verificar que igual llega poblado por recibo.
    for (const recibo of todos.data) {
      expect(recibo.detallesPago.length).toBeGreaterThan(0);
    }

    const porCedula = await recaudo.listar({ busqueda: '111222333' });
    expect(porCedula.total).toBe(1);
    expect(porCedula.data[0].contrato.cliente.id).toBe(clienteA.id);

    const porMedio = await recaudo.listar({ medioPago: MedioPago.TRANSFERENCIA });
    expect(porMedio.total).toBe(1);
    expect(porMedio.data[0].contrato.cliente.id).toBe(clienteB.id);
  });
});

/**
 * Valida los endpoints de solo lectura que sostienen la pantalla Depósitos del frontend
 * (Track B5): contratos terminados con depósito aún sin liquidar, y el historial de
 * liquidaciones con su desglose de descuentos.
 */
describe('RecaudoService (integración) — depositosPendientes/depositosLiquidados', () => {
  let testApp: TestApp;
  let recaudo: RecaudoService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    recaudo = testApp.app.get(RecaudoService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  async function crearContratoTerminadoConDeposito(depositoCustodia: number) {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    return crearContrato(testApp.dataSource, cliente, inmueble, {
      estado: EstadoContrato.TERMINADO,
      fechaFin: new Date(),
      depositoCustodia,
    });
  }

  it('depositosPendientes solo incluye TERMINADO con depósito > 0 y sin liquidar', async () => {
    const pendiente = await crearContratoTerminadoConDeposito(500000);
    const yaLiquidado = await crearContratoTerminadoConDeposito(300000);
    await recaudo.liquidarDeposito(yaLiquidado.id, { medioPago: MedioPago.EFECTIVO }, 'admin@test.com');

    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource);
    // ACTIVO con depósito: no está pendiente de liquidar todavía (no aplica hasta terminar).
    await crearContrato(testApp.dataSource, cliente, inmueble, { depositoCustodia: 400000 });

    const resultado = await recaudo.depositosPendientes();
    expect(resultado.total).toBe(1);
    expect(resultado.data[0].id).toBe(pendiente.id);
  });

  it('depositosLiquidados trae el desglose de descuentos agrupado por contrato', async () => {
    const contratoA = await crearContratoTerminadoConDeposito(1000000);
    const contratoB = await crearContratoTerminadoConDeposito(500000);

    await recaudo.liquidarDeposito(
      contratoA.id,
      { descuentos: [{ concepto: 'Aseo', valor: 100000 }], medioPago: MedioPago.EFECTIVO },
      'admin@test.com',
    );
    await recaudo.liquidarDeposito(contratoB.id, { medioPago: MedioPago.TRANSFERENCIA }, 'admin@test.com');

    const resultado = await recaudo.depositosLiquidados();
    expect(resultado.total).toBe(2);

    const filaA = resultado.data.find((c) => c.id === contratoA.id)!;
    expect(filaA.descuentos).toHaveLength(1);
    expect(filaA.descuentos[0].concepto).toBe('Aseo');

    const filaB = resultado.data.find((c) => c.id === contratoB.id)!;
    expect(filaB.descuentos).toHaveLength(0);
  });
});
