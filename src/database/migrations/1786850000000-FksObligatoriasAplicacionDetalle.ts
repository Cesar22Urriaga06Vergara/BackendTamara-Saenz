import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hallazgo BD-01 de la auditoría: `aplicacion_pago.reciboId`/`obligacionId` y
 * `detalle_pago.reciboId` eran NULLABLE pese a que, lógicamente, ninguno de los dos debería
 * existir nunca sin su padre — ninguna ruta del código los crea sin ambos. Se vuelven NOT NULL
 * como garantía estructural (si existieran filas huérfanas de datos previos, esta migración
 * falla explícitamente en vez de borrarlas silenciosamente — corregir esos datos a mano sería
 * el paso previo requerido, nunca asumido aquí).
 */
export class FksObligatoriasAplicacionDetalle1786850000000 implements MigrationInterface {
    name = 'FksObligatoriasAplicacionDetalle1786850000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` MODIFY \`reciboId\` varchar(36) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` MODIFY \`obligacionId\` varchar(36) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`detalle_pago\` MODIFY \`reciboId\` varchar(36) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`detalle_pago\` MODIFY \`reciboId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` MODIFY \`obligacionId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` MODIFY \`reciboId\` varchar(36) NULL`);
    }

}
