import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Inmueble } from '../../inmuebles/entities/inmueble.entity';
import { columnaNumerica } from '../../../common/utils/columna-numerica.transformer';

export enum TipoServicioPublico {
  LUZ = 'LUZ',
  AGUA = 'AGUA',
  GAS = 'GAS',
}

export enum ResponsablePago {
  PENDIENTE = 'PENDIENTE',
  PROPIETARIO = 'PROPIETARIO',
  ARRENDATARIO = 'ARRENDATARIO',
}

export enum EstadoPagoServicio {
  PENDIENTE = 'PENDIENTE',
  PAGADO = 'PAGADO',
  VENCIDO = 'VENCIDO',
  ANULADO = 'ANULADO',
}

@Entity('servicio_publico')
export class ReciboPublico {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Inmueble, { nullable: false, eager: true })
  @Index()
  inmueble: Inmueble;

  @Column({ type: 'enum', enum: TipoServicioPublico })
  @Index()
  tipoServicio: TipoServicioPublico;

  @Column({ type: 'varchar', length: 20 })
  periodo: string;

  @Column({ type: 'varchar', length: 80 })
  numeroFactura: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica })
  valor: number;

  @Column({ type: 'date' })
  fechaEmision: Date;

  @Column({ type: 'date' })
  fechaVencimiento: Date;

  @Column({ type: 'enum', enum: ResponsablePago, default: ResponsablePago.PENDIENTE })
  responsablePago: ResponsablePago;

  @Column({ type: 'enum', enum: EstadoPagoServicio, default: EstadoPagoServicio.PENDIENTE })
  estadoPago: EstadoPagoServicio;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ type: 'varchar', length: 150 })
  registradoPorEmail: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  aprobadoPorEmail: string | null;

  @Column({ type: 'datetime', nullable: true })
  aprobadoEn: Date | null;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
