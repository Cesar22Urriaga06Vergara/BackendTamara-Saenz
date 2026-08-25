import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ObligacionesService } from './obligaciones.service';
import { AnularObligacionDto } from './dto/anular-obligacion.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';

/** Motor financiero — EXCLUSIVO Administrador. */
@ApiTags('Financiero / Obligaciones')
@ApiBearerAuth()
@Controller('obligaciones')
@Roles(Rol.ADMINISTRADOR)
export class ObligacionesController {
  constructor(private readonly service: ObligacionesService) {}

  /** Disparo manual de la generación mensual (además del CRON automático). */
  @Post('generar-canones')
  @AuditAction({ modulo: 'OBLIGACIONES', accion: 'GENERAR_CANONES_MENSUALES' })
  generarCanones() {
    return this.service.generarCanonesMensuales();
  }

  @Get('contrato/:contratoId/pendientes')
  pendientesPorContrato(@Param('contratoId', ParseUUIDPipe) contratoId: string) {
    return this.service.pendientesPorContrato(contratoId);
  }

  /** Anula una obligación PENDIENTE generada por error (sin abonos aplicados). */
  @Patch(':id/anular')
  @AuditAction({ modulo: 'OBLIGACIONES', accion: 'ANULAR' })
  anular(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AnularObligacionDto) {
    return this.service.anular(id, dto.motivo);
  }
}
