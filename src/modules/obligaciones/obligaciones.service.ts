import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EstadoObligacion, Obligacion, TipoObligacion } from './entities/obligacion.entity';
import { Contrato, EstadoContrato } from '../contratos/entities/contrato.entity';
import { Empresa } from '../empresa/entities/empresa.entity';
import { HistorialTasaMora } from '../empresa/entities/historial-tasa-mora.entity';
import { CrearObligacionNovedadDto } from './dto/crear-obligacion-novedad.dto';

@Injectable()
export class ObligacionesService {
  constructor(
    @InjectRepository(Obligacion) private readonly repo: Repository<Obligacion>,
    @InjectRepository(Contrato) private readonly contratoRepo: Repository<Contrato>,
    @InjectRepository(Empresa) private readonly empresaRepo: Repository<Empresa>,
    @InjectRepository(HistorialTasaMora) private readonly historialTasaRepo: Repository<HistorialTasaMora>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Generación mensual automática de obligaciones tipo CANON.
   * Se ejecuta para cada contrato ACTIVO, respetando `horizonteMesesCanon` (parámetro
   * global de Empresa): evita generar canon duplicado si ya existe para ese periodo.
   * Diseñado para ser invocado por un CRON (ScheduleModule) o manualmente por el Admin.
   */
  async generarCanonesMensuales(): Promise<{ generadas: number }> {
    const empresa = await this.empresaRepo.find({ take: 1 });
    const horizonte = empresa[0]?.horizonteMesesCanon ?? 3;
    const contratosActivos = await this.contratoRepo.find({ where: { estado: EstadoContrato.ACTIVO } });

    let generadas = 0;
    for (const contrato of contratosActivos) {
      generadas += await this.generarCanonesDeContrato(contrato.id, horizonte);
    }
    return { generadas };
  }

  /**
   * Genera los canones pendientes de UN contrato dentro de su propia transacción, con
   * bloqueo pesimista sobre el contrato: serializa dos generaciones concurrentes del mismo
   * contrato (ej. el cron nocturno solapándose con un disparo manual del Administrador, o dos
   * corridas del cron) para que ninguna pase el chequeo "ya existe" al mismo tiempo y termine
   * duplicando canon — hallazgo CONC-01 de la auditoría. El índice único
   * `(contratoId, tipo, periodo)` sobre `obligacion` (ver migración) es la garantía
   * estructural final, incluso si algún código futuro llegara a saltarse este lock. Cada
   * contrato en su propia transacción, en vez de una transacción para todo el lote, para que
   * un problema puntual en un contrato no revierta lo ya generado para los demás.
   */
  private async generarCanonesDeContrato(contratoId: string, horizonte: number): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const contrato = await manager
        .createQueryBuilder(Contrato, 'c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: contratoId })
        .getOne();
      // Pudo haber sido terminado/eliminado entre el listado inicial y la obtención del lock.
      if (!contrato || contrato.estado !== EstadoContrato.ACTIVO) return 0;

      const repo = manager.getRepository(Obligacion);
      let generadas = 0;

      for (let i = 0; i < horizonte; i++) {
        const periodo = this.primerDiaMes(this.sumarMeses(new Date(), i));
        const yaExiste = await repo.findOne({
          where: { contrato: { id: contrato.id }, tipo: TipoObligacion.CANON, periodo },
        });
        if (yaExiste) continue;

        // `contrato.diaPago` puede ser 29-31; si el mes del periodo tiene menos días,
        // se usa el último día real del mes en vez de dejar que `Date` haga overflow
        // al mes siguiente (ej: diaPago=31 en febrero no debe vencer el 2-3 de marzo).
        const ultimoDiaDelMes = new Date(periodo.getFullYear(), periodo.getMonth() + 1, 0).getDate();
        const fechaVencimiento = new Date(
          periodo.getFullYear(),
          periodo.getMonth(),
          Math.min(contrato.diaPago, ultimoDiaDelMes),
        );

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
    });
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
   * Obligaciones con saldo por cobrar de un contrato: capital pendiente/parcial, MÁS las que
   * ya tienen el capital PAGADA pero aún les queda mora sin cobrar (posible cuando un pago
   * alcanzó para saldar canon/novedad pero no toda la mora congelada — hallazgo RECAUDO-01).
   * Mora pendiente recalculada al momento de la consulta.
   */
  async pendientesPorContrato(contratoId: string): Promise<Obligacion[]> {
    const historial = await this.obtenerHistorialTasas();

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

    return obligaciones.map((o) => ({ ...o, valorMoraAcumulada: this.moraPendiente(o, historial) }));
  }

  /**
   * Todas las obligaciones con saldo por cobrar del sistema (capital pendiente/parcial, o
   * capital PAGADA con mora aún sin cobrar), con mora pendiente recalculada. Base del reporte
   * consolidado de cartera (Excel) y de la cifra `carteraTotal` del dashboard.
   */
  async todasPendientes(): Promise<Obligacion[]> {
    const historial = await this.obtenerHistorialTasas();

    const obligaciones = await this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.contrato', 'contrato')
      .leftJoinAndSelect('contrato.cliente', 'cliente')
      .leftJoinAndSelect('contrato.inmueble', 'inmueble')
      .where(this.condicionSaldoPendiente())
      .setParameters(this.parametrosCondicionSaldoPendiente())
      .orderBy('o.fechaVencimiento', 'ASC')
      .getMany();

    return obligaciones.map((o) => ({ ...o, valorMoraAcumulada: this.moraPendiente(o, historial) }));
  }

  /**
   * Condición SQL compartida (usada también por `RecaudoService.registrarPago`): una
   * obligación tiene saldo por cobrar si su capital sigue PENDIENTE/PARCIAL, o si ya quedó
   * PAGADA pero la mora congelada supera lo ya pagado de mora.
   */
  condicionSaldoPendiente(alias = 'o'): string {
    return `(${alias}.estado IN (:...estadosCapitalPendiente) OR (${alias}.estado = :estadoPagada AND ${alias}.valorMoraAcumulada > ${alias}.valorMoraPagada))`;
  }

  parametrosCondicionSaldoPendiente() {
    return {
      estadosCapitalPendiente: [EstadoObligacion.PENDIENTE, EstadoObligacion.PARCIAL],
      estadoPagada: EstadoObligacion.PAGADA,
    };
  }

  /**
   * Historial completo de tasas de mora (§MORA-02), ordenado ascendente por `vigenteDesde`.
   * `calcularMoraViva` prorratea cada obligación segmento por segmento contra este historial,
   * en vez de aplicar la tasa actual a la totalidad de los días de atraso.
   */
  async obtenerHistorialTasas(): Promise<HistorialTasaMora[]> {
    const historial = await this.historialTasaRepo.find({ order: { vigenteDesde: 'ASC' } });
    if (historial.length > 0) return historial;

    // Defensivo: solo puede ocurrir si la migración de siembra no llegó a ejecutarse.
    const empresa = await this.empresaRepo.find({ take: 1 });
    return [
      {
        id: '',
        diasGraciaMora: empresa[0]?.diasGraciaMora ?? 5,
        porcentajeMoraMensual: Number(empresa[0]?.porcentajeMoraMensual ?? 1.5),
        vigenteDesde: '2000-01-01',
        creadoEn: new Date(),
      },
    ];
  }

  /**
   * TypeORM hidrata una columna `type: 'date'` como STRING "YYYY-MM-DD", no como `Date`
   * (`DateUtils.mixedDateToDateString` en el driver), pese a que el tipo TS declarado en la
   * entidad es `Date`. `new Date("YYYY-MM-DD")` interpreta ese string como medianoche UTC
   * (ECMA-262), que en una zona horaria negativa (Bogotá, UTC-5) cae en el día calendario
   * ANTERIOR al leer sus componentes locales — corriendo `fechaVencimiento` un día hacia
   * atrás y sobreestimando la mora en 1 día. Parsear los componentes Y-M-D directamente evita
   * el parseo ISO-UTC del constructor `Date` y construye la fecha en el día calendario local
   * correcto, sin importar la zona horaria del servidor.
   */
  private fechaLocalDesdeColumnaDate(valor: Date | string): Date {
    if (typeof valor === 'string') {
      const [anio, mes, dia] = valor.split('-').map(Number);
      return new Date(anio, mes - 1, dia);
    }
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }

  /** Cuenta días de calendario COMPLETOS incluyendo ambos extremos (ej: mismo día → 1). */
  private diasEntreInclusive(desde: Date, hasta: Date): number {
    return Math.floor((hasta.getTime() - desde.getTime()) / 86400000) + 1;
  }

  /**
   * Tasa vigente en `fecha`: la última fila del historial (ascendente por `vigenteDesde`) cuyo
   * `vigenteDesde` no sea posterior a `fecha`. El historial siempre trae al menos una fila
   * (sembrada por migración o por el fallback de `obtenerHistorialTasas`), así que se usa la
   * primera como piso para cualquier fecha anterior a su propio `vigenteDesde`.
   */
  private tasaVigenteEn(historial: HistorialTasaMora[], fecha: Date): HistorialTasaMora {
    let vigente = historial[0];
    for (const fila of historial) {
      if (this.fechaLocalDesdeColumnaDate(fila.vigenteDesde).getTime() <= fecha.getTime()) vigente = fila;
      else break;
    }
    return vigente;
  }

  /**
   * Mora "en vivo": % mensual prorrateado por días de atraso tras el periodo de gracia, sobre
   * el capital pendiente actual.
   *
   * Hallazgo MORA-01 de la auditoría: el ejemplo oficial de la especificación (§11.1) define
   * la gracia como días de calendario INCLUSIVOS contando desde `fechaVencimiento` — con
   * fecha de pago 10-ago y 5 días de gracia, el período de gracia es 10,11,12,13,14 (5 días)
   * y "la mora inicia el 15 de agosto". Es decir, el ÚLTIMO día de gracia es
   * `fechaVencimiento + diasGracia - 1`, no `fechaVencimiento + diasGracia`.
   *
   * Hallazgo MORA-02 de la auditoría: en vez de aplicar una única tasa plana a la totalidad de
   * los días de atraso, el cálculo recorre `historial` (ordenado ascendente por `vigenteDesde`)
   * y prorratea segmento por segmento — cada tramo de días paga la tasa que efectivamente
   * estuvo vigente durante esos días, así un cambio de tasa hoy nunca reabre el cálculo de
   * días que ya transcurrieron bajo la tasa anterior. `diasGraciaMora` se toma de la tasa
   * vigente al momento del vencimiento (define cuándo empieza a correr la mora); cada tramo
   * posterior usa su propio `porcentajeMoraMensual`.
   */
  private calcularMoraViva(obligacion: Obligacion, historial: HistorialTasaMora[]): number {
    const saldo = Number(obligacion.valorOriginal) - Number(obligacion.valorAbonado);
    if (saldo <= 0 || historial.length === 0) return 0;

    const vencimiento = this.fechaLocalDesdeColumnaDate(obligacion.fechaVencimiento);
    const tasaAlVencer = this.tasaVigenteEn(historial, vencimiento);

    const ultimoDiaDeGracia = new Date(vencimiento);
    ultimoDiaDeGracia.setDate(ultimoDiaDeGracia.getDate() + tasaAlVencer.diasGraciaMora - 1);

    const inicioMora = new Date(ultimoDiaDeGracia);
    inicioMora.setDate(inicioMora.getDate() + 1);

    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    if (hoy.getTime() < inicioMora.getTime()) return 0;

    let mora = 0;
    for (let i = 0; i < historial.length; i++) {
      const desde = this.fechaLocalDesdeColumnaDate(historial[i].vigenteDesde);
      let hasta = hoy;
      if (i + 1 < historial.length) {
        hasta = this.fechaLocalDesdeColumnaDate(historial[i + 1].vigenteDesde);
        hasta.setDate(hasta.getDate() - 1);
      }

      const segmentoInicio = desde.getTime() > inicioMora.getTime() ? desde : inicioMora;
      const segmentoFin = hasta.getTime() < hoy.getTime() ? hasta : hoy;
      if (segmentoInicio.getTime() > segmentoFin.getTime()) continue;

      const dias = this.diasEntreInclusive(segmentoInicio, segmentoFin);
      const moraDiaria = (saldo * (Number(historial[i].porcentajeMoraMensual) / 100)) / 30;
      mora += moraDiaria * dias;
    }

    return Math.round(mora * 100) / 100;
  }

  /**
   * Mora pendiente de cobro = el mayor valor entre la mora ya "congelada" (`valorMoraAcumulada`)
   * y la recién calculada en vivo, menos lo que ya se pagó (`valorMoraPagada`). Nunca negativa.
   * Es un cálculo puro de lectura (no persiste); para congelar el valor antes de un pago, usar
   * `congelarMora`.
   */
  private moraPendiente(obligacion: Obligacion, historial: HistorialTasaMora[]): number {
    const viva = this.calcularMoraViva(obligacion, historial);
    const congelada = Math.max(Number(obligacion.valorMoraAcumulada), viva);
    return Math.max(0, Math.round((congelada - Number(obligacion.valorMoraPagada)) * 100) / 100);
  }

  /**
   * Congela (ratchet) la mora acumulada de una obligación en `valorMoraAcumulada`, tomando el
   * mayor valor entre lo ya registrado y la mora en vivo actual. Debe llamarse ANTES de aplicar
   * cualquier abono de capital de un pago sobre la obligación: una vez el capital llega a 0, la
   * fórmula en vivo siempre da 0, así que sin congelar antes, la mora ya devengada pero no
   * cobrada se perdería para siempre (hallazgo RECAUDO-01 de la auditoría). Devuelve la mora
   * pendiente de cobro resultante (congelada - ya pagada).
   */
  async congelarMora(id: string, historial: HistorialTasaMora[], manager: EntityManager): Promise<number> {
    const repo = manager.getRepository(Obligacion);
    const obligacion = await repo
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.id = :id', { id })
      .getOneOrFail();

    const pendiente = this.moraPendiente(obligacion, historial);
    const congelada = Math.max(Number(obligacion.valorMoraAcumulada), this.calcularMoraViva(obligacion, historial));
    if (congelada !== Number(obligacion.valorMoraAcumulada)) {
      obligacion.valorMoraAcumulada = congelada;
      await repo.save(obligacion);
    }
    return pendiente;
  }

  /** Aplica un abono a la mora pendiente (usado por RecaudoService dentro de una transacción, tercer destino tras Canon→Novedad). */
  async aplicarAbonoMora(id: string, monto: number, manager: EntityManager): Promise<Obligacion> {
    const repo = manager.getRepository(Obligacion);
    const obligacion = await repo
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.id = :id', { id })
      .getOneOrFail();
    obligacion.valorMoraPagada = Number(obligacion.valorMoraPagada) + monto;
    return repo.save(obligacion);
  }

  /** Revierte exactamente un abono de mora previamente aplicado (usado al anular un recibo). Nunca queda en negativo. */
  async revertirAbonoMora(id: string, monto: number, manager: EntityManager): Promise<Obligacion> {
    const repo = manager.getRepository(Obligacion);
    const obligacion = await repo
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.id = :id', { id })
      .getOneOrFail();
    obligacion.valorMoraPagada = Math.max(0, Number(obligacion.valorMoraPagada) - monto);
    return repo.save(obligacion);
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

  /** Aplica un abono a la obligación (usado por RecaudoService dentro de una transacción). */
  async aplicarAbono(id: string, monto: number, manager: EntityManager): Promise<Obligacion> {
    const repo = manager.getRepository(Obligacion);
    const obligacion = await repo
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.id = :id', { id })
      .getOneOrFail();

    obligacion.valorAbonado = Number(obligacion.valorAbonado) + monto;
    obligacion.estado =
      Number(obligacion.valorAbonado) >= Number(obligacion.valorOriginal)
        ? EstadoObligacion.PAGADA
        : EstadoObligacion.PARCIAL;

    return repo.save(obligacion);
  }

  /**
   * Revierte exactamente un abono previamente aplicado (usado al anular un recibo).
   * Nunca queda en negativo: resta el monto y recalcula el estado (PAGADA/PARCIAL/PENDIENTE).
   */
  async revertirAbono(id: string, monto: number, manager: EntityManager): Promise<Obligacion> {
    const repo = manager.getRepository(Obligacion);
    const obligacion = await repo
      .createQueryBuilder('o')
      .setLock('pessimistic_write')
      .where('o.id = :id', { id })
      .getOneOrFail();

    obligacion.valorAbonado = Math.max(0, Number(obligacion.valorAbonado) - monto);
    obligacion.estado =
      Number(obligacion.valorAbonado) <= 0
        ? EstadoObligacion.PENDIENTE
        : Number(obligacion.valorAbonado) >= Number(obligacion.valorOriginal)
          ? EstadoObligacion.PAGADA
          : EstadoObligacion.PARCIAL;

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

  private sumarMeses(fecha: Date, meses: number): Date {
    const copia = new Date(fecha);
    copia.setMonth(copia.getMonth() + meses);
    return copia;
  }

  private formatoPeriodo(fecha: Date): string {
    return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(fecha);
  }
}
