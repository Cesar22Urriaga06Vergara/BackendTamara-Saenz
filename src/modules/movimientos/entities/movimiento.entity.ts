import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { columnaNumerica } from '../../../common/utils/columna-numerica.transformer';
import { MedioPago } from '../../../common/enums/medio-pago.enum';

export enum TipoMovimiento {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
}

export enum OrigenMovimiento {
  RECAUDO = 'RECAUDO', // ingreso generado por un recibo de caja
  NOVEDAD = 'NOVEDAD', // egreso aprobado desde una novedad (gasto inmobiliaria)
  DEPOSITO = 'DEPOSITO', // egreso por devolución de depósito de garantía
  MANUAL = 'MANUAL', // egreso/ingreso manual registrado por el Administrador
}

/**
 * Movimiento de caja — INMUTABLE por diseño de negocio: sin DELETE manual.
 * Cualquier corrección se realiza mediante un movimiento de reverso (contrapartida),
 * nunca borrando ni editando el registro original. Esto preserva la trazabilidad
 * exigida por el módulo de Auditoría.
 */
@Entity('movimiento')
export class Movimiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TipoMovimiento })
  @Index()
  tipo: TipoMovimiento;

  @Column({ type: 'enum', enum: OrigenMovimiento })
  origen: OrigenMovimiento;

  /**
   * Consecutivo atómico (ej: "EGR-000045"), asignado solo a movimientos tipo EGRESO.
   * Nullable: MySQL permite múltiples NULL en un índice UNIQUE (los INGRESO no lo usan).
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  consecutivo: string | null;

  @Column({ length: 200 })
  concepto: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica })
  monto: number;

  /**
   * Medio financiero de este movimiento específico (EFECTIVO afecta caja física,
   * TRANSFERENCIA afecta únicamente el control bancario — nunca ambos a la vez).
   * Nullable temporalmente: los orígenes NOVEDAD y DEPOSITO todavía no capturan el
   * medio de pago real en sus propios flujos (ver hallazgos NOV-01/DEP-01 de la
   * auditoría); un movimiento con `medioPago = null` debe tratarse como un medio
   * pendiente de identificar, nunca asumirse como EFECTIVO ni excluirse en silencio
   * de los reportes de caja/banco.
   */
  @Column({ type: 'enum', enum: MedioPago, nullable: true })
  @Index()
  medioPago: MedioPago | null;

  /** Número de referencia/transacción bancaria, cuando `medioPago = TRANSFERENCIA`. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia: string | null;

  /**
   * IDs de referencia opcionales según el origen (reciboId, novedadId, contratoId) — se
   * mantienen como `uuid` sueltos en TypeORM (no `@ManyToOne`) deliberadamente, para no acoplar
   * este módulo a `recaudo`/`novedades`/`contratos`. Sí tienen constraint FK real a nivel de
   * base de datos desde la migración `FksRealesReferenciasSueltas` (hallazgo BD-02 de la
   * auditoría): la integridad referencial está garantizada estructuralmente aunque TypeORM no
   * la modele como relación.
   */
  @Column({ type: 'uuid', nullable: true })
  reciboId: string | null;

  @Column({ type: 'uuid', nullable: true })
  novedadId: string | null;

  @Column({ type: 'uuid', nullable: true })
  contratoId: string | null;

  @Column({ length: 150 })
  registradoPorEmail: string;

  /** true únicamente cuando este movimiento es el reverso de otro (nunca se elimina el original). */
  @Column({ default: false })
  esReverso: boolean;

  @Column({ type: 'uuid', nullable: true })
  movimientoOriginalId: string | null;

  @CreateDateColumn()
  @Index()
  creadoEn: Date;
}
