import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InmueblesService } from './inmuebles.service';
import { CreateInmuebleDto } from './dto/create-inmueble.dto';
import { UpdateInmuebleDto } from './dto/update-inmueble.dto';
import { FilterInmuebleDto } from './dto/filter-inmueble.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Directorios / Inmuebles')
@ApiBearerAuth()
@Controller('inmuebles')
export class InmueblesController {
  constructor(private readonly service: InmueblesService) {}

  @Post()
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @AuditAction({ modulo: 'INMUEBLES', accion: 'CREAR' })
  crear(@Body() dto: CreateInmuebleDto) {
    return this.service.crear(dto);
  }

  @Get()
  listar(@Query() filtro: FilterInmuebleDto) {
    return this.service.listar(filtro);
  }

  @Get('barrios')
  listarBarrios() {
    return this.service.listarBarrios();
  }

  @Get('disponibles')
  disponibles() {
    return this.service.disponibles();
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  /**
   * Decisión de negocio RDN-06 / hallazgo RBAC-01 de la auditoría: Recepcionista puede
   * crear inmuebles y editar sus campos descriptivos, pero no `canonValor`/`depositoValor`
   * — ese valor se propaga automáticamente al crear un contrato nuevo sobre este inmueble
   * (`ContratosService.crear`), así que editarlo es, en la práctica, una decisión financiera.
   * La verificación de rol vive en el servicio (`InmueblesService.actualizar`), no solo aquí.
   */
  @Patch(':id')
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @AuditAction({ modulo: 'INMUEBLES', accion: 'ACTUALIZAR' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInmuebleDto, @CurrentUser() user: any) {
    return this.service.actualizar(id, dto, user.rol);
  }
}
