import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { CambiarEstadoEntrevistaDto } from './dto/cambiar-estado-entrevista.dto';
import { CreateEntrevistaArrendamientoDto } from './dto/create-entrevista-arrendamiento.dto';
import { FilterEntrevistaArrendamientoDto } from './dto/filter-entrevista-arrendamiento.dto';
import { EntrevistasArrendamientoService } from './entrevistas-arrendamiento.service';

@ApiTags('Operación / Entrevistas de arrendamiento')
@ApiBearerAuth()
@Controller('entrevistas-arrendamiento')
@Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
export class EntrevistasArrendamientoController {
  constructor(private readonly service: EntrevistasArrendamientoService) {}

  @Post()
  @AuditAction({ modulo: 'ENTREVISTAS_ARRENDAMIENTO', accion: 'CREAR' })
  crear(@Body() dto: CreateEntrevistaArrendamientoDto, @CurrentUser() user: any) {
    return this.service.crear(dto, user.email);
  }

  @Get()
  listar(@Query() filtro: FilterEntrevistaArrendamientoDto, @CurrentUser() user: any) {
    return this.service.listar(filtro, user.rol, user.email);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Patch(':id')
  @AuditAction({ modulo: 'ENTREVISTAS_ARRENDAMIENTO', accion: 'ACTUALIZAR' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateEntrevistaArrendamientoDto>) {
    return this.service.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @AuditAction({ modulo: 'ENTREVISTAS_ARRENDAMIENTO', accion: 'CAMBIAR_ESTADO' })
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoEntrevistaDto,
    @CurrentUser() user: any,
  ) {
    return this.service.cambiarEstado(id, dto, user.rol, user.email);
  }
}
