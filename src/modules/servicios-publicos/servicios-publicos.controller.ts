import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AprobarResponsableDto } from './dto/aprobar-responsable.dto';
import { CreateServicioPublicoDto } from './dto/create-servicio-publico.dto';
import { FilterServicioPublicoDto } from './dto/filter-servicio-publico.dto';
import { ServiciosPublicosService } from './servicios-publicos.service';

@ApiTags('Servicios públicos')
@ApiBearerAuth()
@Controller('servicios-publicos')
export class ServiciosPublicosController {
  constructor(private readonly service: ServiciosPublicosService) {}

  @Post()
  @Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)
  crear(@Body() dto: CreateServicioPublicoDto, @CurrentUser() user: any) {
    return this.service.crear(dto, user.email);
  }

  @Get()
  listar(@Query() filtro: FilterServicioPublicoDto) {
    return this.service.listar(filtro);
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obtener(id);
  }

  @Patch(':id/aprobar-responsable')
  @Roles(Rol.ADMINISTRADOR)
  aprobarResponsable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AprobarResponsableDto,
    @CurrentUser() user: any,
  ) {
    return this.service.aprobarResponsable(id, dto, user.email);
  }
}
