import { InmueblesService } from './inmuebles.service';
import { EstadoInmueble } from './entities/inmueble.entity';
import { EstadoContrato } from '../contratos/entities/contrato.entity';
import { UpdateInmuebleDto } from './dto/update-inmueble.dto';
import { Rol } from '../../common/enums/roles.enum';
import {
  bootstrapTestApp,
  limpiarBaseDeDatos,
  crearCliente,
  crearInmueble,
  crearContrato,
  obtenerOCrearPropietarioInmobiliaria,
  TestApp,
} from '../../../test/test-app';

/** Valida CONT-03: la disponibilidad/ocupación de un inmueble ya no se puede forzar sin validar contra `contrato`. */
describe('InmueblesService (integración) — CONT-03', () => {
  let testApp: TestApp;
  let service: InmueblesService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(InmueblesService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  function dto(estado: EstadoInmueble): UpdateInmuebleDto {
    return { estado };
  }

  it('rechaza fijar OCUPADO directamente, sin importar el estado actual', async () => {
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.DISPONIBLE });

    await expect(service.actualizar(inmueble.id, dto(EstadoInmueble.OCUPADO), Rol.ADMINISTRADOR)).rejects.toThrow(
      'Un inmueble solo puede quedar OCUPADO al crear o reactivar un contrato sobre él, no editando su estado directamente.',
    );
  });

  it('rechaza fijar DISPONIBLE si el inmueble tiene un contrato ACTIVO', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.OCUPADO });
    await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.ACTIVO });

    await expect(service.actualizar(inmueble.id, dto(EstadoInmueble.DISPONIBLE), Rol.ADMINISTRADOR)).rejects.toThrow(
      'Este inmueble tiene un contrato ACTIVO vigente; no puede marcarse como disponible.',
    );
  });

  it('permite fijar DISPONIBLE cuando no hay contrato ACTIVO (ej: saliendo de MANTENIMIENTO)', async () => {
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.MANTENIMIENTO });

    const actualizado = await service.actualizar(inmueble.id, dto(EstadoInmueble.DISPONIBLE), Rol.ADMINISTRADOR);

    expect(actualizado.estado).toBe(EstadoInmueble.DISPONIBLE);
  });

  it('permite fijar DISPONIBLE incluso si hay un contrato TERMINADO (solo ACTIVO bloquea)', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.MANTENIMIENTO });
    await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.TERMINADO });

    const actualizado = await service.actualizar(inmueble.id, dto(EstadoInmueble.DISPONIBLE), Rol.ADMINISTRADOR);

    expect(actualizado.estado).toBe(EstadoInmueble.DISPONIBLE);
  });

  it('permite MANTENIMIENTO/INACTIVO libremente, incluso con contrato ACTIVO vigente', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.OCUPADO });
    await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.ACTIVO });

    const actualizado = await service.actualizar(inmueble.id, dto(EstadoInmueble.MANTENIMIENTO), Rol.ADMINISTRADOR);
    expect(actualizado.estado).toBe(EstadoInmueble.MANTENIMIENTO);
  });
});

/** Valida RDN-06 / RBAC-01: Recepcionista no puede editar canon/depósito, sí campos descriptivos. */
describe('InmueblesService (integración) — RBAC-01', () => {
  let testApp: TestApp;
  let service: InmueblesService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(InmueblesService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  it('rechaza a Recepcionista editando canonValor', async () => {
    const inmueble = await crearInmueble(testApp.dataSource);

    await expect(service.actualizar(inmueble.id, { canonValor: 999999 }, Rol.RECEPCIONISTA)).rejects.toThrow(
      'Solo Administrador puede editar el canon o el depósito de un inmueble (decisión RDN-06).',
    );
  });

  it('rechaza a Recepcionista editando depositoValor', async () => {
    const inmueble = await crearInmueble(testApp.dataSource);

    await expect(service.actualizar(inmueble.id, { depositoValor: 999999 }, Rol.RECEPCIONISTA)).rejects.toThrow(
      'Solo Administrador puede editar el canon o el depósito de un inmueble (decisión RDN-06).',
    );
  });

  it('permite a Recepcionista editar campos descriptivos (dirección, barrio, observaciones)', async () => {
    const inmueble = await crearInmueble(testApp.dataSource);

    const actualizado = await service.actualizar(
      inmueble.id,
      { direccion: 'Nueva dirección 123', observaciones: 'nota operativa' },
      Rol.RECEPCIONISTA,
    );

    expect(actualizado.direccion).toBe('Nueva dirección 123');
  });

  it('permite a Administrador editar canonValor/depositoValor sin restricción', async () => {
    const inmueble = await crearInmueble(testApp.dataSource);

    const actualizado = await service.actualizar(
      inmueble.id,
      { canonValor: 600000, depositoValor: 600000 },
      Rol.ADMINISTRADOR,
    );

    expect(Number(actualizado.canonValor)).toBe(600000);
  });

  it('B3: crea un inmueble con canonValor/depositoValor enteros y los conserva sin decimales', async () => {
    await obtenerOCrearPropietarioInmobiliaria(testApp.dataSource);

    const creado = await service.crear({
      direccion: 'Carrera 10 # 20-30',
      barrio: 'La Castellana',
      canonValor: 750000,
      depositoValor: 750000,
    });

    expect(Number(creado.canonValor)).toBe(750000);
    expect(Number(creado.depositoValor)).toBe(750000);
  });
});
