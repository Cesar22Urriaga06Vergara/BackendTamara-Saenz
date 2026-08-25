import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hallazgo CAJA-02 de la auditoría: no existía ningún mecanismo de arqueo de caja (saldo
 * inicial, conteo físico, diferencia esperado-vs-contado — §15). Se agrega `saldoInicialCaja`
 * a `empresa` (el mismo patrón de parámetro global único que `diasGraciaMora`/
 * `porcentajeMoraMensual`) y la tabla `arqueo_caja`, que registra cada conteo físico como un
 * documento histórico inmutable, con los 4 componentes del saldo esperado guardados por
 * separado para que el arqueo sea auditable después.
 */
export class ModuloCaja1786820000000 implements MigrationInterface {
    name = 'ModuloCaja1786820000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`empresa\` ADD \`saldoInicialCaja\` decimal(12,2) NOT NULL DEFAULT '0.00'`);

        await queryRunner.query(`
            CREATE TABLE \`arqueo_caja\` (
                \`id\` varchar(36) NOT NULL,
                \`saldoInicial\` decimal(12,2) NOT NULL,
                \`ingresosEfectivo\` decimal(12,2) NOT NULL,
                \`egresosEfectivo\` decimal(12,2) NOT NULL,
                \`devolucionesEfectivo\` decimal(12,2) NOT NULL,
                \`saldoEsperado\` decimal(12,2) NOT NULL,
                \`saldoContado\` decimal(12,2) NOT NULL,
                \`diferencia\` decimal(12,2) NOT NULL,
                \`observaciones\` text NULL,
                \`registradoPorEmail\` varchar(150) NOT NULL,
                \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`arqueo_caja\``);
        await queryRunner.query(`ALTER TABLE \`empresa\` DROP COLUMN \`saldoInicialCaja\``);
    }

}
