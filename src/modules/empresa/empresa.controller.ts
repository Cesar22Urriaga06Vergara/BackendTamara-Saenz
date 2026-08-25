import { BadRequestException, Body, Controller, Get, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { EmpresaService } from './empresa.service';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { Public } from '../../common/decorators/public.decorator';

const CARPETA_LOGOS = './uploads/empresa';
const MIME_PERMITIDOS = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];

@ApiTags('Empresa / Configuración')
@ApiBearerAuth()
@Controller('empresa')
export class EmpresaController {
  constructor(private readonly service: EmpresaService) {}

  /**
   * Hallazgo RBAC-03 de la auditoría: expone `porcentajeMoraMensual`/`diasGraciaMora` (y el
   * resto de configuración de negocio), que §3.2 no lista entre lo que Recepcionista puede
   * consultar. La página que lo consume (`/configuracion`) ya está bloqueada para
   * Recepcionista en el frontend; esta restricción cierra la brecha también en el backend.
   */
  @Get()
  @Roles(Rol.ADMINISTRADOR)
  obtener() {
    return this.service.obtener();
  }

  /**
   * Ficha pública de marca (nombre/slogan/logo, sin nada financiero): usada por el login
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

  @Post('logo')
  @Roles(Rol.ADMINISTRADOR)
  @AuditAction({ modulo: 'EMPRESA', accion: 'ACTUALIZAR_LOGO' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          mkdirSync(CARPETA_LOGOS, { recursive: true });
          cb(null, CARPETA_LOGOS);
        },
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      fileFilter: (_req, file, cb) => {
        if (!MIME_PERMITIDOS.includes(file.mimetype)) {
          cb(new BadRequestException('Formato de imagen no permitido. Use PNG, JPG o SVG.'), false);
          return;
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  actualizarLogo(@UploadedFile() archivo: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Debe adjuntar un archivo de imagen.');
    return this.service.actualizarLogo(archivo);
  }
}
