import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InmueblesService } from './inmuebles.service';
import { CreateInmuebleDto } from './dto/create-inmueble.dto';
import { UpdateInmuebleDto } from './dto/update-inmueble.dto';
import { FilterInmuebleDto } from './dto/filter-inmueble.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';

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

  @Patch(':id')
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  @AuditAction({ modulo: 'INMUEBLES', accion: 'ACTUALIZAR' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInmuebleDto) {
    return this.service.actualizar(id, dto);
  }
}
