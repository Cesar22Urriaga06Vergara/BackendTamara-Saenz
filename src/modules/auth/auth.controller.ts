import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegistroInicialDto } from './dto/registro-inicial.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Limitado a 5 intentos/minuto por IP (AUD-019) para dificultar fuerza bruta sobre credenciales. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @AuditAction({ modulo: 'AUTH', accion: 'LOGIN' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Bootstrap de producción (sin `npm run seed`): solo funciona mientras `usuario` esté
   * vacía. Throttling igual que login, para no dejar esta ventana abierta a fuerza bruta
   * mientras el sistema aún no tiene ningún Administrador que pueda notarlo.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('registro-inicial')
  @HttpCode(HttpStatus.CREATED)
  @AuditAction({ modulo: 'AUTH', accion: 'REGISTRO_INICIAL' })
  registroInicial(@Body() dto: RegistroInicialDto) {
    return this.authService.registroInicial(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refrescar(@Body() dto: RefreshTokenDto) {
    return this.authService.refrescar(dto.refreshToken);
  }

  @Post('logout')
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction({ modulo: 'AUTH', accion: 'LOGOUT' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('me')
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @HttpCode(HttpStatus.OK)
  perfil(@CurrentUser() user: any) {
    return user;
  }
}
