import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Refresh tokens persistidos y validados por hash (nunca se guarda el token plano).
 * Permite revocación individual (logout) y rotación en cada refresh.
 */
@Entity('refresh_token')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  usuarioId: string;

  /** SHA-256 del token plano (nunca se persiste el valor original). */
  @Column({ length: 128 })
  tokenHash: string;

  @Column()
  expiraEn: Date;

  @Column({ default: false })
  revocado: boolean;

  @CreateDateColumn()
  creadoEn: Date;
}
