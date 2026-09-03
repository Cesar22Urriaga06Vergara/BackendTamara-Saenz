import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hallazgo DEP-REV-01: al revertir una liquidación de depósito, `MovimientosService`
 * borraba físicamente (`descuentoRepo.remove`) las filas `descuento_deposito` de esa
 * liquidación — la única violación del patrón append-only que el resto de los registros
 * financieros (`Movimiento`, `ReciboCaja`, `ArqueoCaja`) respeta, y que la propia entidad
 * declara ("registro histórico inmutable"). Se agregan `anuladoEn` / `motivoAnulacion`:
 * la reversión ahora marca los descuentos como anulados en vez de borrarlos, y los
 * lectores (`depositosLiquidados`, reconstrucción del depósito en la reversión) filtran
 * `anuladoEn IS NULL`.
 */
export class AnulacionDescuentoDeposito1786930000000 implements MigrationInterface {
  name = 'AnulacionDescuentoDeposito1786930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`descuento_deposito\` ADD \`anuladoEn\` datetime NULL`);
    await queryRunner.query(`ALTER TABLE \`descuento_deposito\` ADD \`motivoAnulacion\` varchar(300) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`descuento_deposito\` DROP COLUMN \`motivoAnulacion\``);
    await queryRunner.query(`ALTER TABLE \`descuento_deposito\` DROP COLUMN \`anuladoEn\``);
  }
}
