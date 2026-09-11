import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Rol } from '../../common/enums/roles.enum';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(Usuario) private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(RefreshToken) private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.usuariosService.buscarPorEmailConPassword(dto.email);
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    const passwordOk = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Credenciales inválidas.');

    return this.emitirTokens(usuario.id, usuario.email, usuario.rol);
  }

  async refrescar(refreshTokenPlano: string) {
    const tokenHash = this.hash(refreshTokenPlano);
    const registro = await this.refreshRepo.findOne({ where: { tokenHash } });

    if (!registro || registro.revocado || registro.expiraEn < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    // Igual que en login(): un usuario desactivado no debe poder renovar su sesión,
    // aunque su refresh token siga siendo válido (AUD-011).
    const usuario = await this.usuariosService.obtener(registro.usuarioId);
    if (!usuario.activo) {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    // Rotación: se revoca el usado y se emite un par nuevo.
    registro.revocado = true;
    await this.refreshRepo.save(registro);

    return this.emitirTokens(usuario.id, usuario.email, usuario.rol);
  }

  async logout(refreshTokenPlano: string): Promise<void> {
    const tokenHash = this.hash(refreshTokenPlano);
    await this.refreshRepo.update({ tokenHash }, { revocado: true });
  }

  async seedAdmin(email = 'urriagac44@gmail.com', password = 'Cesar2206!') {
    const passwordHash = await bcrypt.hash(password, 10);
    const usuario = await this.usuarioRepo.findOne({ where: { email } });

    if (usuario) {
      await this.usuarioRepo.update(usuario.id, {
        passwordHash,
        nombreCompleto: 'Cesar Urriaga',
        rol: Rol.ADMINISTRADOR,
        activo: true,
      });
      return {
        created: false,
        email,
        rol: Rol.ADMINISTRADOR,
      };
    }

    const nuevo = this.usuarioRepo.create({
      email,
      passwordHash,
      nombreCompleto: 'Cesar Urriaga',
      rol: Rol.ADMINISTRADOR,
      activo: true,
    });

    await this.usuarioRepo.save(nuevo);
    return {
      created: true,
      email,
      rol: Rol.ADMINISTRADOR,
    };
  }

  private async emitirTokens(userId: string, email: string, rol: string) {
    const payload = { sub: userId, email, rol };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshTokenPlano = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hash(refreshTokenPlano);
    const expiraEn = new Date(Date.now() + this.parseExpiracionAMs(this.config.get('JWT_REFRESH_EXPIRES_IN', '1d')));

    await this.refreshRepo.save(this.refreshRepo.create({ usuarioId: userId, tokenHash, expiraEn }));

    return {
      accessToken,
      refreshToken: refreshTokenPlano,
      usuario: { id: userId, email, rol },
    };
  }

  /** Los refresh tokens se validan SIEMPRE por su hash (SHA-256), nunca en texto plano. */
  private hash(valor: string): string {
    return crypto.createHash('sha256').update(valor).digest('hex');
  }

  /**
   * Parsea una expresión de expiración ("7d", "1d", "12h") a milisegundos. Solo días y horas —
   * suficiente para la vida del refresh token. Cualquier formato desconocido cae a 1 día
   * (comportamiento seguro: sesión corta antes que sesión eterna).
   */
  private parseExpiracionAMs(expr: string): number {
    const match = /^(\d+)\s*([dh])$/.exec(expr.trim());
    if (!match) return 24 * 60 * 60 * 1000; // 1 día
    const valor = Number(match[1]);
    const unidadMs = match[2] === 'h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    return valor * unidadMs;
  }
}
