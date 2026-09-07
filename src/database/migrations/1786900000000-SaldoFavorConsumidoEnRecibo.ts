import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hallazgo A3-a: `registrarPago` consume saldo a favor PREEXISTENTE (créditos `SaldoFavorCredito`
 * en orden FIFO) para financiar parte del pago, pero no dejaba traza de CUÁNTO consumió cada
 * recibo — así que al anular, la deuda se restauraba completa pero el saldo a favor que la había
 * financiado se perdía. Se agrega `saldoFavorConsumido` al recibo: la anulación lo usa para
 * restituir esa porción como un crédito fresco.
 */
export class SaldoFavorConsumidoEnRecibo1786900000000 implements MigrationInterface {
  name = 'SaldoFavorConsumidoEnRecibo1786900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`recibo_caja\` ADD \`saldoFavorConsumido\` decimal(12,2) NOT NULL DEFAULT '0.00'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`recibo_caja\` DROP COLUMN \`saldoFavorConsumido\``);
  }
}
