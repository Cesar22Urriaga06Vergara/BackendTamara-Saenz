import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Contrato, EstadoContrato } from './contrato.entity';

/**
 * Ledger append-only de cada transición de estado de un Contrato (ACTIVO↔TERMINADO).
 * Existe para cumplir §6.6 de la especificación ("la fecha histórica de terminación no
 * debe desaparecer de la trazabilidad") a través de CUALQUIER número de ciclos
 * terminar→reactivar→terminar: guardar el motivo/fecha solo en columnas de `Contrato`
 * (motivoTerminacion/fechaFin) los sobrescribiría en el segundo ciclo, perdiendo el
 * primero — hallazgo CONT-02 de la auditoría. Nunca se edita ni se borra una fila.
 */
@Entity('contrato_historial_estado')
export class ContratoHistorialEstado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contrato, { nullable: false, onDelete: 'CASCADE' })
  @Index()
  contrato: Contrato;

  @Column({ type: 'enum', enum: EstadoContrato })
  estadoAnterior: EstadoContrato;

  @Column({ type: 'enum', enum: EstadoContrato })
  estadoNuevo: EstadoContrato;

  @Column({ type: 'text' })
  motivo: string;

  @Column({ length: 150 })
  usuarioEmail: string;

  @CreateDateColumn()
  @Index()
  creadoEn: Date;
}
