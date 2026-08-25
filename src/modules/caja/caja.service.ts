import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArqueoCaja } from './entities/arqueo-caja.entity';
import { RegistrarArqueoDto } from './dto/registrar-arqueo.dto';
import { MovimientosService } from '../movimientos/movimientos.service';
import { EmpresaService } from '../empresa/empresa.service';
import { paginar, ResultadoPaginado } from '../../common/utils/paginar.util';

export interface SaldoEsperadoCaja {
  saldoInicial: number;
  ingresosEfectivo: number;
  egresosEfectivo: number;
  devolucionesEfectivo: number;
  saldoEsperado: number;
}

/**
 * Módulo de Caja (§15 de la especificación, hallazgo CAJA-02 de la auditoría): antes no existía
 * ningún mecanismo para controlar saldo inicial, conteo físico ni diferencia contra lo esperado
 * — "saldo neto de caja" era solo una suma de movimientos, sin punto de partida ni arqueo.
 * Se apoya en `MovimientosService.desgloseEfectivo()` (que a su vez depende de `medioPago` en
 * `Movimiento`, hallazgo CAJA-01) para no duplicar el ledger financiero: Caja SOLO reconcilia,
 * nunca genera movimientos propios.
 */
@Injectable()
export class CajaService {
  constructor(
    @InjectRepository(ArqueoCaja) private readonly repo: Repository<ArqueoCaja>,
    private readonly movimientosService: MovimientosService,
    private readonly empresaService: EmpresaService,
  ) {}

  /**
   * Saldo esperado según el libro de movimientos, EN VIVO (sin registrar ningún arqueo) —
   * fórmula exacta del §15: saldo inicial + ingresos efectivo - egresos efectivo - devoluciones
   * efectivo. Reconciliación histórica completa (life-to-date), no por período: la
   * especificación no define un mecanismo de "cierre" que reinicie el conteo.
   */
  async saldoEsperadoActual(): Promise<SaldoEsperadoCaja> {
    const empresa = await this.empresaService.obtener();
    const { ingresos, egresos, devoluciones } = await this.movimientosService.desgloseEfectivo();
    const saldoInicial = Number(empresa.saldoInicialCaja);

    return {
      saldoInicial,
      ingresosEfectivo: ingresos,
      egresosEfectivo: egresos,
      devolucionesEfectivo: devoluciones,
      saldoEsperado: saldoInicial + ingresos - egresos - devoluciones,
    };
  }

  /**
   * Registra un arqueo: congela el saldo esperado calculado en este instante junto con el
   * conteo físico real, y calcula la diferencia. El arqueo queda como un registro histórico
   * inmutable — nunca se edita ni se borra (mismo principio que `Movimiento`/`ReciboCaja`).
   */
  async registrarArqueo(dto: RegistrarArqueoDto, registradoPorEmail: string): Promise<ArqueoCaja> {
    const { saldoInicial, ingresosEfectivo, egresosEfectivo, devolucionesEfectivo, saldoEsperado } =
      await this.saldoEsperadoActual();

    const arqueo = this.repo.create({
      saldoInicial,
      ingresosEfectivo,
      egresosEfectivo,
      devolucionesEfectivo,
      saldoEsperado,
      saldoContado: dto.saldoContado,
      diferencia: Math.round((dto.saldoContado - saldoEsperado) * 100) / 100,
      observaciones: dto.observaciones ?? null,
      registradoPorEmail,
    });
    return this.repo.save(arqueo);
  }

  async listar(page?: string | number, limit?: string | number): Promise<ResultadoPaginado<ArqueoCaja>> {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.creadoEn', 'DESC');
    return paginar(qb, page, limit);
  }

  async obtener(id: string): Promise<ArqueoCaja> {
    const arqueo = await this.repo.findOne({ where: { id } });
    if (!arqueo) throw new NotFoundException('Arqueo de caja no encontrado.');
    return arqueo;
  }
}
