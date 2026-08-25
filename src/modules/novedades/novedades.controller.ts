import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NovedadesService } from './novedades.service';
import { CreateNovedadDto } from './dto/create-novedad.dto';
import { FilterNovedadDto } from './dto/filter-novedad.dto';
import { CambiarEstadoNovedadDto } from './dto/cambiar-estado-novedad.dto';
import { AprobarCargoArrendatarioDto } from './dto/aprobar-cargo-arrendatario.dto';
import { AprobarGastoInmobiliariaDto } from './dto/aprobar-gasto-inmobiliaria.dto';
import { PagarGastoInmobiliariaDto } from './dto/pagar-gasto-inmobiliaria.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Operación / Novedades')
@ApiBearerAuth()
@Controller('novedades')
export class NovedadesController {
  constructor(private readonly service: NovedadesService) {}

  /** Registro rápido — permitido a Recepcionista y Administrador. Sin impacto financiero. */
  @Post()
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @AuditAction({ modulo: 'NOVEDADES', accion: 'REGISTRAR' })
  crear(@Body() dto: CreateNovedadDto, @CurrentUser() user: any) {
    return this.service.crear(dto, user.email);
  }

  @Get()
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  listar(@Query() filtro: FilterNovedadDto) {
    return this.service.listar(filtro);
  }

  @Get(':id')
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Patch(':id/estado')
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @AuditAction({ modulo: 'NOVEDADES', accion: 'CAMBIAR_ESTADO' })
  cambiarEstado(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarEstadoNovedadDto, @CurrentUser() user: any) {
    return this.service.cambiarEstado(id, dto, user.rol);
  }

  /** Punto de aprobación financiera — EXCLUSIVO Administrador. */
  @Patch(':id/aprobar-cargo-arrendatario')
  @Roles(Rol.ADMINISTRADOR)
  @AuditAction({ modulo: 'NOVEDADES', accion: 'APROBAR_CARGO_ARRENDATARIO' })
  aprobarCargoArrendatario(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AprobarCargoArrendatarioDto,
    @CurrentUser() user: any,
  ) {
    return this.service.aprobarCargoArrendatario(id, dto, user.email);
  }

  /** Punto de aprobación financiera — EXCLUSIVO Administrador. */
  @Patch(':id/aprobar-gasto-inmobiliaria')
  @Roles(Rol.ADMINISTRADOR)
  @AuditAction({ modulo: 'NOVEDADES', accion: 'APROBAR_GASTO_INMOBILIARIA' })
  aprobarGastoInmobiliaria(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AprobarGastoInmobiliariaDto,
    @CurrentUser() user: any,
  ) {
    return this.service.aprobarGastoInmobiliaria(id, dto, user.email);
  }

  /** Pago real de un gasto ya aprobado — EXCLUSIVO Administrador. Único paso que mueve dinero. */
  @Patch(':id/pagar-gasto-inmobiliaria')
  @Roles(Rol.ADMINISTRADOR)
  @AuditAction({ modulo: 'NOVEDADES', accion: 'PAGAR_GASTO_INMOBILIARIA' })
  pagarGastoInmobiliaria(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PagarGastoInmobiliariaDto,
    @CurrentUser() user: any,
  ) {
    return this.service.pagarGastoInmobiliaria(id, dto, user.email);
  }
}
