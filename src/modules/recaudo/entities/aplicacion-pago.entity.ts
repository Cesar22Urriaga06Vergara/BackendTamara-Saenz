import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ReciboCaja } from './recibo-caja.entity';
import { Obligacion } from '../../obligaciones/entities/obligacion.entity';

/**
 * Concepto operativo actual: el sistema maneja pago neto por capital únicamente.
 * `MORA` solo se conserva como valor legacy para compatibilidad con filas históricas,
 * pero ya no se permite crear nuevas aplicaciones con ese concepto en el flujo activo.
 */
export enum ConceptoAplicacion {
  CAPITAL = 'CAPITAL',
}

/**
 * Traza la aplicación de un recibo de caja sobre una obligación específica.
 * Permite que la anulación de un recibo revierta EXACTAMENTE los abonos que
 * generó (y no solo el movimiento de caja global), devolviendo cada obligación
 * a su estado/saldo previo al pago. El flujo actual aplica solo a capital; si
 * existieran filas legacy con `concepto = 'MORA'`, se manejan solo en compatibilidad
 * de reversión histórica y no se permiten en nuevos registros.
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
