import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientesService } from './personas.service';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import { BuscarPersonaDto } from './dto/buscar-persona.dto';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';

@ApiTags('Directorios / Clientes')
@ApiBearerAuth()
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Post()
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @AuditAction({ modulo: 'CLIENTES', accion: 'CREAR' })
  crear(@Body() dto: CreatePersonaDto) {
    return this.service.crear(dto);
  }

  /** Búsqueda estricta usada por el flujo de contratación (por cédula preferente). */
  @Get('buscar')
  buscar(@Query() filtro: BuscarPersonaDto) {
    return this.service.buscar(filtro);
  }

  @Get()
  listar(@Query() filtro: PaginacionDto) {
    return this.service.listar(filtro);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Patch(':id')
  @Roles(Rol.ADMINISTRADOR)
  @AuditAction({ modulo: 'CLIENTES', accion: 'ACTUALIZAR' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePersonaDto) {
    return this.service.actualizar(id, dto);
  }
}
