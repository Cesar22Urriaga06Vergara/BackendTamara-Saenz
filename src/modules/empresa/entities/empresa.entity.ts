import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Entidad Empresa: datos corporativos + parámetros globales de negocio.
 * Solo debe existir un registro activo (empresa única multi-tenant no aplica aquí).
 */
@Entity('empresa')
export class Empresa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  nombre: string;

  @Column({ length: 30, unique: true })
  nit: string;

  @Column({ length: 150, default: 'Resolvemos tu situacion' })
  slogan: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  direccion: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  logoUrl: string | null;

  // ---- Parámetros globales de negocio ----
  // NOTA: `diasGraciaMora`/`porcentajeMoraMensual` se retiraron de aquí el 2026-09-01 (decisión
  // de negocio: ya no hay costo de mora / interés por retraso). Las columnas físicas
  // correspondientes quedaron huérfanas en la BD (con su DEFAULT), sin campo mapeado aquí.
  @Column({ type: 'int', default: 3 })
  horizonteMesesCanon: number;

  /**
   * Saldo físico en efectivo con el que arrancó a operar la caja, ANTES de que existiera el
   * primer `Movimiento` en el sistema (§15). Es la base de la reconciliación histórica
   * completa: `CajaService` calcula el saldo esperado como este valor + todos los ingresos
   * en efectivo - todos los egresos en efectivo desde entonces, nunca como un reinicio por
   * período (la especificación no define cortes periódicos de caja, solo un único punto de
   * partida — no se inventa un mecanismo de "cierre" no solicitado).
   */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  saldoInicialCaja: number;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
