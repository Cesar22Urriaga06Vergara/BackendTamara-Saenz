import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Propietario de inmuebles (§4 de la especificación): 1 Propietario → N Inmuebles, 1 Inmueble
 * → 1 Propietario (no hay copropietarios). Fuera de alcance actual: comisión, liquidación al
 * propietario, cuentas por pagar al propietario — este módulo es solo el directorio.
 *
 * `esInmobiliaria` marca el propietario especial "INMOBILIARIA" (representa los inmuebles
 * propios de la inmobiliaria), creado por la migración `PropietarioYAsociacionInmueble`. Nunca
 * se expone en los DTO de creación/edición — solo ese registro semilla puede tenerlo en true,
 * para que siempre exista exactamente uno.
 */
@Entity('propietario')
export class Propietario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  nombre: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  numeroDocumento: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ default: false })
  esInmobiliaria: boolean;

  @CreateDateColumn()
  creadoEn: Date;

  @UpdateDateColumn()
  actualizadoEn: Date;
}
