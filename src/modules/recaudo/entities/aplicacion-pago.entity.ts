import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ReciboCaja } from './recibo-caja.entity';
import { Obligacion } from '../../obligaciones/entities/obligacion.entity';

/** A qué se destinó el monto aplicado: capital de la obligación, o mora acumulada (§10). */
export enum ConceptoAplicacion {
  CAPITAL = 'CAPITAL',
  MORA = 'MORA',
}

/**
 * Traza la aplicación de un recibo de caja sobre una obligación específica.
 * Permite que la anulación de un recibo revierta EXACTAMENTE los abonos que
 * generó (y no solo el movimiento de caja global), devolviendo cada obligación
 * a su estado/saldo previo al pago. `concepto` distingue si se abonó a capital
 * o a mora, para revertir cada uno con el método correcto (hallazgo RECAUDO-01).
 */
@Entity('aplicacion_pago')
export class AplicacionPago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** NOT NULL (BD-01): una aplicación nunca existe sin su recibo/obligación de origen. */
  @ManyToOne(() => ReciboCaja, { nullable: false, onDelete: 'CASCADE' })
  recibo: ReciboCaja;

  @ManyToOne(() => Obligacion, { nullable: false })
  obligacion: Obligacion;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  montoAplicado: number;

  @Column({ type: 'enum', enum: ConceptoAplicacion, default: ConceptoAplicacion.CAPITAL })
  concepto: ConceptoAplicacion;

  /**
   * Saldo de la obligación en ESTE concepto (capital o mora) inmediatamente después de
   * aplicar este monto — una foto histórica, no un valor recalculable después del hecho,
   * porque pagos posteriores sobre la misma obligación seguirían moviendo el saldo actual.
   * Nullable porque las aplicaciones creadas antes de este campo (RECAUDO-03) no lo tienen.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  saldoPosterior: number | null;

  @CreateDateColumn()
  creadoEn: Date;
}
