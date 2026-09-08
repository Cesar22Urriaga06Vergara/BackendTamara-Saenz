import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { Empresa } from './entities/empresa.entity';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import {
  PREFIJO_PUBLICO_LOGO as PREFIJO_LOGO_PUBLICO,
  rutaFisicaDesdeUrlPublica,
} from '../../common/utils/rutas-archivos.util';

/** Valores con los que arranca la fila única de Empresa cuando la base de datos está en blanco. */
function valoresPorDefecto(): Partial<Empresa> {
  return {
    nombre: 'Mi Empresa',
    nit: 'PENDIENTE-POR-CONFIGURAR',
    slogan: 'Resolvemos tu situacion',
    horizonteMesesCanon: 3,
  };
}

@Injectable()
export class EmpresaService {
  constructor(@InjectRepository(Empresa) private readonly repo: Repository<Empresa>) {}

  /**
   * Retorna la ficha única de la empresa. Producción arranca con la base de datos en
   * blanco (ya no depende de `npm run seed`, ver registro inicial de Administrador en
   * `auth`): en vez de bloquear a cualquier consumidor con un 404 hasta que alguien
   * siembre la fila por consola, se crea aquí con valores por defecto razonables — el
   * Administrador los ajusta después desde `/configuracion`.
   */
  async obtener(): Promise<Empresa> {
    const empresa = await this.repo.find({ take: 1 });
    if (empresa[0]) return empresa[0];
    return this.repo.save(this.repo.create(valoresPorDefecto()));
  }

  /**
   * Ficha pública de marca (sin parámetros financieros): consumida por el login y el
   * layout autenticado para mostrar el logo/nombre reales de la empresa, incluso antes
   * de iniciar sesión o para el rol Recepcionista (a quien `GET /empresa` completo le
   * está vedado desde el hallazgo RBAC-03 de la auditoría).
   */
  async obtenerBranding(): Promise<Pick<Empresa, 'nombre' | 'slogan' | 'logoUrl'>> {
    const empresa = await this.obtener();
    return { nombre: empresa.nombre, slogan: empresa.slogan, logoUrl: empresa.logoUrl };
  }

  /**
   * Actualiza los parámetros globales de negocio. Hasta el 2026-09-01 esta operación también
   * versionaba cualquier cambio de tasa de mora en `historial_tasa_mora` (hallazgo MORA-02);
   * ese mecanismo se retiró junto con el resto del costo de mora / interés por retraso — ya
   * no existe ningún parámetro de negocio que necesite historial por fecha.
   */
  async actualizarParametros(dto: UpdateEmpresaDto): Promise<Empresa> {
    const empresa = await this.repo.find({ take: 1 });
    const actual = empresa[0] ?? (await this.repo.save(this.repo.create(valoresPorDefecto())));
    Object.assign(actual, dto);
    return this.repo.save(actual);
  }

  /** Guarda la ruta pública del logo ya escrito en disco por Multer y limpia el archivo anterior. */
  async actualizarLogo(archivo: Express.Multer.File): Promise<Empresa> {
    const empresa = await this.obtener();
    const logoAnterior = empresa.logoUrl;

    empresa.logoUrl = `${PREFIJO_LOGO_PUBLICO}${archivo.filename}`;
    const guardada = await this.repo.save(empresa);

    if (logoAnterior?.startsWith(PREFIJO_LOGO_PUBLICO)) {
      await fs.unlink(rutaFisicaDesdeUrlPublica(logoAnterior)).catch(() => undefined);
    }

    return guardada;
  }
}
