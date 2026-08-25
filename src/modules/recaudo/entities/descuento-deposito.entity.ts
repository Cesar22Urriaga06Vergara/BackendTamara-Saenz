import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Contrato } from '../../contratos/entities/contrato.entity';

/**
 * Un descuento individual aplicado a la liquidación del depósito en custodia de un contrato
 * (§19: "Cada descuento debe conservar concepto/motivo y valor"). Antes de esto, la liquidación
 * solo recibía `valorDescuentos: number` — un total agregado sin explicar en qué se descontó
 * (hallazgo DEP-01 de la auditoría). Es un registro histórico inmutable: la liquidación de
 * depósito no se corrige editando estos registros, sino con el flujo financiero de corrección
 * correspondiente si algo se registró mal.
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

  @Column({ length: 150 })
  registradoPorEmail: string;

  @CreateDateColumn()
  creadoEn: Date;
}
