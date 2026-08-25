import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MovimientosService } from './movimientos.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { OrigenMovimiento, TipoMovimiento } from './entities/movimiento.entity';
import { MedioPago } from '../../common/enums/medio-pago.enum';
import { ReversarMovimientoDto } from './dto/reversar-movimiento.dto';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** Consulta de movimientos de caja — EXCLUSIVO Administrador (dinero e info contable). */
@ApiTags('Financiero / Movimientos de Caja')
@ApiBearerAuth()
@Controller('movimientos')
@Roles(Rol.ADMINISTRADOR)
export class MovimientosController {
  constructor(private readonly service: MovimientosService) {}

  @Get()
  listar(
    @Query('tipo') tipo?: TipoMovimiento,
    @Query('origen') origen?: OrigenMovimiento,
    @Query('medioPago') medioPago?: MedioPago,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listar({ tipo, origen, medioPago, desde, hasta, page, limit });
  }

  /** Recaudo total (efectivo + transferencias, §14.3) — NO es caja física. Usar `saldo-por-medio` para eso. */
  @Get('saldo-neto')
  saldoNeto() {
    return this.service.saldoNeto();
  }

  /** Desglosa el saldo por medio: caja física (efectivo), control bancario (transferencia) y sin medio identificado. */
  @Get('saldo-por-medio')
  saldoPorMedio() {
    return this.service.saldoPorMedio();
  }

  /**
   * Reverso manual para movimientos sin flujo de corrección propio en otro módulo
   * (origen NOVEDAD o DEPOSITO). Los movimientos de origen RECAUDO se rechazan aquí:
   * se corrigen anulando el recibo asociado (`PATCH /recaudo/recibos/:id/anular`).
   */
  @Patch(':id/reversar')
  @AuditAction({ modulo: 'MOVIMIENTOS', accion: 'REVERSAR' })
  reversar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReversarMovimientoDto, @CurrentUser() usuario: any) {
    return this.service.reversarManual(id, dto.motivo, usuario.email);
  }
}
