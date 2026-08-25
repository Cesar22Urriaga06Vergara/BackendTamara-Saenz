import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';

/** Consulta de auditoría — EXCLUSIVO Administrador. */
@ApiTags('Consulta y Control / Auditoría')
@ApiBearerAuth()
@Controller('auditoria')
@Roles(Rol.ADMINISTRADOR)
export class AuditoriaController {
  constructor(private readonly service: AuditoriaService) {}

  @Get()
  listar(
    @Query('modulo') modulo?: string,
    @Query('usuarioEmail') usuarioEmail?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listar({ modulo, usuarioEmail, desde, hasta, page, limit });
  }
}
