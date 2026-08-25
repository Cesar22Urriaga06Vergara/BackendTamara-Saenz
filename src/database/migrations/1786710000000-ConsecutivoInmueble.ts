import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Agrega la columna donde persistir el consecutivo legible del inmueble ("INM-000001"),
 * a solicitud de negocio para no exponer el UUID interno como referencia visible.
 * Nullable porque los inmuebles ya existentes no tienen numeración retroactiva.
 * No se siembra la fila del tipo 'INMUEBLE' en `consecutivo` aquí: ConsecutivoService.siguiente()
 * ya la crea de forma perezosa (lazy) la primera vez que se usa, igual que para cualquier
 * tipo nuevo no sembrado explícitamente.
 */
export class ConsecutivoInmueble1786710000000 implements MigrationInterface {
    name = 'ConsecutivoInmueble1786710000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`inmueble\` ADD \`consecutivo\` varchar(20) NULL`);
        await queryRunner.query(`ALTER TABLE \`inmueble\` ADD UNIQUE INDEX \`IDX_inmueble_consecutivo\` (\`consecutivo\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_inmueble_consecutivo\` ON \`inmueble\``);
        await queryRunner.query(`ALTER TABLE \`inmueble\` DROP COLUMN \`consecutivo\``);
    }

}
