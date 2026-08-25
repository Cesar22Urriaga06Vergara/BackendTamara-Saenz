import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Directorio de Codeudores, independiente de Clientes. Soporta relación N:M con Contrato. */
@Entity('codeudor')
export class Codeudor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 30 })
  numeroDocumento: string;

  @Column({ length: 20, default: 'CC' })
  tipoDocumento: string;

  @Column({ length: 150 })
  nombreCompleto: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  direccion: string | null;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
