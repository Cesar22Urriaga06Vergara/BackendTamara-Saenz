import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retira 'CONSIGNACION' y 'OTRO' del enum de MedioPago (H10, auditoría de control
 * interno): el alcance confirmado del sistema es exclusivamente efectivo y
 * transferencias. Verificado antes de aplicar que ningún registro histórico de
 * `detalle_pago` usaba esos dos valores (solo EFECTIVO y TRANSFERENCIA en producción),
 * por lo que no requiere backfill de datos.
 */
export class RetirarConsignacionYOtroMedioPago1786740000000 implements MigrationInterface {
  name = 'RetirarConsignacionYOtroMedioPago1786740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`detalle_pago\` MODIFY \`medioPago\` enum ('EFECTIVO', 'TRANSFERENCIA') NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`detalle_pago\` MODIFY \`medioPago\` enum ('EFECTIVO', 'TRANSFERENCIA', 'CONSIGNACION', 'OTRO') NOT NULL`,
    );
  }
}
