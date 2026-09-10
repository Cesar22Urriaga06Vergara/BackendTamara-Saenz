import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hallazgo P-4: tres consultas calientes escaneaban de más por falta de índice adecuado.
 * Índices compuestos que cubren exactamente su patrón `WHERE` (el orden de las columnas importa):
 *
 * - `obligacion(estado, fechaVencimiento)` — cartera vencida (`condicionCarteraVencida`,
 *   dashboard, reporte Excel): `estado IN (...) AND fechaVencimiento <= :hoy`.
 * - `recibo_caja(creadoEn)` — "recaudo del mes" del dashboard: `creadoEn >= :inicioMes`.
 * - `movimiento(medioPago, tipo, esReverso)` — desglose de caja / saldo esperado en
 *   `MovimientosService`: `medioPago = :m AND tipo = :t [AND esReverso = :r]`.
 *
 * Los nombres coinciden con los `@Index(...)` de las entidades para que `synchronize` (que la
 * suite de tests usa) y estas migraciones no discrepen. No se tocan los índices de una sola
 * columna ya existentes (`estado`, `medioPago`, `tipo`, `creadoEn` de `movimiento`).
 */
export class IndicesCompuestosP4Migration1786940000000 implements MigrationInterface {
  name = 'IndicesCompuestosP4Migration1786940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX `IDX_obligacion_estado_venc` ON `obligacion` (`estado`, `fechaVencimiento`)');
    await queryRunner.query('CREATE INDEX `IDX_recibo_caja_creado_en` ON `recibo_caja` (`creadoEn`)');
    await queryRunner.query('CREATE INDEX `IDX_movimiento_caja` ON `movimiento` (`medioPago`, `tipo`, `esReverso`)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `IDX_movimiento_caja` ON `movimiento`');
    await queryRunner.query('DROP INDEX `IDX_recibo_caja_creado_en` ON `recibo_caja`');
    await queryRunner.query('DROP INDEX `IDX_obligacion_estado_venc` ON `obligacion`');
  }
}
