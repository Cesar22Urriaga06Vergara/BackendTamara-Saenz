import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Dos cambios de esquema derivados de la auditoría de control interno (H7):
 * 1) `obligacion.motivoAnulacion`: traza el motivo cuando el Administrador anula
 *    manualmente una obligación PENDIENTE generada por error (corrección sin simular
 *    un pago falso). Nullable: solo se puebla si `estado = ANULADA`.
 * 2) `contrato.estado` retira 'EN_TERMINACION' del enum: nunca fue asignado por ningún
 *    flujo de negocio (verificado por auditoría) y se ofrecía como filtro en el frontend
 *    que siempre devolvía cero resultados. Seguro de retirar porque ninguna fila lo usa.
 */
export class AnulacionObligacionYRetiroEnTerminacion1786730000000 implements MigrationInterface {
    name = 'AnulacionObligacionYRetiroEnTerminacion1786730000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`obligacion\` ADD \`motivoAnulacion\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`contrato\` MODIFY \`estado\` enum ('ACTIVO', 'SUSPENDIDO', 'TERMINADO') NOT NULL DEFAULT 'ACTIVO'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`contrato\` MODIFY \`estado\` enum ('ACTIVO', 'SUSPENDIDO', 'EN_TERMINACION', 'TERMINADO') NOT NULL DEFAULT 'ACTIVO'`);
        await queryRunner.query(`ALTER TABLE \`obligacion\` DROP COLUMN \`motivoAnulacion\``);
    }

}
