import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { columnaNumerica } from '../../../common/utils/columna-numerica.transformer';
import { Cliente } from '../../personas/entities/cliente.entity';
import { Codeudor } from '../../personas/entities/codeudor.entity';
import { Inmueble } from '../../inmuebles/entities/inmueble.entity';

/**
 * Solo dos estados de negocio (§6.2 de la especificación): NO reintroducir SUSPENDIDO,
 * INACTIVO ni EN_TERMINACION — fue un hallazgo de la auditoría (CONT-01) que existían un
 * tercer estado SUSPENDIDO operable en producción, retirado deliberadamente.
 */
export enum EstadoContrato {
  ACTIVO = 'ACTIVO',
  TERMINADO = 'TERMINADO',
}

/**
 * Contrato de arrendamiento.
 * IMPORTANTE: fecha_fin es NULLABLE por diseño — un contrato activo no tiene fecha
 * de fin definida. Solo se solicita explícitamente al terminar o suspender el contrato.
 */
@Entity('contrato')
export class Contrato {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cliente, { nullable: false })
  cliente: Cliente;

  @ManyToOne(() => Inmueble, { nullable: false })
  @Index()
  inmueble: Inmueble;

  /** Relación N:M — un contrato puede tener uno o varios codeudores. */
  @ManyToMany(() => Codeudor)
  @JoinTable({
    name: 'contrato_codeudores',
    joinColumn: { name: 'contratoId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'codeudorId', referencedColumnName: 'id' },
  })
  codeudores: Codeudor[];

  @Column({ type: 'date' })
  fechaInicio: Date;

  /** NULL mientras el contrato esté activo. Se define solo al terminar. */
  @Column({ type: 'date', nullable: true })
  fechaFin: Date | null;

  @Column({ type: 'int', default: 5 })
  diaPago: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica })
  canonValor: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica, default: 0 })
  saldoAFavor: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica, default: 0 })
  depositoGarantia: number;

  /**
   * Marca cuándo se liquidó el depósito de garantía de este contrato (NULL mientras no se
   * haya liquidado). `RecaudoService.liquidarDeposito` la usa como guardia de idempotencia:
   * antes, una segunda llamada sobre el mismo contrato ya terminado no duplicaba el pago
   * (`depositoGarantia` queda en 0 tras la primera liquidación, así que `valorDevolucion`
   * calcula 0 en la segunda), pero sí insertaba filas `DescuentoDeposito` duplicadas con
   * efecto cero si se reenviaban descuentos, contaminando ese rastro de auditoría.
   */
  @Column({ type: 'datetime', nullable: true })
  depositoLiquidadoEn: Date | null;

  @Column({ type: 'enum', enum: EstadoContrato, default: EstadoContrato.ACTIVO })
  @Index()
  estado: EstadoContrato;

  @Column({ type: 'text', nullable: true })
  motivoTerminacion: string | null;

  /**
   * Columna generada por MySQL/MariaDB (nunca se escribe desde código): vale `inmuebleId`
   * cuando `estado = 'ACTIVO'`, NULL en cualquier otro caso. El índice único sobre esta
   * columna es la garantía ESTRUCTURAL final de BD-03 contra dos contratos ACTIVO sobre el
   * mismo inmueble — mismo patrón que `Obligacion.claveUnicaCanon` (CONC-01). El lock
   * pesimista + verificación dentro de la transacción de `ContratosService.crear()` cierra la
   * ventana de carrera en el caso normal; esta columna es la garantía que sobrevive incluso si
   * algún código futuro se salta ese lock. Un índice único permite múltiples NULL en MySQL, así
   * que los contratos TERMINADO (donde sí puede haber varios históricos por el mismo inmueble)
   * nunca chocan entre sí ni con esta regla.
   */
  @Column({
    type: 'varchar',
    length: 36,
    nullable: true,
    select: false,
    insert: false,
    update: false,
    asExpression: `CASE WHEN \`estado\` = 'ACTIVO' THEN \`inmuebleId\` ELSE NULL END`,
    generatedType: 'STORED',
  })
  @Index('IDX_contrato_inmueble_activo_unico', { unique: true })
  claveUnicaInmuebleActivo: string | null;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
