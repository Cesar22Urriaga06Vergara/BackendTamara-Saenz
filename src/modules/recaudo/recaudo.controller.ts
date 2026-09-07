import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RecaudoService } from './recaudo.service';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { AnularReciboDto } from './dto/anular-recibo.dto';
import { LiquidarDepositoDto } from './dto/liquidar-deposito.dto';
import { FilterReciboDto } from './dto/filter-recibo.dto';
import { FilterDeudoresDto } from './dto/filter-deudores.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginacionDto } from '../../common/dto/paginacion.dto';

/**
 * Motor Financiero de Recaudo — EXCLUSIVO Administrador en TODO el controlador.
 * El Recepcionista no tiene acceso a ningún endpoint de este módulo (RolesGuard + @Roles a nivel clase).
 */
@ApiTags('Financiero / Recaudo')
@ApiBearerAuth()
@Controller('recaudo')
@Roles(Rol.ADMINISTRADOR)
export class RecaudoController {
  constructor(private readonly service: RecaudoService) {}

  /** Pantalla Recaudo: contratos con cartera vencida (uno por fila, con el total a cobrar). */
  @Get('deudores')
  deudores(@Query() filtro: FilterDeudoresDto) {
    return this.service.deudores(filtro);
  }

  @Post('pagos')
  @AuditAction({ modulo: 'RECAUDO', accion: 'REGISTRAR_PAGO' })
  registrarPago(@Body() dto: RegistrarPagoDto, @CurrentUser() user: any) {
    return this.service.registrarPago(dto, user.email);
  }

  /**
   * Previsualización antes de confirmar (módulo Recibos, §2): solo lectura, no aplica ningún
   * abono ni genera recibo. Sin `@AuditAction` deliberadamente — no muta nada financiero.
   */
  @Post('pagos/simular')
  simularPago(@Body() dto: RegistrarPagoDto) {
    return this.service.simularPago(dto);
  }

  /** Módulo Recibos: listado general independiente (sin pasar por contrato/cliente primero). */
  @Get('recibos')
  listarRecibos(@Query() filtro: FilterReciboDto) {
    return this.service.listar(filtro);
  }

  @Get('recibos/:id')
  obtenerRecibo(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Get('contrato/:contratoId/recibos')
  listarPorContrato(
    @Param('contratoId', ParseUUIDPipe) contratoId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listarPorContrato(contratoId, page, limit);
  }

  @Patch('recibos/:id/anular')
  @AuditAction({ modulo: 'RECAUDO', accion: 'ANULAR_RECIBO' })
  anular(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AnularReciboDto, @CurrentUser() user: any) {
    return this.service.anular(id, dto, user.email);
  }

  /** Pantalla Depósitos: contratos terminados con depósito aún sin liquidar. */
  @Get('depositos/pendientes')
  depositosPendientes(@Query() { page, limit }: PaginacionDto) {
    return this.service.depositosPendientes(page, limit);
  }

  /** Pantalla Depósitos: historial de liquidaciones con su desglose de descuentos. */
  @Get('depositos/liquidados')
  depositosLiquidados(@Query() { page, limit }: PaginacionDto) {
    return this.service.depositosLiquidados(page, limit);
  }

  @Post('contrato/:contratoId/liquidar-deposito')
  @AuditAction({ modulo: 'RECAUDO', accion: 'LIQUIDAR_DEPOSITO' })
  liquidarDeposito(
    @Param('contratoId', ParseUUIDPipe) contratoId: string,
    @Body() dto: LiquidarDepositoDto,
    @CurrentUser() user: any,
  ) {
    return this.service.liquidarDeposito(contratoId, dto, user.email);
  }
}
