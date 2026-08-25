import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hallazgos CONT-01/CONT-02 de la auditoría: el estado SUSPENDIDO de Contrato contradecía
 * explícitamente §6.2 de la especificación ("Solo existen dos estados contractuales: ACTIVO,
 * TERMINADO"), y la única reactivación de negocio exigida por §6.6 (TERMINADO → ACTIVO, con
 * motivo obligatorio, trazabilidad, exclusiva de Administrador) no existía — lo implementado
 * era SUSPENDIDO → ACTIVO, sin motivo, sin restricción de rol, y borrando el motivo previo.
 *
 * Esta migración:
 * 1) Migra cualquier contrato SUSPENDIDO existente a ACTIVO (defensivo: verificado que no hay
 *    ninguno en la base de datos de producción al momento de escribir esta migración — un
 *    contrato suspendido nunca liberaba el inmueble, por lo que ACTIVO es el estado más fiel
 *    a su condición operativa real).
 * 2) Restringe el enum de `contrato.estado` a solo ACTIVO/TERMINADO.
 * 3) Crea `contrato_historial_estado`, un ledger append-only de transiciones (terminar y
 *    reactivar), que sobrevive a cualquier número de ciclos sin perder el historial anterior
 *    — a diferencia de las columnas `motivoTerminacion`/`fechaFin`, que solo reflejan el
 *    último evento.
 * 4) Hace backfill de un registro histórico de "terminación" para cada contrato TERMINADO
 *    existente que ya tenga `motivoTerminacion`, para que el historial no arranque vacío.
 */
export class EliminarSuspendidoYHistorialContrato1786780000000 implements MigrationInterface {
  name = 'EliminarSuspendidoYHistorialContrato1786780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE \`contrato\` SET \`estado\` = 'ACTIVO' WHERE \`estado\` = 'SUSPENDIDO'`);
    await queryRunner.query(
      `ALTER TABLE \`contrato\` MODIFY \`estado\` enum ('ACTIVO', 'TERMINADO') NOT NULL DEFAULT 'ACTIVO'`,
    );

    await queryRunner.query(`
            CREATE TABLE \`contrato_historial_estado\` (
                \`id\` varchar(36) NOT NULL,
                \`estadoAnterior\` enum ('ACTIVO', 'TERMINADO') NOT NULL,
                \`estadoNuevo\` enum ('ACTIVO', 'TERMINADO') NOT NULL,
                \`motivo\` text NOT NULL,
                \`usuarioEmail\` varchar(150) NOT NULL,
                \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`contratoId\` varchar(36) NOT NULL,
                INDEX \`IDX_contrato_historial_estado_contratoId\` (\`contratoId\`),
                INDEX \`IDX_contrato_historial_estado_creadoEn\` (\`creadoEn\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
    await queryRunner.query(`
            ALTER TABLE \`contrato_historial_estado\`
            ADD CONSTRAINT \`FK_contrato_historial_estado_contrato\`
            FOREIGN KEY (\`contratoId\`) REFERENCES \`contrato\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);

    await queryRunner.query(`
            INSERT INTO \`contrato_historial_estado\` (\`id\`, \`contratoId\`, \`estadoAnterior\`, \`estadoNuevo\`, \`motivo\`, \`usuarioEmail\`, \`creadoEn\`)
            SELECT UUID(), \`id\`, 'ACTIVO', 'TERMINADO', \`motivoTerminacion\`, 'sistema@migracion', COALESCE(\`fechaFin\`, \`actualizadoEn\`)
            FROM \`contrato\`
            WHERE \`estado\` = 'TERMINADO' AND \`motivoTerminacion\` IS NOT NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`contrato_historial_estado\` DROP FOREIGN KEY \`FK_contrato_historial_estado_contrato\``,
    );
    await queryRunner.query(`DROP TABLE \`contrato_historial_estado\``);
    await queryRunner.query(
      `ALTER TABLE \`contrato\` MODIFY \`estado\` enum ('ACTIVO', 'SUSPENDIDO', 'TERMINADO') NOT NULL DEFAULT 'ACTIVO'`,
    );
  }
}
