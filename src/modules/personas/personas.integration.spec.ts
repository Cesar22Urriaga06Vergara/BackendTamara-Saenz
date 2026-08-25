import { ClientesService, CodeudoresService } from './personas.service';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { bootstrapTestApp, limpiarBaseDeDatos, TestApp } from '../../../test/test-app';

/**
 * Cubre el directorio de Clientes/Codeudores (`PersonasServiceBase`, compartido por ambas
 * entidades) — antes sin ningún test. Se prueba una vez contra `ClientesService`; el
 * comportamiento es idéntico para `CodeudoresService` porque ambas heredan de la misma base
 * genérica (se agrega un test puntual contra Codeudores para confirmar que la instancia
 * separada no comparte estado ni valida contra la tabla equivocada).
 */
describe('PersonasServiceBase (integración) — Clientes/Codeudores', () => {
  let testApp: TestApp;
  let clientes: ClientesService;
  let codeudores: CodeudoresService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    clientes = testApp.app.get(ClientesService);
    codeudores = testApp.app.get(CodeudoresService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  function dtoPersona(overrides: Partial<CreatePersonaDto> = {}): CreatePersonaDto {
    return { numeroDocumento: '123456789', nombreCompleto: 'Juan Pérez', ...overrides };
  }

  it('crea un cliente con tipoDocumento por defecto ("CC") cuando no se especifica', async () => {
    const cliente = await clientes.crear(dtoPersona());
    expect((cliente as any).tipoDocumento).toBe('CC');
    expect(cliente.activo).toBe(true);
  });

  it('rechaza crear un cliente con un numeroDocumento ya existente', async () => {
    await clientes.crear(dtoPersona({ numeroDocumento: '111' }));

    await expect(clientes.crear(dtoPersona({ numeroDocumento: '111' }))).rejects.toThrow(
      'Ya existe un cliente con ese número de documento.',
    );
  });

  it('el mismo numeroDocumento puede existir en Cliente y en Codeudor a la vez (tablas independientes)', async () => {
    await clientes.crear(dtoPersona({ numeroDocumento: '999' }));

    await expect(codeudores.crear(dtoPersona({ numeroDocumento: '999' }))).resolves.toBeDefined();
  });

  describe('buscar', () => {
    it('encuentra por coincidencia parcial de documento', async () => {
      await clientes.crear(dtoPersona({ numeroDocumento: '1020304050', nombreCompleto: 'Ana Ríos' }));

      const resultado = await clientes.buscar({ documento: '0203' });
      expect(resultado).toHaveLength(1);
      expect(resultado[0].nombreCompleto).toBe('Ana Ríos');
    });

    it('encuentra por coincidencia parcial de nombre', async () => {
      await clientes.crear(dtoPersona({ numeroDocumento: '1', nombreCompleto: 'Carlos Andrés Gómez' }));

      const resultado = await clientes.buscar({ nombre: 'Andrés' });
      expect(resultado).toHaveLength(1);
    });

    it('no devuelve clientes dados de baja (activo=false)', async () => {
      const cliente = await clientes.crear(dtoPersona({ numeroDocumento: '2', nombreCompleto: 'Pedro Baja' }));
      await clientes.actualizar(cliente.id, { activo: false });

      const resultado = await clientes.buscar({ nombre: 'Pedro Baja' });
      expect(resultado).toHaveLength(0);
    });
  });

  describe('actualizar', () => {
    it('permite actualizar campos sin tocar numeroDocumento', async () => {
      const cliente = await clientes.crear(dtoPersona({ numeroDocumento: '3' }));

      const actualizado = await clientes.actualizar(cliente.id, { telefono: '3001234567' });
      expect(actualizado.telefono).toBe('3001234567');
    });

    it('rechaza cambiar numeroDocumento a uno que ya usa otro cliente', async () => {
      await clientes.crear(dtoPersona({ numeroDocumento: '4' }));
      const otro = await clientes.crear(dtoPersona({ numeroDocumento: '5' }));

      await expect(clientes.actualizar(otro.id, { numeroDocumento: '4' } as any)).rejects.toThrow(
        'Ya existe un cliente con ese número de documento.',
      );
    });

    it('permite "cambiar" numeroDocumento al mismo valor que ya tenía (no es un conflicto consigo mismo)', async () => {
      const cliente = await clientes.crear(dtoPersona({ numeroDocumento: '6' }));

      await expect(clientes.actualizar(cliente.id, { numeroDocumento: '6' } as any)).resolves.toBeDefined();
    });
  });

  it('obtener() lanza NotFoundException para un id inexistente', async () => {
    await expect(clientes.obtener('00000000-0000-4000-8000-000000000000')).rejects.toThrow('cliente no encontrado.');
  });
});
