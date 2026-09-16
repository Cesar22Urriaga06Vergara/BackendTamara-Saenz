import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmpresaService } from './empresa.service';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { ConsecutivoConfigDto } from './dto/consecutivo-config.dto';
import { ConsecutivoService } from './consecutivo.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Empresa / Configuración')
@ApiBearerAuth()
@Controller('empresa')
export class EmpresaController {
  constructor(
    private readonly service: EmpresaService,
    private readonly consecutivoService: ConsecutivoService,
  ) {}

  /**
   * Hallazgo RBAC-03 de la auditoría: expone la configuración de negocio (horizonte de canon,
   * saldo inicial de caja), que §3.2 no lista entre lo que Recepcionista puede consultar. La
   * página que lo consume (`/configuracion`) ya está bloqueada para Recepcionista en el
   * frontend; esta restricción cierra la brecha también en el backend.
   */
  @Get()
  @Roles(Rol.ADMINISTRADOR)
  obtener() {
    return this.service.obtener();
  }

  /**
   * Ficha pública de marca (nombre/slogan, sin nada financiero): usada por el login
   * (aún sin sesión) y por el layout autenticado para Recepcionista, que no tiene acceso a
   * `GET /empresa` completo. Es de solo lectura y no filtra ningún dato sensible.
   */
  @Public()
  @Get('publico')
  obtenerBranding() {
    return this.service.obtenerBranding();
  }

  @Patch()
  @Roles(Rol.ADMINISTRADOR)
  @AuditAction({ modulo: 'EMPRESA', accion: 'ACTUALIZAR_PARAMETROS' })
  actualizar(@Body() dto: UpdateEmpresaDto) {
    return this.service.actualizarParametros(dto);
  }

  @Get('consecutivos')
  @Roles(Rol.ADMINISTRADOR)
  listarConsecutivos() {
    return this.consecutivoService.listar();
  }

  @Post('consecutivos')
  @Roles(Rol.ADMINISTRADOR)
  @AuditAction({ modulo: 'EMPRESA', accion: 'CONFIGURAR_CONSECUTIVO' })
  guardarConsecutivo(@Body() dto: ConsecutivoConfigDto) {
    return this.consecutivoService.guardar(dto);
  }

}
