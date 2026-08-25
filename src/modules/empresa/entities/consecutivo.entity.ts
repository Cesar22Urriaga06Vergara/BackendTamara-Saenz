import { Column, Entity, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';

/**
 * Consecutivos atómicos por tipo de documento (RECIBO_CAJA, EGRESO, etc).
 * El incremento se realiza SIEMPRE dentro de una transacción con bloqueo
 * pesimista (SELECT ... FOR UPDATE) para evitar números duplicados
 * bajo concurrencia (dos cajeros emitiendo recibos al mismo tiempo).
 */
@Entity('consecutivo')
export class Consecutivo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Ej: 'RECIBO_CAJA', 'EGRESO', 'NOVEDAD' */
  @Column({ length: 40, unique: true })
  tipo: string;

  @Column({ length: 10, default: '' })
  prefijo: string;

  @Column({ type: 'bigint', default: 0 })
  ultimoNumero: number;

  @VersionColumn()
  version: number;
}
