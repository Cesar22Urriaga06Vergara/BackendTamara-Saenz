import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migra el nombre operativo del depósito contractual sin destruir datos.
 * La columna legacy permanece en la BD para rollback y reconciliación; la aplicación solo
 * usa `depositoGarantia` a partir de esta migración.
 */
export class DepositoGarantia1786920000000 implements MigrationInterface {
  name = 'DepositoGarantia1786920000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `contrato` ADD `depositoGarantia` decimal(12,2) NOT NULL DEFAULT 0.00');
    await queryRunner.query(
      'UPDATE `contrato` SET `depositoGarantia` = `depositoCustodia` WHERE `depositoCustodia` IS NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `contrato` DROP COLUMN `depositoGarantia`');
  }
}
