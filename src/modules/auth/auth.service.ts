import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { RegistroInicialDto } from './dto/registro-inicial.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
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

  /**
   * Bootstrap de producción: crea el primer Administrador (único caso en que un endpoint de
   * `auth` puede crear un usuario) y lo deja sesionado de inmediato, igual que `login()` —
   * evita el paso extra de iniciar sesión manualmente justo después de registrarse.
   */
  async registroInicial(dto: RegistroInicialDto) {
    const usuario = await this.usuariosService.registrarPrimerAdministrador(dto);
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

  private async emitirTokens(userId: string, email: string, rol: string) {
    const payload = { sub: userId, email, rol };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshTokenPlano = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hash(refreshTokenPlano);
    const expiresInDias = this.parseDiasDesdeExpr(this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'));
    const expiraEn = new Date(Date.now() + expiresInDias * 24 * 60 * 60 * 1000);

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

  private parseDiasDesdeExpr(expr: string): number {
    const match = /^(\d+)d$/.exec(expr);
    return match ? Number(match[1]) : 7;
  }
}
