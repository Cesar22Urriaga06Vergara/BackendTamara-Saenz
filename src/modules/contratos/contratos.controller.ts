import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContratosService } from './contratos.service';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { TerminarContratoDto } from './dto/terminar-contrato.dto';
import { ReactivarContratoDto } from './dto/reactivar-contrato.dto';
import { FilterContratoDto } from './dto/filter-contrato.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Operación / Contratos')
@ApiBearerAuth()
@Controller('contratos')
export class ContratosController {
  constructor(private readonly service: ContratosService) {}

  @Post()
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @AuditAction({ modulo: 'CONTRATOS', accion: 'CREAR' })
  crear(@Body() dto: CreateContratoDto, @CurrentUser() user: any) {
    return this.service.crear(dto, user.email);
  }

  @Get()
  listar(@Query() filtro: FilterContratoDto) {
    return this.service.listar(filtro);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  /** Ficha de recaudo — exclusiva Administrador (motor financiero). */
  @Get(':id/ficha-recaudo')
  @Roles(Rol.ADMINISTRADOR)
  fichaRecaudo(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.fichaRecaudo(id);
  }

  @Patch(':id/terminar')
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @AuditAction({ modulo: 'CONTRATOS', accion: 'TERMINAR' })
  terminar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TerminarContratoDto, @CurrentUser() user: any) {
    return this.service.terminar(id, dto, user.email);
  }

  /**
   * Única reactivación de negocio (§6.6): TERMINADO → ACTIVO, EXCLUSIVO Administrador
   * (a diferencia de crear/terminar, que sí admiten Recepcionista) — hallazgo CONT-02.
   */
  @Patch(':id/reactivar')
  @Roles(Rol.ADMINISTRADOR)
  @AuditAction({ modulo: 'CONTRATOS', accion: 'REACTIVAR' })
  reactivar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReactivarContratoDto, @CurrentUser() user: any) {
    return this.service.reactivar(id, dto, user.email);
  }

  /** Trazabilidad de transiciones de estado (terminaciones/reactivaciones) — exclusiva Administrador. */
  @Get(':id/historial')
  @Roles(Rol.ADMINISTRADOR)
  historial(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.historial(id);
  }
}
