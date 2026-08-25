import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AUD-006: introduce trazabilidad del saldo a favor por recibo de origen.
 *
 * Antes, `Contrato.saldoAFavor` era un único número agregado sin historial: anular un
 * recibo antiguo restaba su excedente del saldo actual sin verificar si ya había sido
 * consumido por un pago posterior no relacionado, dejando el dato incorrecto. Esta
 * migración crea `saldo_favor_credito` (análoga a `aplicacion_pago`, pero para el
 * excedente en vez de las obligaciones) y respalda con un crédito el saldo a favor que
 * ya existiera en producción antes de este cambio, sin recibo de origen conocido
 * (`reciboId` NULL) — ese crédito de migración nunca es alcanzable por una anulación,
 * exactamente igual que si su recibo de origen ya no existiera.
 */
export class SaldoFavorCredito1786720000000 implements MigrationInterface {
  name = 'SaldoFavorCredito1786720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`saldo_favor_credito\` (
        \`id\` varchar(36) NOT NULL,
        \`montoOriginal\` decimal(12,2) NOT NULL,
        \`montoDisponible\` decimal(12,2) NOT NULL,
        \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`contratoId\` varchar(36) NOT NULL,
        \`reciboId\` varchar(36) NULL,
        INDEX \`IDX_saldo_favor_credito_contrato\` (\`contratoId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      ALTER TABLE \`saldo_favor_credito\`
      ADD CONSTRAINT \`FK_saldo_favor_credito_contrato\`
      FOREIGN KEY (\`contratoId\`) REFERENCES \`contrato\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE \`saldo_favor_credito\`
      ADD CONSTRAINT \`FK_saldo_favor_credito_recibo\`
      FOREIGN KEY (\`reciboId\`) REFERENCES \`recibo_caja\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Backfill: respalda el saldo a favor ya existente con un crédito sin recibo de origen
    // conocido, para que no se pierda como "disponible" en el próximo pago de ese contrato.
    await queryRunner.query(`
      INSERT INTO \`saldo_favor_credito\` (\`id\`, \`montoOriginal\`, \`montoDisponible\`, \`creadoEn\`, \`contratoId\`, \`reciboId\`)
      SELECT UUID(), \`saldoAFavor\`, \`saldoAFavor\`, NOW(6), \`id\`, NULL
      FROM \`contrato\`
      WHERE \`saldoAFavor\` > 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`saldo_favor_credito\` DROP FOREIGN KEY \`FK_saldo_favor_credito_recibo\``);
    await queryRunner.query(`ALTER TABLE \`saldo_favor_credito\` DROP FOREIGN KEY \`FK_saldo_favor_credito_contrato\``);
    await queryRunner.query(`DROP TABLE \`saldo_favor_credito\``);
  }
}
