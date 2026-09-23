import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Cliente } from '../../personas/entities/cliente.entity';
import { Contrato } from '../../contratos/entities/contrato.entity';
import { Inmueble } from '../../inmuebles/entities/inmueble.entity';
import { columnaNumerica } from '../../../common/utils/columna-numerica.transformer';

export enum EstadoEntrevistaArrendamiento {
  BORRADOR = 'BORRADOR',
  REALIZADA = 'REALIZADA',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
}

export enum TipoDocumentoEntrevista {
  CC = 'CC',
  CE = 'CE',
  PASAPORTE = 'PASAPORTE',
  NIT = 'NIT',
}

export enum EstadoCivilEntrevista {
  SOLTERO = 'SOLTERO',
  CASADO = 'CASADO',
  UNION_LIBRE = 'UNION_LIBRE',
  SEPARADO = 'SEPARADO',
  VIUDO = 'VIUDO',
}

/** Snapshot de la entrevista de un posible arrendatario, independiente del contrato. */
@Entity('entrevista_arrendamiento')
export class EntrevistaArrendamiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  consecutivo: string;

  @Column({ type: 'enum', enum: EstadoEntrevistaArrendamiento, default: EstadoEntrevistaArrendamiento.BORRADOR })
  @Index()
  estado: EstadoEntrevistaArrendamiento;

  @Column({ type: 'varchar', length: 150 })
  nombreCompleto: string;

  @Column({ type: 'varchar', length: 30 })
  @Index()
  numeroDocumento: string;

  @Column({ type: 'enum', enum: TipoDocumentoEntrevista, default: TipoDocumentoEntrevista.CC })
  tipoDocumento: TipoDocumentoEntrevista;

  @Column({ type: 'date', nullable: true })
  fechaNacimiento: Date | null;

  @Column({ type: 'enum', enum: EstadoCivilEntrevista, nullable: true })
  estadoCivil: EstadoCivilEntrevista | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  correoElectronico: string | null;

  @Column({ type: 'text', nullable: true })
  personasInmueble: string | null;

  @Column({ type: 'int', nullable: true })
  numeroPersonas: number | null;

  @Column({ type: 'text', nullable: true })
  detallePersonas: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  empresaActividad: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  cargo: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  tipoContratoLaboral: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  tiempoLaborando: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica, nullable: true })
  ingresosMensuales: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica, nullable: true })
  otrosIngresos: number | null;

  @Column({ default: false })
  presentaSoportes: boolean;

  @Column({ type: 'varchar', length: 300, nullable: true })
  direccionActual: string | null;

  @Column({ type: 'text', nullable: true })
  motivoMudanza: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  arrendadorAnterior: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefonoArrendadorAnterior: string | null;

  @Column({ type: 'text', nullable: true })
  problemasPago: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  tiempoDireccionActual: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  referenciaLaboral: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefonoReferenciaLaboral: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  empresaReferenciaLaboral: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  referenciaPersonal: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefonoReferenciaPersonal: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  relacionReferenciaPersonal: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  referenciaFamiliar: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefonoReferenciaFamiliar: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  parentescoReferenciaFamiliar: string | null;

  @Column({ type: 'text', nullable: true })
  mascotas: string | null;

  @Column({ type: 'boolean', nullable: true })
  tieneMascotas: boolean | null;

  @Column({ type: 'text', nullable: true })
  detalleMascotas: string | null;

  @Column({ type: 'boolean', nullable: true })
  fuma: boolean | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  permanenciaEstimada: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  fiadorCodeudor: string | null;

  @Column({ type: 'boolean', nullable: true })
  tieneFiador: boolean | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  fiadorNombreCompleto: string | null;

  @Column({ type: 'enum', enum: TipoDocumentoEntrevista, nullable: true })
  fiadorTipoDocumento: TipoDocumentoEntrevista | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  fiadorNumeroDocumento: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  fiadorTelefono: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  fiadorDireccion: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fiadorRelacion: string | null;

  @Column({ default: false })
  aceptaEstudioCredito: boolean;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  firmaSolicitante: string | null;

  @Column({ type: 'date', nullable: true })
  fechaFirma: Date | null;

  @Column({ type: 'varchar', length: 150 })
  creadoPorEmail: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  decididoPorEmail: string | null;

  @Column({ type: 'text', nullable: true })
  motivoDecision: string | null;

  @Column({ type: 'datetime', nullable: true })
  decididoEn: Date | null;

  @ManyToOne(() => Cliente, { nullable: true })
  cliente: Cliente | null;

  @ManyToOne(() => Inmueble, { nullable: true })
  @Index()
  inmueble: Inmueble | null;

  @ManyToOne(() => Contrato, { nullable: true })
  contrato: Contrato | null;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
