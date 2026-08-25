import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guardia de idempotencia para `RecaudoService.liquidarDeposito`: antes, una segunda
 * liquidación sobre el mismo contrato terminado no duplicaba el pago (el depósito ya
 * quedaba en 0), pero sí insertaba filas `DescuentoDeposito` duplicadas con efecto cero si
 * se reenviaban descuentos. Se agrega `depositoLiquidadoEn` (NULL = aún no liquidado) para
 * que el servicio pueda rechazar explícitamente una segunda llamada.
 *
 * Backfill: un contrato TERMINADO con `depositoCustodia = 0` ya pasó por una liquidación
 * bajo el comportamiento anterior (es la única forma de que ese valor llegue a cero) — se
 * marca con la fecha de terminación como aproximación razonable de cuándo ocurrió.
 */
export class DepositoLiquidadoEnContrato1786890000000 implements MigrationInterface {
  name = 'DepositoLiquidadoEnContrato1786890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`contrato\` ADD \`depositoLiquidadoEn\` datetime NULL`);
    await queryRunner.query(
      `UPDATE \`contrato\` SET \`depositoLiquidadoEn\` = \`fechaFin\` WHERE \`estado\` = 'TERMINADO' AND \`depositoCustodia\` = 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`contrato\` DROP COLUMN \`depositoLiquidadoEn\``);
  }
}
