import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Contrato } from '../../contratos/entities/contrato.entity';
import { Inmueble } from '../../inmuebles/entities/inmueble.entity';
import { MedioPago } from '../../../common/enums/medio-pago.enum';

export enum EstadoNovedad {
  ABIERTA = 'ABIERTA',
  EN_SEGUIMIENTO = 'EN_SEGUIMIENTO',
  CERRADA = 'CERRADA',
  ANULADA = 'ANULADA',
}

export enum ResponsableSugerido {
  INMOBILIARIA = 'INMOBILIARIA',
  ARRENDATARIO = 'ARRENDATARIO',
}

/** Tipo de impacto financiero, definido SOLO por el Administrador al aprobar. */
export enum ImpactoFinanciero {
  PENDIENTE = 'PENDIENTE',
  CARGO_ARRENDATARIO = 'CARGO_ARRENDATARIO', // genera obligación tipo NOVEDAD
  GASTO_INMOBILIARIA = 'GASTO_INMOBILIARIA', // genera movimiento de EGRESO
}

/**
 * Novedad operativa: registrada por Recepción SIN impacto financiero inmediato
 * (desacoplamiento de lógica). Solo el Administrador, al aprobar, genera el
 * impacto financiero correspondiente (obligación cobrable o egreso de caja).
 */
@Entity('novedad')
export class Novedad {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Consecutivo atómico (ej: "NOV-000045"), asignado al crear la novedad. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  consecutivo: string | null;

  @ManyToOne(() => Inmueble, { nullable: false })
  @Index()
  inmueble: Inmueble;

  @ManyToOne(() => Contrato, { nullable: true })
  contrato: Contrato | null;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ type: 'enum', enum: ResponsableSugerido, default: ResponsableSugerido.INMOBILIARIA })
  responsableSugerido: ResponsableSugerido;

  @Column({ type: 'enum', enum: EstadoNovedad, default: EstadoNovedad.ABIERTA })
  @Index()
  estado: EstadoNovedad;

  @Column({ type: 'enum', enum: ImpactoFinanciero, default: ImpactoFinanciero.PENDIENTE })
  impactoFinanciero: ImpactoFinanciero;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  montoAprobado: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  registradoPorEmail: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  aprobadoPorEmail: string | null;

  /**
   * APROBADO ≠ PAGADO (§17/§18 de la especificación, hallazgo NOV-01 de la auditoría).
   * Solo aplica cuando `impactoFinanciero = GASTO_INMOBILIARIA`: la aprobación deja el gasto
   * pendiente de pago, sin mover dinero; el movimiento de EGRESO solo se genera cuando se
   * registra el pago real (`NovedadesService.pagarGastoInmobiliaria`), que es lo único que
   * pone `gastoPagado = true`.
   */
  @Column({ default: false })
  gastoPagado: boolean;

  @Column({ type: 'enum', enum: MedioPago, nullable: true })
  medioPagoGasto: MedioPago | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenciaPagoGasto: string | null;

  @Column({ type: 'datetime', nullable: true })
  fechaPagoGasto: Date | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  pagadoPorEmail: string | null;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
