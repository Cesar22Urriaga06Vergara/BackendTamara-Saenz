import { InmueblesService } from './inmuebles.service';
import { EstadoInmueble } from './entities/inmueble.entity';
import { EstadoContrato } from '../contratos/entities/contrato.entity';
import { UpdateInmuebleDto } from './dto/update-inmueble.dto';
import { bootstrapTestApp, limpiarBaseDeDatos, crearCliente, crearInmueble, crearContrato, TestApp } from '../../../test/test-app';

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
    return { estado } as UpdateInmuebleDto;
  }

  it('rechaza fijar OCUPADO directamente, sin importar el estado actual', async () => {
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.DISPONIBLE });

    await expect(service.actualizar(inmueble.id, dto(EstadoInmueble.OCUPADO))).rejects.toThrow(
      'Un inmueble solo puede quedar OCUPADO al crear o reactivar un contrato sobre él, no editando su estado directamente.',
    );
  });

  it('rechaza fijar DISPONIBLE si el inmueble tiene un contrato ACTIVO', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.OCUPADO });
    await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.ACTIVO });

    await expect(service.actualizar(inmueble.id, dto(EstadoInmueble.DISPONIBLE))).rejects.toThrow(
      'Este inmueble tiene un contrato ACTIVO vigente; no puede marcarse como disponible.',
    );
  });

  it('permite fijar DISPONIBLE cuando no hay contrato ACTIVO (ej: saliendo de MANTENIMIENTO)', async () => {
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.MANTENIMIENTO });

    const actualizado = await service.actualizar(inmueble.id, dto(EstadoInmueble.DISPONIBLE));

    expect(actualizado.estado).toBe(EstadoInmueble.DISPONIBLE);
  });

  it('permite fijar DISPONIBLE incluso si hay un contrato TERMINADO (solo ACTIVO bloquea)', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.MANTENIMIENTO });
    await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.TERMINADO });

    const actualizado = await service.actualizar(inmueble.id, dto(EstadoInmueble.DISPONIBLE));

    expect(actualizado.estado).toBe(EstadoInmueble.DISPONIBLE);
  });

  it('permite MANTENIMIENTO/INACTIVO libremente, incluso con contrato ACTIVO vigente', async () => {
    const cliente = await crearCliente(testApp.dataSource);
    const inmueble = await crearInmueble(testApp.dataSource, { estado: EstadoInmueble.OCUPADO });
    await crearContrato(testApp.dataSource, cliente, inmueble, { estado: EstadoContrato.ACTIVO });

    const actualizado = await service.actualizar(inmueble.id, dto(EstadoInmueble.MANTENIMIENTO));
    expect(actualizado.estado).toBe(EstadoInmueble.MANTENIMIENTO);
  });
});
