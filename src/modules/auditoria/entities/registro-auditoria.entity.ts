import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Trazabilidad de acciones sensibles del sistema (quién, qué, cuándo, sobre qué recurso). */
@Entity('registro_auditoria')
export class RegistroAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 60 })
  modulo: string;

  @Index()
  @Column({ length: 80 })
  accion: string;

  @Column({ length: 150 })
  usuarioEmail: string;

  @Column({ length: 10 })
  metodoHttp: string;

  @Column({ length: 300 })
  ruta: string;

  @Column({ type: 'int' })
  duracionMs: number;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipOrigen: string | null;

  @CreateDateColumn()
  @Index()
  creadoEn: Date;
}
