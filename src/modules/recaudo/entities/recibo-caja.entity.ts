import { Column, CreateDateColumn, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { columnaNumerica } from '../../../common/utils/columna-numerica.transformer';
import { Contrato } from '../../contratos/entities/contrato.entity';
import { DetallePago } from './detalle-pago.entity';
import { AplicacionPago } from './aplicacion-pago.entity';

export enum EstadoRecibo {
  EMITIDO = 'EMITIDO',
  ANULADO = 'ANULADO',
}

/**
 * Recibo de Caja oficial — documento consecutivo, inmutable una vez emitido.
 * La anulación NUNCA borra el registro: cambia su estado y genera el movimiento
 * de reverso correspondiente (ver RecaudoService.anular).
 */
@Entity('recibo_caja')
export class ReciboCaja {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  consecutivo: string; // ej: REC-000123

  @ManyToOne(() => Contrato, { nullable: false })
  @Index()
  contrato: Contrato;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica })
  valorTotal: number;

  /**
   * Excedente sobre las obligaciones aplicadas. Por defecto se devuelve de inmediato como
   * cambio (`excedenteComoSaldoFavor = false`); solo cuando el cliente pide expresamente dejar
   * un abono adelantado queda como `SaldoFavorCredito` acumulable (RDN-01 de la auditoría).
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica, default: 0 })
  excedente: number;

  /** true = el excedente quedó como saldo a favor; false = se devolvió como cambio inmediato. */
  @Column({ default: false })
  excedenteComoSaldoFavor: boolean;

  /**
   * Saldo a favor PREEXISTENTE que este recibo consumió al aplicarse (FIFO sobre
   * `SaldoFavorCredito`). Se guarda para que la anulación pueda restituir exactamente esa
   * porción como un crédito fresco — antes la anulación revertía el capital completo pero no
   * devolvía el saldo a favor que había financiado parte del pago (hallazgo A3-a).
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica, default: 0 })
  saldoFavorConsumido: number;

  /**
   * `true` cuando el recibo lo generó una LIQUIDACIÓN DE DEPÓSITO (descuento tipo DEUDA
   * aplicado a las obligaciones del contrato), no un pago en efectivo/transferencia. No tiene
   * movimientos de caja asociados; su reverso va atado al reverso de la liquidación (hallazgo LB-6).
   */
  @Column({ default: false })
  esLiquidacionDeposito: boolean;

  @OneToMany(() => DetallePago, (detalle) => detalle.recibo, { cascade: true })
  detallesPago: DetallePago[];

  /** Desglose de a qué obligación/concepto se aplicó cada peso de este recibo (§20, RECAUDO-03). */
  @OneToMany(() => AplicacionPago, (aplicacion) => aplicacion.recibo)
  aplicaciones: AplicacionPago[];

  @Column({ type: 'enum', enum: EstadoRecibo, default: EstadoRecibo.EMITIDO })
  estado: EstadoRecibo;

  @Column({ type: 'text', nullable: true })
  motivoAnulacion: string | null;

  @Column({ length: 150 })
  registradoPorEmail: string;

  // P-4: el dashboard filtra el "recaudo del mes" por `creadoEn >= :inicioMes`.
  @Index('IDX_recibo_caja_creado_en')
  @CreateDateColumn()
  creadoEn: Date;
}
