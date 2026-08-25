import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EstadoNovedad, ImpactoFinanciero, Novedad } from './entities/novedad.entity';
import { Rol } from '../../common/enums/roles.enum';
import { CreateNovedadDto } from './dto/create-novedad.dto';
import { FilterNovedadDto } from './dto/filter-novedad.dto';
import { CambiarEstadoNovedadDto } from './dto/cambiar-estado-novedad.dto';
import { AprobarCargoArrendatarioDto } from './dto/aprobar-cargo-arrendatario.dto';
import { AprobarGastoInmobiliariaDto } from './dto/aprobar-gasto-inmobiliaria.dto';
import { PagarGastoInmobiliariaDto } from './dto/pagar-gasto-inmobiliaria.dto';
import { Inmueble } from '../inmuebles/entities/inmueble.entity';
import { Contrato } from '../contratos/entities/contrato.entity';
import { ObligacionesService } from '../obligaciones/obligaciones.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { OrigenMovimiento } from '../movimientos/entities/movimiento.entity';
import { ConsecutivoService } from '../empresa/consecutivo.service';
import { paginar } from '../../common/utils/paginar.util';

@Injectable()
export class NovedadesService {
  constructor(
    @InjectRepository(Novedad) private readonly repo: Repository<Novedad>,
    @InjectRepository(Inmueble) private readonly inmuebleRepo: Repository<Inmueble>,
    @InjectRepository(Contrato) private readonly contratoRepo: Repository<Contrato>,
    private readonly obligacionesService: ObligacionesService,
    private readonly movimientosService: MovimientosService,
    private readonly consecutivoService: ConsecutivoService,
    private readonly dataSource: DataSource,
  ) {}

  /** Registro rápido en recepción — NO genera ningún impacto financiero. */
  async crear(dto: CreateNovedadDto, registradoPorEmail: string): Promise<Novedad> {
    return this.dataSource.transaction(async (manager) => {
      const inmueble = await manager.findOne(Inmueble, { where: { id: dto.inmuebleId } });
      if (!inmueble) throw new NotFoundException('Inmueble no encontrado.');

      let contrato: Contrato | null = null;
      if (dto.contratoId) {
        contrato = await manager.findOne(Contrato, { where: { id: dto.contratoId } });
        if (!contrato) throw new NotFoundException('Contrato no encontrado.');
      }

      // Consecutivo atómico ("NOV-000045"), obtenido dentro de esta misma transacción
      // para que quede ligado a la novedad (ver AUD-004/AUD-016).
      const { formateado } = await this.consecutivoService.siguiente('NOVEDAD', 'NOV-', manager);

      const novedad = manager.create(Novedad, {
        consecutivo: formateado,
        inmueble,
        contrato,
        descripcion: dto.descripcion,
        fecha: new Date(dto.fecha),
        observaciones: dto.observaciones ?? null,
        responsableSugerido: dto.responsableSugerido,
        estado: EstadoNovedad.ABIERTA,
        impactoFinanciero: ImpactoFinanciero.PENDIENTE,
        registradoPorEmail,
      });
      return manager.save(novedad);
    });
  }

  async listar(filtro: FilterNovedadDto) {
    const qb = this.repo.createQueryBuilder('n').leftJoinAndSelect('n.inmueble', 'inmueble');

    if (filtro.barrio) qb.andWhere('inmueble.barrio = :barrio', { barrio: filtro.barrio });
    if (filtro.estado) qb.andWhere('n.estado = :estado', { estado: filtro.estado });
    if (filtro.fechaDesde) qb.andWhere('n.fecha >= :desde', { desde: filtro.fechaDesde });
    if (filtro.fechaHasta) qb.andWhere('n.fecha <= :hasta', { hasta: filtro.fechaHasta });

    qb.orderBy('n.creadoEn', 'DESC');

    return paginar(qb, filtro.page, filtro.limit);
  }

  async obtener(id: string): Promise<Novedad> {
    const novedad = await this.repo.findOne({ where: { id }, relations: ['inmueble', 'contrato', 'contrato.cliente'] });
    if (!novedad) throw new NotFoundException('Novedad no encontrada.');
    return novedad;
  }

  /**
   * Tablero de novedades: ABIERTA -> EN_SEGUIMIENTO -> CERRADA / ANULADA.
   * Concluir una novedad (CERRADA o ANULADA) con `impactoFinanciero` aún `PENDIENTE` es, en la
   * práctica, una decisión financiera: para ANULADA, bloquea para siempre
   * `aprobarCargoArrendatario`/`aprobarGastoInmobiliaria` (ver `validarAprobable`); para
   * CERRADA, saca la novedad de las vistas de seguimiento operativo de Administrador aunque el
   * impacto financiero siga sin resolver (RDN-07 de la auditoría — antes solo se bloqueaba
   * ANULAR, dejando CERRADA como una vía sin esa misma protección). Por eso ambas transiciones
   * quedan exclusivas de Administrador cuando el impacto sigue pendiente; el resto de
   * transiciones sigue abierta a Recepcionista, consistente con "todo lo contable es del
   * Administrador" (AUD-031).
   */
  async cambiarEstado(id: string, dto: CambiarEstadoNovedadDto, rol: string): Promise<Novedad> {
    const novedad = await this.obtener(id);
    if (novedad.estado === EstadoNovedad.CERRADA || novedad.estado === EstadoNovedad.ANULADA) {
      throw new BadRequestException('La novedad ya está concluida y no admite cambios de estado.');
    }
    const concluyeSinResolver =
      (dto.estado === EstadoNovedad.ANULADA || dto.estado === EstadoNovedad.CERRADA) &&
      novedad.impactoFinanciero === ImpactoFinanciero.PENDIENTE;
    if (concluyeSinResolver && rol !== Rol.ADMINISTRADOR) {
      throw new ForbiddenException(
        'Esta novedad aún no tiene impacto financiero resuelto; solo el Administrador puede cerrarla o anularla.',
      );
    }
    novedad.estado = dto.estado;
    return this.repo.save(novedad);
  }

  /**
   * Aprobación financiera — EXCLUSIVO Administrador.
   * Genera una obligación tipo NOVEDAD cobrable en el próximo recaudo del contrato.
   * NOTA: la creación real de la Obligación se delega al módulo `obligaciones`
   * (integración pendiente de esa fase); aquí se deja el punto de enganche.
   */
  async aprobarCargoArrendatario(
    id: string,
    dto: AprobarCargoArrendatarioDto,
    aprobadoPorEmail: string,
  ): Promise<Novedad> {
    return this.dataSource.transaction(async (manager) => {
      const novedad = await manager
        .createQueryBuilder(Novedad, 'n')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('n.inmueble', 'inmueble')
        .leftJoinAndSelect('n.contrato', 'contrato')
        .where('n.id = :id', { id })
        .getOne();
      if (!novedad) throw new NotFoundException('Novedad no encontrada.');

      this.validarAprobable(novedad);
      if (!novedad.contrato) {
        throw new BadRequestException('La novedad no tiene un contrato vinculado; no se puede cargar al arrendatario.');
      }

      novedad.impactoFinanciero = ImpactoFinanciero.CARGO_ARRENDATARIO;
      novedad.montoAprobado = dto.monto;
      novedad.aprobadoPorEmail = aprobadoPorEmail;
      novedad.estado = EstadoNovedad.CERRADA;

      // Genera la obligación tipo NOVEDAD cobrable en el próximo recaudo del contrato.
      await this.obligacionesService.crearObligacionNovedad(
        {
          contratoId: novedad.contrato.id,
          monto: dto.monto,
          concepto: dto.concepto,
          novedadId: novedad.id,
        },
        manager,
      );

      return manager.save(novedad);
    });
  }

  /**
   * Aprobación financiera — EXCLUSIVO Administrador.
   * APROBADO ≠ PAGADO (§17/§18, hallazgo NOV-01 de la auditoría): esto solo deja el gasto
   * marcado como asumido por la inmobiliaria y pendiente de pago (`gastoPagado = false`).
   * NO genera ningún movimiento de caja/transferencia — eso ocurre únicamente en
   * `pagarGastoInmobiliaria`, cuando existe un desembolso real con medio de pago explícito.
   */
  async aprobarGastoInmobiliaria(
    id: string,
    dto: AprobarGastoInmobiliariaDto,
    aprobadoPorEmail: string,
  ): Promise<Novedad> {
    return this.dataSource.transaction(async (manager) => {
      const novedad = await manager
        .createQueryBuilder(Novedad, 'n')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('n.inmueble', 'inmueble')
        .leftJoinAndSelect('n.contrato', 'contrato')
        .where('n.id = :id', { id })
        .getOne();
      if (!novedad) throw new NotFoundException('Novedad no encontrada.');

      this.validarAprobable(novedad);

      novedad.impactoFinanciero = ImpactoFinanciero.GASTO_INMOBILIARIA;
      novedad.montoAprobado = dto.monto;
      novedad.aprobadoPorEmail = aprobadoPorEmail;
      novedad.estado = EstadoNovedad.CERRADA;
      novedad.gastoPagado = false;

      return manager.save(novedad);
    });
  }

  /**
   * Pago real de un gasto de inmobiliaria ya APROBADO — EXCLUSIVO Administrador.
   * Es el ÚNICO paso que genera el movimiento de caja tipo EGRESO (con el medio de pago
   * real: efectivo o transferencia), cerrando el flujo Novedad → APROBADO → PAGO REAL →
   * movimiento financiero de la sección 18 de la especificación.
   */
  async pagarGastoInmobiliaria(
    id: string,
    dto: PagarGastoInmobiliariaDto,
    registradoPorEmail: string,
  ): Promise<Novedad> {
    return this.dataSource.transaction(async (manager) => {
      const novedad = await manager
        .createQueryBuilder(Novedad, 'n')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('n.inmueble', 'inmueble')
        .leftJoinAndSelect('n.contrato', 'contrato')
        .where('n.id = :id', { id })
        .getOne();
      if (!novedad) throw new NotFoundException('Novedad no encontrada.');
      if (novedad.impactoFinanciero !== ImpactoFinanciero.GASTO_INMOBILIARIA) {
        throw new BadRequestException('Esta novedad no tiene un gasto de inmobiliaria aprobado.');
      }
      if (novedad.gastoPagado) {
        throw new BadRequestException('Este gasto ya fue pagado previamente.');
      }
      if (novedad.montoAprobado == null) {
        throw new BadRequestException('El gasto aprobado no tiene un monto válido.');
      }

      await this.movimientosService.registrarEgreso(
        {
          origen: OrigenMovimiento.NOVEDAD,
          concepto: `Pago gasto novedad ${novedad.consecutivo ?? novedad.id}`,
          monto: Number(novedad.montoAprobado),
          registradoPorEmail,
          novedadId: novedad.id,
          contratoId: novedad.contrato?.id,
          medioPago: dto.medioPago,
          referencia: dto.referencia ?? null,
        },
        manager,
      );

      novedad.gastoPagado = true;
      novedad.medioPagoGasto = dto.medioPago;
      novedad.referenciaPagoGasto = dto.referencia ?? null;
      novedad.fechaPagoGasto = new Date();
      novedad.pagadoPorEmail = registradoPorEmail;

      return manager.save(novedad);
    });
  }

  private validarAprobable(novedad: Novedad): void {
    if (novedad.impactoFinanciero !== ImpactoFinanciero.PENDIENTE) {
      throw new BadRequestException('Esta novedad ya fue resuelta financieramente.');
    }
    if (novedad.estado === EstadoNovedad.ANULADA) {
      throw new BadRequestException('No se puede aprobar una novedad anulada.');
    }
  }
}
