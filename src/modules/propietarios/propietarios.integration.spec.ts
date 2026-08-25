import { InmueblesService } from '../inmuebles/inmuebles.service';
import { PropietariosService } from './propietarios.service';
import { CreateInmuebleDto } from '../inmuebles/dto/create-inmueble.dto';
import { Rol } from '../../common/enums/roles.enum';
import {
  bootstrapTestApp,
  limpiarBaseDeDatos,
  obtenerOCrearPropietarioInmobiliaria,
  TestApp,
} from '../../../test/test-app';

/** Valida PROP-01: todo inmueble queda asociado a un Propietario (§4), con "INMOBILIARIA" como default. */
describe('Propietario (integración) — PROP-01', () => {
  let testApp: TestApp;
  let inmuebles: InmueblesService;
  let propietarios: PropietariosService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    inmuebles = testApp.app.get(InmueblesService);
    propietarios = testApp.app.get(PropietariosService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
    // En producción, la migración garantiza que "INMOBILIARIA" siempre existe; aquí se
    // recrea tras cada truncate para que cada test arranque en el mismo estado real.
    await obtenerOCrearPropietarioInmobiliaria(testApp.dataSource);
  });

  function dtoInmueble(overrides: Partial<CreateInmuebleDto> = {}): CreateInmuebleDto {
    return { direccion: 'Calle 1', barrio: 'Centro', canonValor: 500000, ...overrides };
  }

  it('crear un inmueble sin propietarioId lo asocia por defecto al propietario "INMOBILIARIA"', async () => {
    const inmueble = await inmuebles.crear(dtoInmueble());
    const conPropietario = await inmuebles.obtener(inmueble.id);

    expect(conPropietario.propietario).toBeDefined();
    expect(conPropietario.propietario.esInmobiliaria).toBe(true);
    expect(conPropietario.propietario.nombre).toBe('INMOBILIARIA');
  });

  it('crear un inmueble con propietarioId explícito lo asocia a ESE propietario, no a INMOBILIARIA', async () => {
    const propietario = await propietarios.crear({ nombre: 'Juan Pérez', numeroDocumento: '123456' });
    const inmueble = await inmuebles.crear(dtoInmueble({ propietarioId: propietario.id }));

    const conPropietario = await inmuebles.obtener(inmueble.id);
    expect(conPropietario.propietario.id).toBe(propietario.id);
    expect(conPropietario.propietario.esInmobiliaria).toBe(false);
  });

  it('rechaza crear un inmueble con un propietarioId inexistente', async () => {
    await expect(
      inmuebles.crear(dtoInmueble({ propietarioId: '00000000-0000-4000-8000-000000000000' })),
    ).rejects.toThrow('Propietario no encontrado.');
  });

  it('permite reasignar el propietario de un inmueble ya creado', async () => {
    const inmueble = await inmuebles.crear(dtoInmueble());
    const nuevoPropietario = await propietarios.crear({ nombre: 'María Gómez' });

    await inmuebles.actualizar(inmueble.id, { propietarioId: nuevoPropietario.id }, Rol.ADMINISTRADOR);

    const actualizado = await inmuebles.obtener(inmueble.id);
    expect(actualizado.propietario.id).toBe(nuevoPropietario.id);
  });

  it('el propietario especial "INMOBILIARIA" no puede editarse', async () => {
    const inmobiliaria = await obtenerOCrearPropietarioInmobiliaria(testApp.dataSource);

    await expect(propietarios.actualizar(inmobiliaria.id, { nombre: 'Otro nombre' })).rejects.toThrow(
      'El propietario especial "INMOBILIARIA" no puede editarse desde aquí.',
    );
  });

  it('existe exactamente un propietario "INMOBILIARIA" tras el seed/migración', async () => {
    // La migración de producción ya lo crea; en la BD de pruebas (synchronize) el helper lo
    // crea perezosamente la primera vez que se necesita — aquí forzamos esa creación y
    // verificamos que sea idempotente (no se dupliquen filas si se solicita más de una vez).
    const primera = await obtenerOCrearPropietarioInmobiliaria(testApp.dataSource);
    const segunda = await obtenerOCrearPropietarioInmobiliaria(testApp.dataSource);
    expect(primera.id).toBe(segunda.id);
  });
});
