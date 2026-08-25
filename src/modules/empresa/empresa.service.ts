import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Empresa } from './entities/empresa.entity';
import { HistorialTasaMora } from './entities/historial-tasa-mora.entity';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

const PREFIJO_LOGO_PUBLICO = '/uploads/empresa/';

/** Valores con los que arranca la fila única de Empresa cuando la base de datos está en blanco. */
function valoresPorDefecto(): Partial<Empresa> {
  return {
    nombre: 'Mi Empresa',
    nit: 'PENDIENTE-POR-CONFIGURAR',
    slogan: 'Resolvemos tu situacion',
    diasGraciaMora: 5,
    porcentajeMoraMensual: 1.5,
    horizonteMesesCanon: 3,
  };
}

@Injectable()
export class EmpresaService {
  constructor(
    @InjectRepository(Empresa) private readonly repo: Repository<Empresa>,
    @InjectRepository(HistorialTasaMora) private readonly historialTasaRepo: Repository<HistorialTasaMora>,
    private readonly dataSource: DataSource,
  ) {}

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

  private hoyComoFechaColumna(): string {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  }

  /**
   * Hallazgo MORA-02 de la auditoría: si el cambio afecta la tasa de mora (`diasGraciaMora`/
   * `porcentajeMoraMensual`), versiona el cambio en `historial_tasa_mora` en vez de solo
   * sobrescribir la fila global — así `ObligacionesService` puede seguir cobrando la tasa
   * anterior sobre los días ya transcurridos bajo ella, y solo aplicar la nueva desde hoy.
   * Si ya existe una fila vigente desde el día de hoy (dos cambios el mismo día), se actualiza
   * esa misma fila en vez de crear una segunda entrada para la misma fecha de vigencia.
   */
  async actualizarParametros(dto: UpdateEmpresaDto): Promise<Empresa> {
    return this.dataSource.transaction(async (manager) => {
      const empresaRepo = manager.getRepository(Empresa);
      const empresa = await empresaRepo.find({ take: 1 });
      const actual = empresa[0] ?? (await empresaRepo.save(empresaRepo.create(valoresPorDefecto())));

      const nuevoDiasGracia = dto.diasGraciaMora ?? actual.diasGraciaMora;
      const nuevoPorcentaje = dto.porcentajeMoraMensual ?? Number(actual.porcentajeMoraMensual);
      const cambiaTasa = nuevoDiasGracia !== actual.diasGraciaMora || nuevoPorcentaje !== Number(actual.porcentajeMoraMensual);

      if (cambiaTasa) {
        const historialRepo = manager.getRepository(HistorialTasaMora);
        const hoy = this.hoyComoFechaColumna();
        const filaDeHoy = await historialRepo.findOne({ where: { vigenteDesde: hoy as any } });
        if (filaDeHoy) {
          filaDeHoy.diasGraciaMora = nuevoDiasGracia;
          filaDeHoy.porcentajeMoraMensual = nuevoPorcentaje;
          await historialRepo.save(filaDeHoy);
        } else {
          await historialRepo.save(
            historialRepo.create({ diasGraciaMora: nuevoDiasGracia, porcentajeMoraMensual: nuevoPorcentaje, vigenteDesde: hoy as any }),
          );
        }
      }

      Object.assign(actual, dto);
      return empresaRepo.save(actual);
    });
  }

  /** Guarda la ruta pública del logo ya escrito en disco por Multer y limpia el archivo anterior. */
  async actualizarLogo(archivo: Express.Multer.File): Promise<Empresa> {
    const empresa = await this.obtener();
    const logoAnterior = empresa.logoUrl;

    empresa.logoUrl = `${PREFIJO_LOGO_PUBLICO}${archivo.filename}`;
    const guardada = await this.repo.save(empresa);

    if (logoAnterior?.startsWith(PREFIJO_LOGO_PUBLICO)) {
      await fs.unlink(join(process.cwd(), logoAnterior)).catch(() => undefined);
    }

    return guardada;
  }
}
