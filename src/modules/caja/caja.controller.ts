import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CajaService } from './caja.service';
import { RegistrarArqueoDto } from './dto/registrar-arqueo.dto';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** Módulo de Caja física (§15) — EXCLUSIVO Administrador, igual que Movimientos/Recaudo. */
@ApiTags('Financiero / Caja')
@ApiBearerAuth()
@Controller('caja')
@Roles(Rol.ADMINISTRADOR)
export class CajaController {
  constructor(private readonly service: CajaService) {}

  /** Vista previa en vivo del saldo esperado, sin registrar ningún arqueo. */
  @Get('saldo-esperado')
  saldoEsperado() {
    return this.service.saldoEsperadoActual();
  }

  @Get('arqueos')
  listar(@Query() filtro: PaginacionDto) {
    return this.service.listar(filtro.page, filtro.limit);
  }

  @Get('arqueos/:id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Post('arqueos')
  @AuditAction({ modulo: 'CAJA', accion: 'REGISTRAR_ARQUEO' })
  registrarArqueo(@Body() dto: RegistrarArqueoDto, @CurrentUser() usuario: any) {
    return this.service.registrarArqueo(dto, usuario.email);
  }
}
