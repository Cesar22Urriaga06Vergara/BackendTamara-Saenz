import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Trazabilidad de acciones sensibles del sistema (quién, qué, cuándo, sobre qué recurso).
 *
 * Decisión de negocio RDN-05 / hallazgo AUD-01 de la auditoría: esta tabla NO tiene columnas
 * genéricas `valorAnterior`/`valorNuevo`, y se decide deliberadamente no añadirlas. El
 * sistema nunca edita registros financieros en sitio — cada operación sensible (terminar,
 * reactivar, anular recibo/obligación, reversar movimiento) crea un registro nuevo con motivo
 * obligatorio y conserva el original intacto (ver `ContratoHistorialEstado`, `EstadoRecibo`,
 * `EstadoObligacion`, `Movimiento.esReverso`). El "valor anterior" siempre es reconstruible a
 * partir del registro original más su reverso/anulación — nunca se pierde. Serializar
 * genéricamente antes/después para entidades heterogéneas en esta tabla central tendría un
 * costo de mantenimiento alto (mapear cada entidad financiera a un formato común) para un
 * beneficio marginal sobre la trazabilidad que el patrón "nunca editar" ya garantiza.
 */
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
