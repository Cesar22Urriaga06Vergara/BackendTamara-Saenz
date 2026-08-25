import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AUD-016: conecta los tipos de consecutivo EGRESO y NOVEDAD (ya sembrados desde el inicio
 * pero nunca consumidos) agregando la columna donde persistir el número formateado.
 * Nullable porque los movimientos INGRESO no usan consecutivo propio (llevan el del recibo
 * de caja asociado) y porque las filas ya existentes no tienen un número retroactivo.
 */
export class ConsecutivoEgresoNovedad1786700000000 implements MigrationInterface {
  name = 'ConsecutivoEgresoNovedad1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`movimiento\` ADD \`consecutivo\` varchar(20) NULL`);
    await queryRunner.query(
      `ALTER TABLE \`movimiento\` ADD UNIQUE INDEX \`IDX_movimiento_consecutivo\` (\`consecutivo\`)`,
    );
    await queryRunner.query(`ALTER TABLE \`novedad\` ADD \`consecutivo\` varchar(20) NULL`);
    await queryRunner.query(`ALTER TABLE \`novedad\` ADD UNIQUE INDEX \`IDX_novedad_consecutivo\` (\`consecutivo\`)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_novedad_consecutivo\` ON \`novedad\``);
    await queryRunner.query(`ALTER TABLE \`novedad\` DROP COLUMN \`consecutivo\``);
    await queryRunner.query(`DROP INDEX \`IDX_movimiento_consecutivo\` ON \`movimiento\``);
    await queryRunner.query(`ALTER TABLE \`movimiento\` DROP COLUMN \`consecutivo\``);
  }
}
