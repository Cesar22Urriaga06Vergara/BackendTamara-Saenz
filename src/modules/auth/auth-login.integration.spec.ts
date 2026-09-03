import { AuthService } from './auth.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { Rol } from '../../common/enums/roles.enum';
import { bootstrapTestApp, limpiarBaseDeDatos, TestApp } from '../../../test/test-app';

/**
 * Valida los flujos centrales de sesión: login, refresh (con rotación) y logout.
 */
describe('AuthService (integración) — login / refresh / logout', () => {
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

  async function crearUsuarioActivo(overrides: { email?: string; rol?: Rol; password?: string } = {}) {
    return usuariosService.crear({
      nombreCompleto: 'Usuario de prueba',
      email: overrides.email ?? 'usuario@tamarasaenz.com',
      password: overrides.password ?? 'Password#123',
      rol: overrides.rol ?? Rol.RECEPCIONISTA,
    });
  }

  describe('login', () => {
    it('con credenciales correctas, emite access/refresh token y datos del usuario', async () => {
      await crearUsuarioActivo({ email: 'ok@tamarasaenz.com', password: 'Password#123' });

      const sesion = await authService.login({ email: 'ok@tamarasaenz.com', password: 'Password#123' });

      expect(sesion.accessToken).toBeDefined();
      expect(sesion.refreshToken).toBeDefined();
      expect(sesion.usuario.email).toBe('ok@tamarasaenz.com');
      expect(sesion.usuario.rol).toBe(Rol.RECEPCIONISTA);
    });

    it('rechaza una contraseña incorrecta sin distinguir el motivo exacto', async () => {
      await crearUsuarioActivo({ email: 'ok@tamarasaenz.com', password: 'Password#123' });

      await expect(authService.login({ email: 'ok@tamarasaenz.com', password: 'incorrecta' })).rejects.toThrow(
        'Credenciales inválidas.',
      );
    });

    it('rechaza un email que no existe', async () => {
      await expect(authService.login({ email: 'no-existe@tamarasaenz.com', password: 'Password#123' })).rejects.toThrow(
        'Credenciales inválidas.',
      );
    });

    it('rechaza el login de un usuario desactivado', async () => {
      const usuario = await crearUsuarioActivo({ email: 'inactivo@tamarasaenz.com', password: 'Password#123' });
      await usuariosService.actualizar(usuario.id, { activo: false });

      await expect(authService.login({ email: 'inactivo@tamarasaenz.com', password: 'Password#123' })).rejects.toThrow(
        'Credenciales inválidas.',
      );
    });
  });

  describe('refrescar', () => {
    it('con un refresh token válido, emite un par nuevo y revoca (rota) el usado', async () => {
      await crearUsuarioActivo({ email: 'ok@tamarasaenz.com' });
      const sesionInicial = await authService.login({ email: 'ok@tamarasaenz.com', password: 'Password#123' });

      const sesionNueva = await authService.refrescar(sesionInicial.refreshToken);

      expect(sesionNueva.accessToken).toBeDefined();
      expect(sesionNueva.refreshToken).not.toBe(sesionInicial.refreshToken);

      // El refresh token original queda revocado — no puede reutilizarse (rotación).
      await expect(authService.refrescar(sesionInicial.refreshToken)).rejects.toThrow(
        'Refresh token inválido o expirado.',
      );
    });

    it('rechaza un refresh token inexistente', async () => {
      await expect(authService.refrescar('token-que-no-existe')).rejects.toThrow('Refresh token inválido o expirado.');
    });

    it('rechaza refrescar la sesión de un usuario que fue desactivado después del login', async () => {
      const usuario = await crearUsuarioActivo({ email: 'se-desactiva@tamarasaenz.com' });
      const sesion = await authService.login({ email: 'se-desactiva@tamarasaenz.com', password: 'Password#123' });

      await usuariosService.actualizar(usuario.id, { activo: false });

      await expect(authService.refrescar(sesion.refreshToken)).rejects.toThrow('Refresh token inválido o expirado.');
    });
  });

  describe('logout', () => {
    it('revoca el refresh token, impidiendo que se use para refrescar después', async () => {
      await crearUsuarioActivo({ email: 'ok@tamarasaenz.com' });
      const sesion = await authService.login({ email: 'ok@tamarasaenz.com', password: 'Password#123' });

      await authService.logout(sesion.refreshToken);

      await expect(authService.refrescar(sesion.refreshToken)).rejects.toThrow('Refresh token inválido o expirado.');
    });

    it('un logout con un token que ya no existe no lanza error (best-effort, idempotente)', async () => {
      await expect(authService.logout('token-inexistente')).resolves.toBeUndefined();
    });

    it('nunca persiste el refresh token en texto plano (solo su hash SHA-256)', async () => {
      await crearUsuarioActivo({ email: 'ok@tamarasaenz.com' });
      const sesion = await authService.login({ email: 'ok@tamarasaenz.com', password: 'Password#123' });

      const registros = await testApp.dataSource.getRepository(RefreshToken).find();
      expect(registros).toHaveLength(1);
      expect(registros[0].tokenHash).not.toBe(sesion.refreshToken);
      expect(registros[0].tokenHash).toHaveLength(64); // hex de SHA-256
    });
  });
});
