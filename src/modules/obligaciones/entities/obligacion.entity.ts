import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { columnaNumerica } from '../../../common/utils/columna-numerica.transformer';
import { Contrato } from '../../contratos/entities/contrato.entity';

export enum TipoObligacion {
  CANON = 'CANON', // canon mensual de arrendamiento, generado automáticamente
  NOVEDAD = 'NOVEDAD', // cargo aprobado por el Administrador desde una novedad
}

export enum EstadoObligacion {
  PENDIENTE = 'PENDIENTE',
  PARCIAL = 'PARCIAL', // abonada parcialmente
  PAGADA = 'PAGADA',
  ANULADA = 'ANULADA',
}

/**
 * Obligación de pago vinculada a un contrato: canon mensual (generado automáticamente
 * dentro del horizonte configurado) o cargo tipo NOVEDAD (aprobado manualmente por el Admin).
 * Cobro neto por capital únicamente — sin costo de mora / interés por retraso (retirado por
 * decisión de negocio el 2026-09-01).
 */
@Entity('obligacion')
export class Obligacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contrato, { nullable: false })
  @Index()
  contrato: Contrato;

  @Column({ type: 'enum', enum: TipoObligacion })
  tipo: TipoObligacion;

  @Column({ length: 200 })
  concepto: string;

  /** Mes/año que representa la obligación (canon) o fecha de origen (novedad). */
  @Column({ type: 'date' })
  periodo: Date;

  @Column({ type: 'date' })
  fechaVencimiento: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica })
  valorOriginal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica, default: 0 })
  valorAbonado: number;

  /**
   * @deprecated Columna heredada del motor de mora, retirado por decisión de negocio el
   * 2026-09-01 (ya no hay costo de mora / interés por retraso en el sistema — los cobros son
   * netos, por canon de arrendamiento). Se conserva ÚNICAMENTE para que
   * `ObligacionesService.revertirAbonoMora` pueda revertir, con el método correcto, un recibo
   * histórico cuya `AplicacionPago` haya quedado con `concepto = MORA` de antes de este
   * retiro. Ningún código nuevo la lee ni la escribe hacia adelante; la columna física
   * `valorMoraAcumulada` de la migración original quedó huérfana (sin campo aquí) a propósito
   * — nada necesita leerla para revertir un abono de mora ya cobrado.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica, default: 0 })
  valorMoraPagada: number;

  @Column({ type: 'enum', enum: EstadoObligacion, default: EstadoObligacion.PENDIENTE })
  @Index()
  estado: EstadoObligacion;

  /**
   * `uuid` suelto (no `@ManyToOne`) deliberadamente, para no acoplar este módulo a
   * `novedades`. Tiene constraint FK real a nivel de base de datos desde la migración
   * `FksRealesReferenciasSueltas` (hallazgo BD-02 de la auditoría).
   */
  @Column({ type: 'uuid', nullable: true })
  novedadOrigenId: string | null;

  /** Motivo de la anulación — solo poblado cuando `estado === ANULADA` (corrección de un error de generación). */
  @Column({ type: 'text', nullable: true })
  motivoAnulacion: string | null;

  /**
   * Columna generada por MySQL (nunca se escribe desde código): `contratoId_periodo` cuando
   * `tipo = CANON`, NULL en cualquier otro caso. El índice único sobre esta columna es la
   * garantía estructural de CONC-01 — un índice único permite múltiples NULL en MySQL, así
   * que las obligaciones NOVEDAD (donde sí pueden coexistir varias el mismo día) nunca
   * chocan entre sí ni con esta regla, que solo protege contra canon duplicado del mismo
   * contrato/periodo.
   */
  @Column({
    type: 'varchar',
    length: 80,
    nullable: true,
    select: false,
    insert: false,
    update: false,
    // MySQL prohíbe DATE_FORMAT() dentro de GENERATED ALWAYS AS (lo considera no
    // determinista por depender del locale de la sesión); CAST(periodo AS CHAR) sobre una
    // columna DATE sí es determinista y siempre produce 'YYYY-MM-DD'.
    asExpression: `CASE WHEN \`tipo\` = 'CANON' THEN CONCAT(\`contratoId\`, '_', CAST(\`periodo\` AS CHAR)) ELSE NULL END`,
    generatedType: 'STORED',
  })
  @Index('IDX_obligacion_canon_unico', { unique: true })
  claveUnicaCanon: string | null;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
