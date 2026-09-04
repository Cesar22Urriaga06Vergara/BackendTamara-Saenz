import { UsuariosService } from './usuarios.service';
import { AuthService } from '../auth/auth.service';
import { Usuario } from './entities/usuario.entity';
import { Rol } from '../../common/enums/roles.enum';
import { bootstrapTestApp, limpiarBaseDeDatos, TestApp } from '../../../test/test-app';

/**
 * Valida AUD-013: un Administrador no puede desactivarse a sí mismo ni quitarse su propio rol,
 * y el sistema nunca puede quedar sin ningún Administrador activo (por accidente).
 */
describe('UsuariosService (integración)', () => {
  let testApp: TestApp;
  let service: UsuariosService;
  let authService: AuthService;

  beforeAll(async () => {
    testApp = await bootstrapTestApp();
    service = testApp.app.get(UsuariosService);
    authService = testApp.app.get(AuthService);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await limpiarBaseDeDatos(testApp.dataSource);
  });

  function dtoUsuario(overrides: { email?: string; rol?: Rol } = {}) {
    return {
      nombreCompleto: 'Usuario de prueba',
      email: overrides.email ?? 'usuario@tamarasaenz.com',
      password: 'Password#123',
      rol: overrides.rol ?? Rol.RECEPCIONISTA,
    };
  }

  describe('crear', () => {
    it('crea un usuario con la contraseña hasheada (nunca en texto plano)', async () => {
      const usuario = await service.crear(dtoUsuario());
      expect(usuario.id).toBeTruthy();

      const conPassword = await service.buscarPorEmailConPassword(usuario.email);
      expect(conPassword?.passwordHash).not.toBe('Password#123');
      expect(conPassword?.passwordHash.length).toBeGreaterThan(20);
    });

    it('rechaza crear un segundo usuario con el mismo email', async () => {
      await service.crear(dtoUsuario({ email: 'duplicado@tamarasaenz.com' }));

      await expect(service.crear(dtoUsuario({ email: 'duplicado@tamarasaenz.com' }))).rejects.toThrow(
        'Ya existe un usuario con ese correo.',
      );
    });
  });

  describe('actualizar — protección del último Administrador (AUD-013)', () => {
    it('un Administrador no puede desactivarse a sí mismo', async () => {
      const admin = await service.crear(dtoUsuario({ email: 'admin@tamarasaenz.com', rol: Rol.ADMINISTRADOR }));

      await expect(service.actualizar(admin.id, { activo: false } as any, admin.id)).rejects.toThrow(
        'No puedes desactivarte a ti mismo ni quitarte tu propio rol de Administrador.',
      );
    });

    it('un Administrador no puede quitarse su propio rol de Administrador', async () => {
      const admin = await service.crear(dtoUsuario({ email: 'admin@tamarasaenz.com', rol: Rol.ADMINISTRADOR }));

      await expect(service.actualizar(admin.id, { rol: Rol.RECEPCIONISTA } as any, admin.id)).rejects.toThrow(
        'No puedes desactivarte a ti mismo ni quitarte tu propio rol de Administrador.',
      );
    });

    it('rechaza desactivar al único Administrador activo, incluso ejecutado por otro usuario', async () => {
      const admin = await service.crear(dtoUsuario({ email: 'admin@tamarasaenz.com', rol: Rol.ADMINISTRADOR }));
      const otro = await service.crear(dtoUsuario({ email: 'otro@tamarasaenz.com', rol: Rol.RECEPCIONISTA }));

      await expect(service.actualizar(admin.id, { activo: false } as any, otro.id)).rejects.toThrow(
        'No es posible desactivar o cambiar el rol del último Administrador activo del sistema.',
      );
    });

    it('permite desactivar a un Administrador si existe al menos otro Administrador activo', async () => {
      const admin1 = await service.crear(dtoUsuario({ email: 'admin1@tamarasaenz.com', rol: Rol.ADMINISTRADOR }));
      const admin2 = await service.crear(dtoUsuario({ email: 'admin2@tamarasaenz.com', rol: Rol.ADMINISTRADOR }));

      const actualizado = await service.actualizar(admin1.id, { activo: false }, admin2.id);
      expect(actualizado.activo).toBe(false);
    });

    it('permite a un Administrador desactivar a un Recepcionista sin restricción', async () => {
      const admin = await service.crear(dtoUsuario({ email: 'admin@tamarasaenz.com', rol: Rol.ADMINISTRADOR }));
      const recepcion = await service.crear(dtoUsuario({ email: 'recepcion@tamarasaenz.com', rol: Rol.RECEPCIONISTA }));

      const actualizado = await service.actualizar(recepcion.id, { activo: false }, admin.id);
      expect(actualizado.activo).toBe(false);
    });

    it('dos desactivaciones simultáneas de los 2 últimos Administradores no dejan el sistema sin ninguno (TOCTOU)', async () => {
      const ejecutor = await service.crear(dtoUsuario({ email: 'ejecutor@tamarasaenz.com', rol: Rol.RECEPCIONISTA }));
      const adminA = await service.crear(dtoUsuario({ email: 'admin-a@tamarasaenz.com', rol: Rol.ADMINISTRADOR }));
      const adminB = await service.crear(dtoUsuario({ email: 'admin-b@tamarasaenz.com', rol: Rol.ADMINISTRADOR }));

      const resultados = await Promise.allSettled([
        service.actualizar(adminA.id, { activo: false }, ejecutor.id),
        service.actualizar(adminB.id, { activo: false }, ejecutor.id),
      ]);

      const exitosos = resultados.filter((r) => r.status === 'fulfilled');
      const fallidos = resultados.filter((r) => r.status === 'rejected');
      expect(exitosos).toHaveLength(1);
      expect(fallidos).toHaveLength(1);

      const administradoresActivos = await testApp.dataSource
        .getRepository(Usuario)
        .count({ where: { rol: Rol.ADMINISTRADOR, activo: true } });
      expect(administradoresActivos).toBeGreaterThanOrEqual(1);
    });
  });

  describe('cambiarPassword', () => {
    it('la nueva contraseña permite iniciar sesión; la anterior deja de funcionar', async () => {
      const usuario = await service.crear(dtoUsuario({ email: 'cambia@tamarasaenz.com' }));

      await service.cambiarPassword(usuario.id, 'NuevaPassword#456');

      await expect(authService.login({ email: 'cambia@tamarasaenz.com', password: 'Password#123' })).rejects.toThrow(
        'Credenciales inválidas.',
      );

      const sesion = await authService.login({ email: 'cambia@tamarasaenz.com', password: 'NuevaPassword#456' });
      expect(sesion.accessToken).toBeDefined();
    });
  });
});
