import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { Empresa } from './entities/empresa.entity';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import {
  PREFIJO_PUBLICO_LOGO as PREFIJO_LOGO_PUBLICO,
  rutaFisicaDesdeUrlPublica,
} from '../../common/utils/rutas-archivos.util';

@Injectable()
export class EmpresaService {
  constructor(
    @InjectRepository(Empresa) private readonly repo: Repository<Empresa>,
    private readonly configService: ConfigService,
  ) {}

  private empresaPredeterminada(): Empresa {
    return {
      id: 'inicial',
      nombre: this.configService.get<string>('EMPRESA_NOMBRE') || 'Inversiones Tamara & Saenz S. En C.',
      nit: this.configService.get<string>('EMPRESA_NIT') || 'PENDIENTE-POR-CONFIGURAR',
      slogan: this.configService.get<string>('EMPRESA_SLOGAN') || 'Resolvemos tu situacion',
      direccion: null,
      telefono: null,
      logoUrl: null,
      horizonteMesesCanon: Number(this.configService.get<number>('HORIZONTE_MESES_CANON') ?? 3),
      saldoInicialCaja: 0,
      actualizadoEn: new Date(),
    } as Empresa;
  }

  async obtener(): Promise<Empresa> {
    const empresa = await this.repo.find({ take: 1 });
    if (!empresa[0]) {
      return this.empresaPredeterminada();
    }
    return empresa[0];
  }

  async obtenerBranding(): Promise<Pick<Empresa, 'nombre' | 'slogan' | 'logoUrl'>> {
    const [empresa] = await this.repo.find({ order: { actualizadoEn: 'DESC' }, take: 1 });
    if (empresa) {
      return { nombre: empresa.nombre, slogan: empresa.slogan, logoUrl: empresa.logoUrl };
    }

    const predeterminada = this.empresaPredeterminada();
    return { nombre: predeterminada.nombre, slogan: predeterminada.slogan, logoUrl: predeterminada.logoUrl };
  }

  async actualizarParametros(dto: UpdateEmpresaDto): Promise<Empresa> {
    const empresa = await this.repo.find({ take: 1 });
    const actual = empresa[0] ?? this.repo.create({ ...this.empresaPredeterminada(), ...dto });
    Object.assign(actual, dto);
    return this.repo.save(actual);
  }

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
