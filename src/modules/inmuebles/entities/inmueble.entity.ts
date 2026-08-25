import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Propietario } from '../../propietarios/entities/propietario.entity';

export enum EstadoInmueble {
  DISPONIBLE = 'DISPONIBLE',
  OCUPADO = 'OCUPADO',
  MANTENIMIENTO = 'MANTENIMIENTO',
  INACTIVO = 'INACTIVO',
  // NOTA: por restricción absoluta del negocio, NO existe estado 'EN_VENTA'.
}

@Entity('inmueble')
export class Inmueble {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Número de referencia legible ("INM-000001"), generado atómicamente al crear.
   *  Nullable: los inmuebles ya existentes antes de esta columna no tienen numeración retroactiva. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  consecutivo: string | null;

  /** §4 de la especificación: todo inmueble debe estar asociado a un propietario (1 Propietario → N Inmuebles). */
  @ManyToOne(() => Propietario, { nullable: false })
  @Index()
  propietario: Propietario;

  @Column({ length: 300 })
  direccion: string;

  @Index()
  @Column({ length: 120 })
  barrio: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  canonValor: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  depositoValor: number | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  codigoEnergia: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  codigoAgua: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  codigoGas: string | null;

  @Column({ type: 'enum', enum: EstadoInmueble, default: EstadoInmueble.DISPONIBLE })
  @Index()
  estado: EstadoInmueble;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
