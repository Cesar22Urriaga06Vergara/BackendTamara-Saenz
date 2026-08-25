import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hallazgo DEP-01 de la auditoría: `LiquidarDepositoDto.valorDescuentos` era un único número
 * agregado, sin explicar en qué se descontó (§19 exige que cada descuento conserve
 * concepto/motivo y valor). Se crea `descuento_deposito` para persistir cada descuento por
 * separado, ligado al contrato liquidado.
 */
export class DescuentoDeposito1786830000000 implements MigrationInterface {
  name = 'DescuentoDeposito1786830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE \`descuento_deposito\` (
                \`id\` varchar(36) NOT NULL,
                \`concepto\` varchar(200) NOT NULL,
                \`valor\` decimal(12,2) NOT NULL,
                \`registradoPorEmail\` varchar(150) NOT NULL,
                \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`contratoId\` varchar(36) NOT NULL,
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
    await queryRunner.query(
      `CREATE INDEX \`IDX_descuento_deposito_contratoId\` ON \`descuento_deposito\` (\`contratoId\`)`,
    );
    await queryRunner.query(`
            ALTER TABLE \`descuento_deposito\`
            ADD CONSTRAINT \`FK_descuento_deposito_contrato\`
            FOREIGN KEY (\`contratoId\`) REFERENCES \`contrato\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`descuento_deposito\` DROP FOREIGN KEY \`FK_descuento_deposito_contrato\``);
    await queryRunner.query(`DROP INDEX \`IDX_descuento_deposito_contratoId\` ON \`descuento_deposito\``);
    await queryRunner.query(`DROP TABLE \`descuento_deposito\``);
  }
}
