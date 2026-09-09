import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Baja el rate-limit global (200/min) a 5 intentos/minuto por IP (AUD-019) para dificultar
   *  la fuerza bruta sobre credenciales. El `ThrottlerGuard` es global (ver `app.module.ts`). */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @AuditAction({ modulo: 'AUTH', accion: 'LOGIN' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
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
