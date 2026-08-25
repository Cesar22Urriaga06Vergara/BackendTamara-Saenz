import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hallazgo CAJA-01 de la auditoría: `movimiento` no distinguía medio de pago, por lo
 * que un ingreso por transferencia se sumaba indistintamente junto con efectivo en el
 * mismo "saldo neto" presentado como caja. Se agrega `medioPago` (nullable: los
 * orígenes NOVEDAD/DEPOSITO aún no capturan el medio real, ver NOV-01/DEP-01) y
 * `referencia` (número de transacción bancaria, cuando aplica) para poder separar
 * estructuralmente caja física de control de transferencias.
 */
export class MedioPagoEnMovimiento1786750000000 implements MigrationInterface {
    name = 'MedioPagoEnMovimiento1786750000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`movimiento\` ADD \`medioPago\` enum ('EFECTIVO', 'TRANSFERENCIA') NULL`);
        await queryRunner.query(`ALTER TABLE \`movimiento\` ADD \`referencia\` varchar(100) NULL`);
        await queryRunner.query(`CREATE INDEX \`IDX_movimiento_medioPago\` ON \`movimiento\` (\`medioPago\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_movimiento_medioPago\` ON \`movimiento\``);
        await queryRunner.query(`ALTER TABLE \`movimiento\` DROP COLUMN \`referencia\``);
        await queryRunner.query(`ALTER TABLE \`movimiento\` DROP COLUMN \`medioPago\``);
    }

}
