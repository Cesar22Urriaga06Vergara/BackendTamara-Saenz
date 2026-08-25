import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Arqueo de caja física (§15): fotografía, en el momento del conteo, del saldo esperado según
 * el libro de movimientos en EFECTIVO vs. lo realmente contado por el Administrador. NUNCA se
 * edita ni se borra un arqueo — cada conteo queda como su propio registro histórico inmutable,
 * igual que un `Movimiento` o un `ReciboCaja`.
 *
 * Los cuatro componentes de `saldoEsperado` se guardan por separado (no solo el resultado) para
 * que el arqueo sea auditable después: `saldoEsperado = saldoInicial + ingresosEfectivo -
 * egresosEfectivo - devolucionesEfectivo`, la fórmula exacta de la especificación.
 */
@Entity('arqueo_caja')
export class ArqueoCaja {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  saldoInicial: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  ingresosEfectivo: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  egresosEfectivo: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  devolucionesEfectivo: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  saldoEsperado: number;

  /** Conteo físico real, ingresado por el Administrador al momento del arqueo. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  saldoContado: number;

  /** `saldoContado - saldoEsperado`. Positivo = sobrante; negativo = faltante. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  diferencia: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ length: 150 })
  registradoPorEmail: string;

  @CreateDateColumn()
  creadoEn: Date;
}
