import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hallazgo RECAUDO-03 de la auditoría: el recibo (API + PDF) no podía mostrar concepto,
 * período, mora separada ni saldo posterior por obligación (§20), pese a que `aplicacion_pago`
 * ya registraba correctamente a qué obligación y concepto (capital/mora) se destinó cada
 * monto. Se agrega `saldoPosterior`: una foto del saldo de ESE concepto justo después de
 * aplicar este monto — necesaria porque el saldo actual de la obligación puede haberse
 * movido por pagos posteriores, así que no es recalculable después del hecho. Nullable
 * porque las aplicaciones ya existentes (previas a este campo) no tienen ese dato histórico.
 */
export class SaldoPosteriorEnAplicacionPago1786810000000 implements MigrationInterface {
  name = 'SaldoPosteriorEnAplicacionPago1786810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` ADD \`saldoPosterior\` decimal(12,2) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` DROP COLUMN \`saldoPosterior\``);
  }
}
