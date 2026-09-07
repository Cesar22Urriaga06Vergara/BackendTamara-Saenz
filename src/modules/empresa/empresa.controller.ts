import { BadRequestException, Body, Controller, Get, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync, readFileSync, unlinkSync } from 'fs';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { EmpresaService } from './empresa.service';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Rol } from '../../common/enums/roles.enum';
import { AuditAction } from '../../common/decorators/audit-action.decorator';
import { Public } from '../../common/decorators/public.decorator';

const CARPETA_LOGOS = './uploads/empresa';
// SVG deliberadamente excluido: es un formato ejecutable (puede embeber <script>) y este
// archivo se sirve luego desde una ruta estática sin autenticación (`/uploads/`, ver
// `main.ts`) — aceptarlo habilitaría XSS almacenado sobre cualquier visitante que abra el
// logo directamente. Un logo no necesita ser un formato con capacidad de script.
const MIME_PERMITIDOS = ['image/png', 'image/jpeg', 'image/jpg'];

@ApiTags('Empresa / Configuración')
@ApiBearerAuth()
@Controller('empresa')
export class EmpresaController {
  constructor(private readonly service: EmpresaService) {}

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
          cb(new BadRequestException('Formato de imagen no permitido. Use PNG o JPG.'), false);
          return;
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  actualizarLogo(@UploadedFile() archivo: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Debe adjuntar un archivo de imagen.');
    this.verificarMagicBytes(archivo);
    return this.service.actualizarLogo(archivo);
  }

  /**
   * `fileFilter` de Multer solo ve el `Content-Type` que el cliente declaró en la petición
   * multipart, no el contenido real del archivo — un cliente distinto del frontend oficial
   * podría subir cualquier binario etiquetado como `image/png`. Esta verificación lee los
   * primeros bytes del archivo YA escrito en disco y confirma que corresponden a la firma
   * real de PNG/JPEG antes de dejar que `EmpresaService` lo registre; si no coincide, borra
   * el archivo y rechaza. Defensa en profundidad de bajo costo (el endpoint ya exige rol
   * Administrador, así que el riesgo de explotación es bajo, pero la verificación es barata).
   */
  private verificarMagicBytes(archivo: Express.Multer.File): void {
    const firma = readFileSync(archivo.path).subarray(0, 8);
    const esPng = firma[0] === 0x89 && firma[1] === 0x50 && firma[2] === 0x4e && firma[3] === 0x47;
    const esJpeg = firma[0] === 0xff && firma[1] === 0xd8 && firma[2] === 0xff;
    if (!esPng && !esJpeg) {
      unlinkSync(archivo.path);
      throw new BadRequestException('El contenido del archivo no corresponde a una imagen PNG o JPG válida.');
    }
  }
}
