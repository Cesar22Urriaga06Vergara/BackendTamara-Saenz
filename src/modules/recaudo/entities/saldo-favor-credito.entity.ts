import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ReciboCaja } from './recibo-caja.entity';
import { Contrato } from '../../contratos/entities/contrato.entity';

/**
 * Traza el origen de cada porción del saldo a favor de un contrato (AUD-006).
 * Antes, `Contrato.saldoAFavor` era un único número agregado sin historial: anular un
 * recibo antiguo restaba su excedente del saldo actual sin verificar si ya había sido
 * consumido por un pago posterior no relacionado, dejando el dato incorrecto.
 * Cada crédito queda ligado al recibo que lo generó y se consume en orden FIFO desde
 * `RecaudoService.registrarPago()`; al anular un recibo solo se revierte la porción de
 * SU PROPIO crédito que sigue disponible (`montoDisponible`), sin tocar créditos de
 * otros recibos. `recibo` es nullable únicamente para el crédito de migración que
 * respalda el saldo a favor ya existente antes de introducir esta trazabilidad (sin
 * recibo de origen conocido) — ese crédito nunca es alcanzable por una anulación.
 */
@Entity('saldo_favor_credito')
export class SaldoFavorCredito {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contrato, { onDelete: 'CASCADE' })
  @Index()
  contrato: Contrato;

  @ManyToOne(() => ReciboCaja, { nullable: true, onDelete: 'CASCADE' })
  recibo: ReciboCaja | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  montoOriginal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  montoDisponible: number;

  @CreateDateColumn()
  creadoEn: Date;
}
