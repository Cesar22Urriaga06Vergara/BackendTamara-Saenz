import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hallazgo NOV-01 de la auditoría: aprobar un gasto de inmobiliaria generaba el movimiento
 * de EGRESO en el mismo paso que la aprobación (APROBADO = PAGADO), violando §17/§18. Se
 * agrega `gastoPagado` (y sus campos de trazabilidad del pago real) para separar ambos
 * eventos: aprobar deja el gasto pendiente de pago sin mover dinero; un nuevo endpoint de
 * pago real es el único que genera el movimiento de caja, con medio de pago explícito.
 */
export class PagoRealGastoNovedad1786760000000 implements MigrationInterface {
  name = 'PagoRealGastoNovedad1786760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`novedad\` ADD \`gastoPagado\` tinyint NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE \`novedad\` ADD \`medioPagoGasto\` enum ('EFECTIVO', 'TRANSFERENCIA') NULL`);
    await queryRunner.query(`ALTER TABLE \`novedad\` ADD \`referenciaPagoGasto\` varchar(100) NULL`);
    await queryRunner.query(`ALTER TABLE \`novedad\` ADD \`fechaPagoGasto\` datetime NULL`);
    await queryRunner.query(`ALTER TABLE \`novedad\` ADD \`pagadoPorEmail\` varchar(150) NULL`);
    // Backfill: los gastos de inmobiliaria ya aprobados bajo el comportamiento anterior
    // SÍ generaron su movimiento de EGRESO en el momento de aprobar (no hay dinero
    // pendiente de desembolsar) — se marcan como ya pagados para no duplicar el pago
    // ni dejarlos huérfanos en la nueva pantalla de "pendientes de pago".
    await queryRunner.query(
      `UPDATE \`novedad\` SET \`gastoPagado\` = 1, \`fechaPagoGasto\` = \`actualizadoEn\`, \`pagadoPorEmail\` = \`aprobadoPorEmail\` WHERE \`impactoFinanciero\` = 'GASTO_INMOBILIARIA'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`novedad\` DROP COLUMN \`pagadoPorEmail\``);
    await queryRunner.query(`ALTER TABLE \`novedad\` DROP COLUMN \`fechaPagoGasto\``);
    await queryRunner.query(`ALTER TABLE \`novedad\` DROP COLUMN \`referenciaPagoGasto\``);
    await queryRunner.query(`ALTER TABLE \`novedad\` DROP COLUMN \`medioPagoGasto\``);
    await queryRunner.query(`ALTER TABLE \`novedad\` DROP COLUMN \`gastoPagado\``);
  }
}
