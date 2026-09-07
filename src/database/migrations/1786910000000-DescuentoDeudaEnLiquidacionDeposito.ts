import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hallazgo LB-6: al liquidar el depósito, un descuento rotulado "arriendo debido" solo bajaba
 * el valor a devolver — la obligación real seguía como cartera viva (doble conteo). Ahora un
 * descuento tipo `DEUDA` abona la obligación con el motor de recaudo, vía un recibo interno
 * marcado `esLiquidacionDeposito` (sin movimiento de caja: el dinero ya estaba en custodia).
 */
export class DescuentoDeudaEnLiquidacionDeposito1786910000000 implements MigrationInterface {
  name = 'DescuentoDeudaEnLiquidacionDeposito1786910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`descuento_deposito\` ADD \`tipo\` enum ('GENERAL', 'DEUDA') NOT NULL DEFAULT 'GENERAL'`,
    );
    await queryRunner.query(`ALTER TABLE \`recibo_caja\` ADD \`esLiquidacionDeposito\` tinyint NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`recibo_caja\` DROP COLUMN \`esLiquidacionDeposito\``);
    await queryRunner.query(`ALTER TABLE \`descuento_deposito\` DROP COLUMN \`tipo\``);
  }
}
