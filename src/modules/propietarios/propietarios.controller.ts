import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PropietariosService } from './propietarios.service';
import { CreatePropietarioDto } from './dto/create-propietario.dto';
import { UpdatePropietarioDto } from './dto/update-propietario.dto';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';

/** Directorio de Propietarios (§4). Lectura abierta (la necesita Recepcionista al crear inmuebles); mutación exclusiva Administrador. */
@ApiTags('Directorios / Propietarios')
@ApiBearerAuth()
@Controller('propietarios')
export class PropietariosController {
  constructor(private readonly service: PropietariosService) {}

  @Post()
  @Roles(Rol.ADMINISTRADOR)
  @AuditAction({ modulo: 'PROPIETARIOS', accion: 'CREAR' })
  crear(@Body() dto: CreatePropietarioDto) {
    return this.service.crear(dto);
  }

  @Get()
  listar(@Query() filtro: PaginacionDto) {
    return this.service.listar(filtro);
  }

  /** Sin paginar — para poblar el selector de propietario al crear/editar un inmueble. */
  @Get('todos')
  listarTodos() {
    return this.service.listarTodos();
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Patch(':id')
  @Roles(Rol.ADMINISTRADOR)
  @AuditAction({ modulo: 'PROPIETARIOS', accion: 'ACTUALIZAR' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePropietarioDto) {
    return this.service.actualizar(id, dto);
  }
}
