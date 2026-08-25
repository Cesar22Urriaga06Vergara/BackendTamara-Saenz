import { AuthService } from './auth.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { bootstrapTestApp, limpiarBaseDeDatos, TestApp } from '../../../test/test-app';

/**
 * Valida el registro inicial de Administrador: la vía por la que producción crea su primer
 * usuario con la base de datos en blanco, sin depender de `npm run seed` por consola.
 */
describe('AuthService (integración) — registro inicial', () => {
  let testApp: TestApp;
  let authService: AuthService;
  let usuariosService: UsuariosService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    authService = testApp.app.get(AuthService);
    usuariosService = testApp.app.get(UsuariosService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  it('crea el primer Administrador y devuelve una sesión ya iniciada', async () => {
    const sesion = await authService.registroInicial({
      nombreCompleto: 'Admin Inicial',
      email: 'admin-inicial@tamarasaenz.com',
      password: 'Password#123',
    });

    expect(sesion.accessToken).toBeDefined();
    expect(sesion.refreshToken).toBeDefined();
    expect(sesion.usuario.rol).toBe('ADMINISTRADOR');
    expect(sesion.usuario.email).toBe('admin-inicial@tamarasaenz.com');
  });

  it('rechaza un segundo registro inicial una vez que ya existe un usuario', async () => {
    await authService.registroInicial({
      nombreCompleto: 'Admin Inicial',
      email: 'admin-inicial@tamarasaenz.com',
      password: 'Password#123',
    });

    await expect(
      authService.registroInicial({
        nombreCompleto: 'Otro Admin',
        email: 'otro@tamarasaenz.com',
        password: 'Password#456',
      }),
    ).rejects.toThrow('El registro inicial ya no está disponible');
  });

  it('rechaza el registro inicial si ya existe cualquier usuario (creado por otra vía)', async () => {
    await usuariosService.crear({
      nombreCompleto: 'Recepción Semilla',
      email: 'recepcion@tamarasaenz.com',
      password: 'Password#789',
      rol: 'RECEPCIONISTA' as any,
    });

    await expect(
      authService.registroInicial({
        nombreCompleto: 'Admin Tardío',
        email: 'admin-tardio@tamarasaenz.com',
        password: 'Password#123',
      }),
    ).rejects.toThrow('El registro inicial ya no está disponible');
  });
});
