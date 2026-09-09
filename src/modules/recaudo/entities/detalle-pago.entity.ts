import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { columnaNumerica } from '../../../common/utils/columna-numerica.transformer';
import { ReciboCaja } from './recibo-caja.entity';
import { MedioPago } from '../../../common/enums/medio-pago.enum';

export { MedioPago };

/** Un recibo puede contener varios medios de pago combinados (pago mixto). */
@Entity('detalle_pago')
export class DetallePago {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** NOT NULL (BD-01): un detalle de pago nunca existe sin su recibo. */
  @ManyToOne(() => ReciboCaja, (recibo) => recibo.detallesPago, { nullable: false, onDelete: 'CASCADE' })
  recibo: ReciboCaja;

  @Column({ type: 'enum', enum: MedioPago })
  medioPago: MedioPago;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica })
  monto: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia: string | null; // número de transferencia, si aplica
}
