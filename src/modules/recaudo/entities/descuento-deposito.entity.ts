import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Contrato } from '../../contratos/entities/contrato.entity';

/**
 * - `GENERAL` (default): daños, aseo, servicios — concepto libre, solo baja el valor a devolver.
 * - `DEUDA`: arriendo/cargo debido — además ABONA la obligación real del contrato con el motor
 *   de recaudo (orden Canon→Novedad→Mora), para que no quede como cartera viva (hallazgo LB-6).
 */
export enum TipoDescuentoDeposito {
  GENERAL = 'GENERAL',
  DEUDA = 'DEUDA',
}

/**
 * Un descuento individual aplicado a la liquidación del depósito de garantía de un contrato
 * (§19: "Cada descuento debe conservar concepto/motivo y valor"). Antes de esto, la liquidación
 * solo recibía `valorDescuentos: number` — un total agregado sin explicar en qué se descontó
 * (hallazgo DEP-01 de la auditoría). Es un registro histórico inmutable: la liquidación de
 * depósito no se corrige editando ni borrando estos registros, sino marcándolos como anulados
 * (`anuladoEn`) cuando se revierte la liquidación completa (DEP-REV-01) — el mismo patrón
 * append-only de `Movimiento`/`ReciboCaja`/`ArqueoCaja`.
 */
@Entity('descuento_deposito')
export class DescuentoDeposito {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contrato, { nullable: false })
  @Index()
  contrato: Contrato;

  @Column({ length: 200 })
  concepto: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  valor: number;

  @Column({ type: 'enum', enum: TipoDescuentoDeposito, default: TipoDescuentoDeposito.GENERAL })
  tipo: TipoDescuentoDeposito;

  @Column({ length: 150 })
  registradoPorEmail: string;

  @CreateDateColumn()
  creadoEn: Date;

  /**
   * Fecha en que se anuló este descuento al revertir la liquidación de depósito que lo generó
   * (DEP-REV-01). `null` = vigente. No se borra físicamente: la reversión es un flujo de
   * corrección trazable, no un `DELETE`.
   */
  @Column({ type: 'datetime', nullable: true })
  anuladoEn: Date | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  motivoAnulacion: string | null;
}
