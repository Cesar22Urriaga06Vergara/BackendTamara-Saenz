import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EstadoObligacion, Obligacion, TipoObligacion } from './entities/obligacion.entity';
import { Contrato, EstadoContrato } from '../contratos/entities/contrato.entity';
import { Empresa } from '../empresa/entities/empresa.entity';
import { CrearObligacionNovedadDto } from './dto/crear-obligacion-novedad.dto';
import { paginar, ResultadoPaginado } from '../../common/utils/paginar.util';
import { redondearMoneda, esCeroMoneda } from '../../common/utils/dinero.util';

/**
 * Obligación con el flag `vencida` (fecha de vencimiento en el pasado) — lo que consume la
 * ficha de recaudo.
 */
export type ObligacionConVencida = Obligacion & { vencida: boolean };

@Injectable()
export class ObligacionesService {
  constructor(
    @InjectRepository(Obligacion) private readonly repo: Repository<Obligacion>,
    @InjectRepository(Contrato) private readonly contratoRepo: Repository<Contrato>,
    @InjectRepository(Empresa) private readonly empresaRepo: Repository<Empresa>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generación automática de obligaciones tipo CANON para todos los contratos ACTIVOS.
   * Para cada contrato genera el canon de CADA mes desde `contrato.fechaInicio` hasta el mes
   * en curso más `horizonteMesesCanon` (parámetro global de Empresa) de anticipación —
   * incluye el back-fill de meses vencidos que nunca se generaron (cron caído, migración de
   * datos, contrato creado antes de esta corrección). Evita duplicados por periodo.
   * Diseñado para ser invocado por un CRON (ScheduleModule) o manualmente por el Admin.
   */
  async generarCanonesMensuales(): Promise<{ generadas: number }> {
    const horizonte = await this.horizonteCanon();
    const contratosActivos = await this.contratoRepo.find({ where: { estado: EstadoContrato.ACTIVO } });

    let generadas = 0;
    for (const contrato of contratosActivos) {
      generadas += await this.generarCanonesParaContrato(contrato.id, { horizonteFuturo: horizonte });
    }
    return { generadas };
  }

  /**
   * Genera los canones faltantes de UN contrato. Sin `manager`, abre su propia transacción con
   * bloqueo pesimista sobre el contrato: serializa dos generaciones concurrentes del mismo
   * contrato (cron nocturno solapado con un disparo manual, o dos corridas del cron) para que
   * ninguna pase el chequeo "ya existe" al mismo tiempo y duplique canon — hallazgo CONC-01. El
   * índice único `(contratoId, tipo, periodo)` sobre `obligacion` es la garantía estructural
   * final. Con `manager` (ej. `ContratosService.crear`), se ejecuta dentro de la transacción del
   * llamador, que ya tiene el contrato aislado (recién creado o bloqueado).
   */
  async generarCanonesParaContrato(
    contratoId: string,
    opciones: { manager?: EntityManager; horizonteFuturo?: number } = {},
  ): Promise<number> {
    if (opciones.manager) {
      return this.generarCanonesEnManager(contratoId, opciones.manager, opciones.horizonteFuturo, false);
    }
    return this.dataSource.transaction((manager) =>
      this.generarCanonesEnManager(contratoId, manager, opciones.horizonteFuturo, true),
    );
  }

  private async generarCanonesEnManager(
    contratoId: string,
    manager: EntityManager,
    horizonteFuturo: number | undefined,
    bloquearContrato: boolean,
  ): Promise<number> {
    const contrato = bloquearContrato
      ? await manager
          .createQueryBuilder(Contrato, 'c')
          .setLock('pessimistic_write')
          .where('c.id = :id', { id: contratoId })
          .getOne()
      : await manager.findOne(Contrato, { where: { id: contratoId } });
    // Pudo haber sido terminado/eliminado entre el listado inicial y la obtención del lock.
    if (!contrato || contrato.estado !== EstadoContrato.ACTIVO) return 0;

    const horizonte = horizonteFuturo ?? (await this.horizonteCanon(manager));
    const repo = manager.getRepository(Obligacion);

    const inicioContrato = this.fechaLocalDesdeColumnaDate(contrato.fechaInicio);
    const primerPeriodo = this.primerDiaMes(inicioContrato);
    const hoy = new Date();
    // Último periodo a generar: mes en curso + (horizonte - 1) meses de anticipación.
    const ultimoPeriodo = new Date(hoy.getFullYear(), hoy.getMonth() + Math.max(0, horizonte - 1), 1);

    let generadas = 0;
    for (
      let periodo = new Date(primerPeriodo);
      periodo.getTime() <= ultimoPeriodo.getTime();
      periodo = new Date(periodo.getFullYear(), periodo.getMonth() + 1, 1)
    ) {
      const yaExiste = await repo.findOne({
        where: { contrato: { id: contrato.id }, tipo: TipoObligacion.CANON, periodo },
      });
      if (yaExiste) continue;

      // `contrato.diaPago` puede ser 29-31; si el mes del periodo tiene menos días, se usa el
      // último día real del mes en vez de dejar que `Date` haga overflow al mes siguiente
      // (ej: diaPago=31 en febrero no debe vencer el 2-3 de marzo).
      const ultimoDiaDelMes = new Date(periodo.getFullYear(), periodo.getMonth() + 1, 0).getDate();
      let fechaVencimiento = new Date(
        periodo.getFullYear(),
        periodo.getMonth(),
        Math.min(contrato.diaPago, ultimoDiaDelMes),
      );
      // El primer canon nunca vence antes del inicio del contrato (LB-7): un contrato que
      // arranca el 18 con diaPago=5 no nace ya "vencido" el día 5 de ese mes.
      if (fechaVencimiento.getTime() < inicioContrato.getTime()) {
        fechaVencimiento = inicioContrato;
      }

      await repo.save(
        repo.create({
          contrato,
          tipo: TipoObligacion.CANON,
          concepto: `Canon de arrendamiento ${this.formatoPeriodo(periodo)}`,
          periodo,
          fechaVencimiento,
          valorOriginal: contrato.canonValor,
          estado: EstadoObligacion.PENDIENTE,
        }),
      );
      generadas++;
    }
    return generadas;
  }

  private async horizonteCanon(manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(Empresa) : this.empresaRepo;
    const empresa = await repo.find({ take: 1 });
    return empresa[0]?.horizonteMesesCanon ?? 3;
  }

  /** Crea la obligación tipo NOVEDAD al ser aprobada por el Administrador. */
  async crearObligacionNovedad(dto: CrearObligacionNovedadDto, manager?: EntityManager): Promise<Obligacion> {
    const repo = manager ? manager.getRepository(Obligacion) : this.repo;
    const contratoRepo = manager ? manager.getRepository(Contrato) : this.contratoRepo;

    const contrato = await contratoRepo.findOne({ where: { id: dto.contratoId } });
    if (!contrato) throw new NotFoundException('Contrato no encontrado.');

    const hoy = new Date();
    const obligacion = repo.create({
      contrato,
      tipo: TipoObligacion.NOVEDAD,
      concepto: dto.concepto,
      periodo: hoy,
      fechaVencimiento: hoy,
      valorOriginal: dto.monto,
      estado: EstadoObligacion.PENDIENTE,
      novedadOrigenId: dto.novedadId,
    });
    return repo.save(obligacion);
  }

  /**
   * Obligaciones con saldo por cobrar de un contrato: capital PENDIENTE/PARCIAL. Incluye tanto
   * las VENCIDAS como las que aún no vencen (el cajero debe poder cobrar un canon por
   * adelantado); cada una trae `vencida` para que la ficha las separe en "Vencidas" / "Por
   * vencer".
   */
  async pendientesPorContrato(contratoId: string): Promise<ObligacionConVencida[]> {
    const obligaciones = await this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.contrato', 'contrato')
      .leftJoinAndSelect('contrato.cliente', 'cliente')
      .leftJoinAndSelect('contrato.inmueble', 'inmueble')
      .where('o.contratoId = :contratoId', { contratoId })
      .andWhere(this.condicionSaldoPendiente())
      .setParameters(this.parametrosCondicionSaldoPendiente())
      .orderBy('o.fechaVencimiento', 'ASC')
      .getMany();

    return obligaciones.map((o) => ({ ...o, vencida: this.esVencida(o.fechaVencimiento) }));
  }

  private queryTodasPendientes() {
    return this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.contrato', 'contrato')
      .leftJoinAndSelect('contrato.cliente', 'cliente')
      .leftJoinAndSelect('contrato.inmueble', 'inmueble')
      .where(this.condicionCarteraVencida())
      .setParameters(this.parametrosCondicionSaldoPendiente())
      .orderBy('o.fechaVencimiento', 'ASC');
  }

  /**
   * Cartera CONSOLIDADA (solo lo VENCIDO): toda obligación con saldo de capital por cobrar cuyo
   * `fechaVencimiento` ya pasó. El canon generado por adelantado para meses que aún no vencen
   * NO cuenta como deuda (decisión de negocio). Base del reporte de cartera (Excel), de la
   * pantalla Cartera y de la cifra `carteraTotal` del dashboard.
   */
  async todasPendientes(): Promise<Obligacion[]> {
    return this.queryTodasPendientes().getMany();
  }

  /**
   * Misma cartera vencida que `todasPendientes()`, paginada — para la pantalla interactiva
   * de Cartera (a diferencia del reporte Excel, que necesita el listado completo de una vez).
   */
  async todasPendientesPaginadas(
    page?: string | number,
    limit?: string | number,
  ): Promise<ResultadoPaginado<Obligacion>> {
    return paginar(this.queryTodasPendientes(), page, limit);
  }

  /**
   * Condición SQL compartida (usada también por `RecaudoService.registrarPago`): una
   * obligación tiene saldo por cobrar si su capital sigue PENDIENTE/PARCIAL. NO filtra por
   * fecha: incluye canon por vencer (pago adelantado).
   */
  condicionSaldoPendiente(alias = 'o'): string {
    return `${alias}.estado IN (:...estadosCapitalPendiente)`;
  }

  /**
   * Cartera VENCIDA: `condicionSaldoPendiente` + `fechaVencimiento <= hoy`. Es "lo que
   * realmente se debe" — separa la deuda exigible del canon generado por adelantado.
   */
  condicionCarteraVencida(alias = 'o'): string {
    return `(${this.condicionSaldoPendiente(alias)} AND ${alias}.fechaVencimiento <= CURDATE())`;
  }

  parametrosCondicionSaldoPendiente() {
    return {
      estadosCapitalPendiente: [EstadoObligacion.PENDIENTE, EstadoObligacion.PARCIAL],
    };
  }

  /** `true` si la obligación ya venció (fecha de vencimiento en el pasado o es hoy). */
  esVencida(fechaVencimiento: Date | string): boolean {
    const venc = this.fechaLocalDesdeColumnaDate(fechaVencimiento);
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    return venc.getTime() <= hoy.getTime();
  }

  /**
   * TypeORM hidrata una columna `type: 'date'` como STRING "YYYY-MM-DD", no como `Date`
   * (`DateUtils.mixedDateToDateString` en el driver), pese a que el tipo TS declarado en la
   * entidad es `Date`. `new Date("YYYY-MM-DD")` interpreta ese string como medianoche UTC
   * (ECMA-262), que en una zona horaria negativa (Bogotá, UTC-5) cae en el día calendario
   * ANTERIOR al leer sus componentes locales — corriendo `fechaVencimiento` un día hacia
   * atrás. Parsear los componentes Y-M-D directamente evita el parseo ISO-UTC del constructor
   * `Date` y construye la fecha en el día calendario local correcto, sin importar la zona
   * horaria del servidor.
   */
  private fechaLocalDesdeColumnaDate(valor: Date | string): Date {
    if (typeof valor === 'string') {
      const [anio, mes, dia] = valor.split('-').map(Number);
      return new Date(anio, mes - 1, dia);
    }
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }

  async obtener(id: string): Promise<Obligacion> {
    const obligacion = await this.repo.findOne({ where: { id }, relations: ['contrato'] });
    if (!obligacion) throw new NotFoundException('Obligación no encontrada.');
    return obligacion;
  }

  /**
   * Anula manualmente una obligación generada por error (ej. canon duplicado, cargo
   * mal calculado), sin pasar por un pago simulado. Solo procede si sigue PENDIENTE
   * (sin ningún abono aplicado) — una obligación PARCIAL/PAGADA debe corregirse
   * revirtiendo el pago real desde Recaudo, no anulándose aquí.
   *
   * Hallazgo CONC-04 de la auditoría: sin lock pesimista, dos anulaciones simultáneas sobre
   * la misma obligación PENDIENTE podían pasar ambas la verificación de estado y la segunda
   * sobrescribir silenciosamente el motivo de la primera. La transacción + `pessimistic_write`
   * serializa ambas solicitudes: la segunda, tras esperar el lock, relee un estado ya ANULADA
   * y falla con el mismo 400 que cualquier otro intento de anular dos veces.
   */
  async anular(id: string, motivo: string): Promise<Obligacion> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Obligacion);
      const obligacion = await repo
        .createQueryBuilder('o')
        .setLock('pessimistic_write')
        .where('o.id = :id', { id })
        .getOne();
      if (!obligacion) throw new NotFoundException('Obligación no encontrada.');
      if (obligacion.estado !== EstadoObligacion.PENDIENTE) {
        throw new BadRequestException(
          'Solo se puede anular una obligación pendiente sin abonos aplicados. Si ya tiene pagos, revierta el pago desde Recaudo.',
        );
      }
      obligacion.estado = EstadoObligacion.ANULADA;
      obligacion.motivoAnulacion = motivo;
      return repo.save(obligacion);
    });
  }

  /**
   * Aplica un abono a la obligación (usado por RecaudoService dentro de una transacción).
   * `valorAbonado` se redondea a 2 decimales en cada escritura (hallazgo B2 de la auditoría
   * contable 2026-09-01): sin este punto único de redondeo, el drift de punto flotante entre
   * lo que el código calcula y lo que MariaDB persiste (`decimal(12,2)`) podía dejar una
   * obligación atascada en PARCIAL por fracciones de centavo. `>= valorOriginal` se evalúa con
   * la misma tolerancia (`esCeroMoneda` sobre la diferencia) para no depender de que ambos
   * lados redondeen exactamente igual.
   */
  async aplicarAbono(id: string, monto: number, manager: EntityManager): Promise<Obligacion> {
    const repo = manager.getRepository(Obligacion);
    const obligacion = await repo
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.id = :id', { id })
      .getOneOrFail();

    obligacion.valorAbonado = redondearMoneda(Number(obligacion.valorAbonado) + monto);
    const saldoRestante = Number(obligacion.valorOriginal) - Number(obligacion.valorAbonado);
    obligacion.estado =
      saldoRestante <= 0 || esCeroMoneda(saldoRestante) ? EstadoObligacion.PAGADA : EstadoObligacion.PARCIAL;

    return repo.save(obligacion);
  }

  /**
   * Revierte exactamente un abono previamente aplicado (usado al anular un recibo).
   * Nunca queda en negativo: resta el monto y recalcula el estado (PAGADA/PARCIAL/PENDIENTE).
   * Igual que `aplicarAbono`, redondea en cada escritura y trata un residuo por debajo de medio
   * centavo como cero, para no dejar la obligación en PARCIAL "fantasma" tras un reverso exacto.
   */
  async revertirAbono(id: string, monto: number, manager: EntityManager): Promise<Obligacion> {
    const repo = manager.getRepository(Obligacion);
    const obligacion = await repo
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.id = :id', { id })
      .getOneOrFail();

    const restante = redondearMoneda(Number(obligacion.valorAbonado) - monto);
    obligacion.valorAbonado = esCeroMoneda(restante) ? 0 : Math.max(0, restante);
    obligacion.estado =
      obligacion.valorAbonado <= 0
        ? EstadoObligacion.PENDIENTE
        : Number(obligacion.valorAbonado) >= Number(obligacion.valorOriginal)
          ? EstadoObligacion.PAGADA
          : EstadoObligacion.PARCIAL;

    return repo.save(obligacion);
  }

  /**
   * @deprecated Solo existe para poder revertir, con el método correcto, un recibo histórico
   * cuya `AplicacionPago.concepto` haya quedado en `MORA` (columna heredada del motor de mora,
   * retirado por decisión de negocio el 2026-09-01 — ver `RecaudoService.anular`). El motor
   * actual nunca genera abonos de concepto MORA; no usar en código nuevo.
   */
  async revertirAbonoMora(id: string, monto: number, manager: EntityManager): Promise<Obligacion> {
    const repo = manager.getRepository(Obligacion);
    const obligacion = await repo
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.id = :id', { id })
      .getOneOrFail();
    const restante = redondearMoneda(Number(obligacion.valorMoraPagada) - monto);
    obligacion.valorMoraPagada = esCeroMoneda(restante) ? 0 : Math.max(0, restante);
    return repo.save(obligacion);
  }

  /**
   * Decisión de negocio RDN-04 / hallazgo CONT-05 de la auditoría: cuando un contrato
   * termina antes de los periodos que `generarCanonesMensuales` ya generó por adelantado
   * (`horizonteMesesCanon`), esas obligaciones CANON futuras quedaban `PENDIENTE`
   * indefinidamente — cartera fantasma de un contrato que ya no existe. Se anulan aquí de
   * forma automática, pero SOLO las que siguen `PENDIENTE` (sin ningún abono): una
   * obligación con abono parcial (`PARCIAL`) es deuda real ya generada durante la vigencia
   * del contrato y no debe ocultarse anulándola (§8.3 — la anulación no es un mecanismo para
   * esconder deuda que no se desea cobrar). Se ejecuta dentro de la misma transacción que
   * `ContratosService.terminar()`, propagando su `manager`.
   */
  async anularCanonPosteriorATerminacion(contratoId: string, fechaFin: Date, manager: EntityManager): Promise<number> {
    const repo = manager.getRepository(Obligacion);
    const canonesFuturos = await repo
      .createQueryBuilder('o')
      .where('o.contratoId = :contratoId', { contratoId })
      .andWhere('o.tipo = :tipo', { tipo: TipoObligacion.CANON })
      .andWhere('o.estado = :estado', { estado: EstadoObligacion.PENDIENTE })
      .andWhere('o.fechaVencimiento > :fechaFin', { fechaFin })
      .getMany();

    for (const obligacion of canonesFuturos) {
      obligacion.estado = EstadoObligacion.ANULADA;
      obligacion.motivoAnulacion = 'Contrato terminado antes de este periodo (anulación automática).';
      await repo.save(obligacion);
    }
    return canonesFuturos.length;
  }

  private primerDiaMes(fecha: Date): Date {
    return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  }

  private formatoPeriodo(fecha: Date): string {
    return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(fecha);
  }
}
