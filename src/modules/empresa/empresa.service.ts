import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa } from './entities/empresa.entity';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

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
      horizonteMesesCanon: Number(this.configService.get<number>('HORIZONTE_MESES_CANON') ?? 3),
      saldoInicialCaja: 0,
      actualizadoEn: new Date(),
    };
  }

  async obtener(): Promise<Empresa> {
    const empresa = await this.repo.find({ take: 1 });
    if (!empresa[0]) {
      return this.empresaPredeterminada();
    }
    return empresa[0];
  }

  async obtenerBranding(): Promise<Pick<Empresa, 'nombre' | 'slogan'>> {
    const [empresa] = await this.repo.find({ order: { actualizadoEn: 'DESC' }, take: 1 });
    if (empresa) {
      return { nombre: empresa.nombre, slogan: empresa.slogan };
    }

    const predeterminada = this.empresaPredeterminada();
    return { nombre: predeterminada.nombre, slogan: predeterminada.slogan };
  }

  async actualizarParametros(dto: UpdateEmpresaDto): Promise<Empresa> {
    const empresa = await this.repo.find({ take: 1 });
    const actual = empresa[0] ?? this.repo.create({ ...this.empresaPredeterminada(), ...dto });
    Object.assign(actual, dto);
    return this.repo.save(actual);
  }
}
