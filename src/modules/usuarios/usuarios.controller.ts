import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { PaginacionDto } from '../../common/dto/paginacion.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Usuarios (Administración / RBAC)')
@ApiBearerAuth()
@Controller('usuarios')
@Roles(Rol.ADMINISTRADOR) // Gestión de usuarios: exclusivo Administrador
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Post()
  @AuditAction({ modulo: 'USUARIOS', accion: 'CREAR' })
  crear(@Body() dto: CreateUsuarioDto) {
    return this.service.crear(dto);
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
  @AuditAction({ modulo: 'USUARIOS', accion: 'ACTUALIZAR' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUsuarioDto, @CurrentUser() usuarioActual: any) {
    return this.service.actualizar(id, dto, usuarioActual?.id);
  }

  @Patch(':id/password')
  @AuditAction({ modulo: 'USUARIOS', accion: 'CAMBIAR_PASSWORD' })
  cambiarPassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarPasswordDto) {
    return this.service.cambiarPassword(id, dto.nuevaPassword);
  }
}
