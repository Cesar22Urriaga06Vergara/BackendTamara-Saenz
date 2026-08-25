import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from './entities/usuario.entity';
import { Rol } from '../../common/enums/roles.enum';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { RegistroInicialDto } from '../auth/dto/registro-inicial.dto';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { paginar } from '../../common/utils/paginar.util';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
    private readonly dataSource: DataSource,
  ) {}

  async crear(dto: CreateUsuarioDto): Promise<Usuario> {
    const existe = await this.repo.findOne({ where: { email: dto.email } });
    if (existe) throw new ConflictException('Ya existe un usuario con ese correo.');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const usuario = this.repo.create({
      nombreCompleto: dto.nombreCompleto,
      email: dto.email,
      rol: dto.rol,
      passwordHash,
    });
    return this.repo.save(usuario);
  }

  listar(filtro: PaginacionDto) {
    const qb = this.repo.createQueryBuilder('u').orderBy('u.creadoEn', 'DESC');
    return paginar(qb, filtro.page, filtro.limit);
  }

  async obtener(id: string): Promise<Usuario> {
    const usuario = await this.repo.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    return usuario;
  }

  /** Incluye passwordHash (select:false por defecto) — uso exclusivo de AuthService. */
  buscarPorEmailConPassword(email: string) {
    return this.repo.createQueryBuilder('u').addSelect('u.passwordHash').where('u.email = :email', { email }).getOne();
  }

  /**
   * `usuarioActualId`: el Administrador autenticado que ejecuta el cambio (AUD-013).
   * Impide que se desactive a sí mismo o se quite su propio rol de Administrador, y que
   * el sistema quede sin ningún Administrador activo (por accidente, no por diseño).
   */
  async actualizar(id: string, dto: UpdateUsuarioDto, usuarioActualId?: string): Promise<Usuario> {
    const usuario = await this.obtener(id);

    const vaADesactivarse = dto.activo === false && usuario.activo;
    const vaAPerderRolAdmin =
      dto.rol !== undefined && dto.rol !== Rol.ADMINISTRADOR && usuario.rol === Rol.ADMINISTRADOR;

    if (usuarioActualId && id === usuarioActualId && (vaADesactivarse || vaAPerderRolAdmin)) {
      throw new ForbiddenException('No puedes desactivarte a ti mismo ni quitarte tu propio rol de Administrador.');
    }

    if (usuario.rol === Rol.ADMINISTRADOR && (vaADesactivarse || vaAPerderRolAdmin)) {
      const administradoresActivos = await this.repo.count({ where: { rol: Rol.ADMINISTRADOR, activo: true } });
      if (administradoresActivos <= 1) {
        throw new ConflictException(
          'No es posible desactivar o cambiar el rol del último Administrador activo del sistema.',
        );
      }
    }

    Object.assign(usuario, dto);
    return this.repo.save(usuario);
  }

  async cambiarPassword(id: string, nuevaPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(nuevaPassword, 10);
    await this.repo.update(id, { passwordHash });
  }

  /**
   * Registro del primer Administrador cuando el sistema entra a producción con la base de
   * datos en blanco (sin usuarios): reemplaza la necesidad de ejecutar `npm run seed` por
   * consola para crear la cuenta inicial. Funciona SOLO mientras no exista ningún usuario —
   * en cuanto se crea el primero, queda permanentemente inhabilitado (cualquier intento
   * posterior recibe 403), para que nunca se convierta en una puerta de registro público.
   *
   * La tabla está vacía por definición, así que no hay ninguna fila que bloquear con
   * `SELECT ... FOR UPDATE`; `GET_LOCK` (MariaDB/MySQL) es la única forma de serializar dos
   * solicitudes de registro inicial concurrentes para que no pasen ambas el conteo "0
   * usuarios" al mismo tiempo y terminen creando dos Administradores.
   */
  async registrarPrimerAdministrador(dto: RegistroInicialDto): Promise<Usuario> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT GET_LOCK('registro_inicial_usuario', 10)`);
      try {
        const repo = manager.getRepository(Usuario);
        const totalUsuarios = await repo.count();
        if (totalUsuarios > 0) {
          throw new ForbiddenException(
            'El registro inicial ya no está disponible: el sistema ya tiene usuarios creados. Solicita una cuenta a un Administrador existente.',
          );
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);
        return repo.save(
          repo.create({
            nombreCompleto: dto.nombreCompleto,
            email: dto.email,
            passwordHash,
            rol: Rol.ADMINISTRADOR,
            activo: true,
          }),
        );
      } finally {
        await manager.query(`SELECT RELEASE_LOCK('registro_inicial_usuario')`);
      }
    });
  }
}
