import { Body, Controller, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PersonasControllerBase } from './personas.controller-base';
import { ClientesService } from './personas.service';
import { Cliente } from './entities/cliente.entity';
import { CreatePersonaDto } from './dto/create-persona.dto';
import { UpdatePersonaDto } from './dto/update-persona.dto';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';

@ApiTags('Directorios / Clientes')
@ApiBearerAuth()
@Controller('clientes')
export class ClientesController extends PersonasControllerBase<Cliente> {
  constructor(protected readonly service: ClientesService) {
    super();
  }

  @Post()
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @AuditAction({ modulo: 'CLIENTES', accion: 'CREAR' })
  crear(@Body() dto: CreatePersonaDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  @Roles(Rol.ADMINISTRADOR)
  @AuditAction({ modulo: 'CLIENTES', accion: 'ACTUALIZAR' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePersonaDto) {
    return this.service.actualizar(id, dto);
  }
}
