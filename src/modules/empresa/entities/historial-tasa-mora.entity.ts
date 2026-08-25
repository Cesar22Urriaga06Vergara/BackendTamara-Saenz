import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Hallazgo MORA-02 de la auditoría: `Empresa.diasGraciaMora`/`porcentajeMoraMensual` eran una
 * fila global mutable sin historial — cambiar la tasa hoy recalculaba retroactivamente toda la
 * mora de deuda abierta, sin dejar rastro de qué tasa aplicaba en qué fecha.
 *
 * Cada fila es la tasa vigente A PARTIR de `vigenteDesde` (inclusive) y hasta que exista una
 * fila posterior con `vigenteDesde` mayor. `ObligacionesService` recorre el historial completo
 * y prorratea la mora de cada obligación segmento por segmento, aplicando en cada tramo de días
 * la tasa que efectivamente estaba vigente ese día — un cambio de tasa hoy nunca reabre el
 * cálculo de días ya transcurridos bajo la tasa anterior.
 */
@Entity('historial_tasa_mora')
export class HistorialTasaMora {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  diasGraciaMora: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  porcentajeMoraMensual: number;

  /** Fecha (calendario, sin hora) desde la cual esta tasa rige. */
  @Column({ type: 'date' })
  vigenteDesde: Date | string;

  @CreateDateColumn()
  creadoEn: Date;
}
