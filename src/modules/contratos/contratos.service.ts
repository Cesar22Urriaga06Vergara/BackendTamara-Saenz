import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Contrato, EstadoContrato } from './entities/contrato.entity';
import { ContratoHistorialEstado } from './entities/contrato-historial-estado.entity';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { TerminarContratoDto } from './dto/terminar-contrato.dto';
import { ReactivarContratoDto } from './dto/reactivar-contrato.dto';
import { FilterContratoDto } from './dto/filter-contrato.dto';
import { Cliente } from '../personas/entities/cliente.entity';
import { Codeudor } from '../personas/entities/codeudor.entity';
import { Inmueble, EstadoInmueble } from '../inmuebles/entities/inmueble.entity';
import { ObligacionesService } from '../obligaciones/obligaciones.service';
import { paginar } from '../../common/utils/paginar.util';

@Injectable()
export class ContratosService {
  constructor(
    @InjectRepository(Contrato) private readonly repo: Repository<Contrato>,
    private readonly dataSource: DataSource,
    private readonly obligacionesService: ObligacionesService,
  ) {}

  /**
   * Crea el contrato dentro de una transacción:
   * - Valida existencia de Cliente, Codeudores e Inmueble (todos por búsqueda estricta, ya persistidos).
   * - Valida que el inmueble esté DISPONIBLE.
   * - fecha_fin queda explícitamente NULL.
   * - Marca el inmueble como OCUPADO.
   */
  async crear(dto: CreateContratoDto): Promise<Contrato> {
    return this.dataSource.transaction(async (manager) => {
      const cliente = await manager.findOne(Cliente, { where: { id: dto.clienteId, activo: true } });
      if (!cliente) throw new NotFoundException('Cliente no encontrado o inactivo.');

      const codeudores = dto.codeudorIds.length
        ? await manager.find(Codeudor, { where: { id: In(dto.codeudorIds), activo: true } })
        : [];
      if (codeudores.length !== dto.codeudorIds.length) {
        throw new NotFoundException('Uno o más codeudores no fueron encontrados o están inactivos.');
      }

      const inmueble = await manager
        .createQueryBuilder(Inmueble, 'i')
        .setLock('pessimistic_write')
        .where('i.id = :id', { id: dto.inmuebleId })
        .getOne();
      if (!inmueble) throw new NotFoundException('Inmueble no encontrado.');
      if (inmueble.estado !== EstadoInmueble.DISPONIBLE) {
        throw new BadRequestException('El inmueble seleccionado no está disponible para arrendamiento.');
      }

      const contratoActivoExistente = await manager.findOne(Contrato, {
        where: { inmueble: { id: dto.inmuebleId }, estado: EstadoContrato.ACTIVO },
      });
      if (contratoActivoExistente) {
        throw new BadRequestException('El inmueble ya tiene un contrato activo vigente.');
      }

      // CONT-04: si no se especifica día de pago, se deriva del día de `fechaInicio` (§6.1 —
      // "si no se especifica una fecha de pago distinta, la fecha de pago del canon será igual
      // a la fecha de inicio"). Se extrae el día directo del string "YYYY-MM-DD" en vez de
      // pasar por `new Date(...).getDate()`: ese constructor interpreta fechas sin hora como
      // medianoche UTC, y en una zona horaria negativa `.getDate()` (local) puede devolver el
      // día calendario ANTERIOR — el mismo mecanismo del hallazgo MORA-01.
      const diaPago = dto.diaPago ?? Number(dto.fechaInicio.slice(0, 10).split('-')[2]);

      const contrato = manager.create(Contrato, {
        cliente,
        codeudores,
        inmueble,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: null, // explícito: sin fecha de fin al crear
        diaPago,
        canonValor: inmueble.canonValor,
        depositoCustodia: dto.depositoCustodia ?? inmueble.depositoValor ?? 0,
        estado: EstadoContrato.ACTIVO,
      });

      // Se marca el inmueble como OCUPADO ANTES de guardar el contrato, para que
      // la relación anidada devuelta al cliente refleje el estado ya actualizado
      // (evita que la respuesta muestre el estado previo por referencia obsoleta).
      inmueble.estado = EstadoInmueble.OCUPADO;
      await manager.save(inmueble);

      const guardado = await manager.save(contrato);

      return guardado;
    });
  }

  private construirQueryListado(filtro: FilterContratoDto) {
    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.cliente', 'cliente')
      .leftJoinAndSelect('c.inmueble', 'inmueble')
      .leftJoinAndSelect('c.codeudores', 'codeudores');

    if (filtro.busqueda) {
      qb.andWhere('(cliente.numeroDocumento LIKE :b OR cliente.nombreCompleto LIKE :b)', {
        b: `%${filtro.busqueda}%`,
      });
    }
    if (filtro.barrio) qb.andWhere('inmueble.barrio = :barrio', { barrio: filtro.barrio });
    if (filtro.inmuebleId) qb.andWhere('inmueble.id = :inmuebleId', { inmuebleId: filtro.inmuebleId });
    if (filtro.fechaDesde) qb.andWhere('c.fechaInicio >= :desde', { desde: filtro.fechaDesde });
    if (filtro.fechaHasta) qb.andWhere('c.fechaInicio <= :hasta', { hasta: filtro.fechaHasta });
    if (filtro.estado) qb.andWhere('c.estado = :estado', { estado: filtro.estado });

    return qb.orderBy('c.creadoEn', 'DESC');
  }

  async listar(filtro: FilterContratoDto) {
    return paginar(this.construirQueryListado(filtro), filtro.page, filtro.limit);
  }

  /** Sin paginar — uso exclusivo de exports (reportes .xlsx), donde se necesita el universo completo. */
  listarTodosParaExport(filtro: FilterContratoDto): Promise<Contrato[]> {
    return this.construirQueryListado(filtro).getMany();
  }

  async obtener(id: string): Promise<Contrato> {
    const contrato = await this.repo.findOne({ where: { id }, relations: ['cliente', 'inmueble', 'codeudores'] });
    if (!contrato) throw new NotFoundException('Contrato no encontrado.');
    return contrato;
  }

  /**
   * Ficha de recaudo por inmueble/contrato: expone lo requerido por el motor financiero
   * (historial, barrio, arrendatario, codeudores, saldo a favor, depósito en custodia,
   * y las obligaciones pendientes/parciales con su mora recalculada al momento de la consulta,
   * para que el cajero vea exactamente qué debe cobrar antes de registrar un pago).
   */
  async fichaRecaudo(id: string) {
    const contrato = await this.obtener(id);
    const obligacionesPendientes = await this.obligacionesService.pendientesPorContrato(id);
    return {
      contrato,
      inmueble: contrato.inmueble,
      barrio: contrato.inmueble.barrio,
      arrendatario: contrato.cliente,
      codeudores: contrato.codeudores,
      saldoAFavor: contrato.saldoAFavor,
      depositoCustodia: contrato.depositoCustodia,
      obligacionesPendientes,
    };
  }

  /** Motor de estados: solo aquí se solicita explícitamente fecha_fin. */
  async terminar(id: string, dto: TerminarContratoDto, usuarioEmail: string): Promise<Contrato> {
    return this.dataSource.transaction(async (manager) => {
      const contrato = await manager.findOne(Contrato, { where: { id }, relations: ['inmueble'] });
      if (!contrato) throw new NotFoundException('Contrato no encontrado.');
      if (contrato.estado === EstadoContrato.TERMINADO) {
        throw new BadRequestException('El contrato ya se encuentra terminado.');
      }

      const estadoAnterior = contrato.estado;
      contrato.estado = EstadoContrato.TERMINADO;
      contrato.fechaFin = new Date(dto.fechaFin);
      contrato.motivoTerminacion = dto.motivoTerminacion;
      await manager.save(contrato);

      contrato.inmueble.estado = EstadoInmueble.DISPONIBLE;
      await manager.save(contrato.inmueble);

      // RDN-04 / CONT-05: anula el canon generado por adelantado para periodos posteriores
      // a esta terminación (ver detalle en ObligacionesService.anularCanonPosteriorATerminacion).
      await this.obligacionesService.anularCanonPosteriorATerminacion(contrato.id, contrato.fechaFin, manager);

      await manager.save(
        manager.create(ContratoHistorialEstado, {
          contrato,
          estadoAnterior,
          estadoNuevo: EstadoContrato.TERMINADO,
          motivo: dto.motivoTerminacion,
          usuarioEmail,
        }),
      );

      // NOTA: la liquidación de depósito (devolución/egreso, descuentos por deuda o
      // novedades aprobadas) se ejecuta desde el módulo `recaudo` al confirmarse la terminación.
      return contrato;
    });
  }

  /**
   * Única reactivación de negocio permitida (§6.6): TERMINADO → ACTIVO, exclusiva de
   * Administrador (verificado también en el controller vía `@Roles`), motivo obligatorio,
   * reocupa el inmueble (validando que no haya sido tomado por otro contrato ACTIVO mientras
   * tanto), y queda registrada en `ContratoHistorialEstado` sin sobrescribir ni borrar
   * `motivoTerminacion`/`fechaFin` — esa es la trazabilidad histórica de la terminación
   * original, que debe seguir siendo consultable después de reactivar.
   */
  async reactivar(id: string, dto: ReactivarContratoDto, usuarioEmail: string): Promise<Contrato> {
    return this.dataSource.transaction(async (manager) => {
      const contrato = await manager
        .createQueryBuilder(Contrato, 'c')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('c.inmueble', 'inmueble')
        .where('c.id = :id', { id })
        .getOne();
      if (!contrato) throw new NotFoundException('Contrato no encontrado.');
      if (contrato.estado !== EstadoContrato.TERMINADO) {
        throw new BadRequestException('Solo un contrato TERMINADO puede reactivarse.');
      }

      const inmueble = await manager
        .createQueryBuilder(Inmueble, 'i')
        .setLock('pessimistic_write')
        .where('i.id = :id', { id: contrato.inmueble.id })
        .getOneOrFail();
      if (inmueble.estado === EstadoInmueble.OCUPADO) {
        throw new BadRequestException('El inmueble ya está ocupado por otro contrato activo; no se puede reactivar.');
      }

      contrato.estado = EstadoContrato.ACTIVO;
      await manager.save(contrato);

      inmueble.estado = EstadoInmueble.OCUPADO;
      await manager.save(inmueble);

      await manager.save(
        manager.create(ContratoHistorialEstado, {
          contrato,
          estadoAnterior: EstadoContrato.TERMINADO,
          estadoNuevo: EstadoContrato.ACTIVO,
          motivo: dto.motivo,
          usuarioEmail,
        }),
      );

      return contrato;
    });
  }

  /** Historial completo de transiciones de estado del contrato — trazabilidad obligatoria (§6.6). */
  async historial(id: string): Promise<ContratoHistorialEstado[]> {
    return this.dataSource.getRepository(ContratoHistorialEstado).find({
      where: { contrato: { id } },
      order: { creadoEn: 'ASC' },
    });
  }
}
