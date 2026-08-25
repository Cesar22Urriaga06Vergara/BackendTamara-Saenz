import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hallazgo BD-03 de la auditoría: nada en la base de datos impedía estructuralmente dos
 * contratos ACTIVO sobre el mismo inmueble — la única protección era aplicativa
 * (`pessimistic_write` + verificación dentro de la transacción de `ContratosService.crear()`),
 * razonable como mitigación pero no una invariante estructural.
 *
 * Mismo patrón que CONC-01 (`obligacion.claveUnicaCanon`): MySQL no soporta índices únicos
 * parciales/filtrados de forma nativa, así que se usa una columna generada —
 * `claveUnicaInmuebleActivo` vale `inmuebleId` cuando `estado = 'ACTIVO'`, NULL en cualquier
 * otro caso— con un índice único sobre ella. Un índice único permite múltiples NULL en MySQL,
 * así que los contratos TERMINADO (donde sí puede haber varios históricos por el mismo
 * inmueble) nunca chocan entre sí ni con esta regla.
 */
export class IndiceUnicoContratoActivoPorInmueble1786860000000 implements MigrationInterface {
  name = 'IndiceUnicoContratoActivoPorInmueble1786860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE \`contrato\`
            ADD \`claveUnicaInmuebleActivo\` varchar(36)
            GENERATED ALWAYS AS (
                CASE WHEN \`estado\` = 'ACTIVO' THEN \`inmuebleId\` ELSE NULL END
            ) STORED
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX \`IDX_contrato_inmueble_activo_unico\` ON \`contrato\` (\`claveUnicaInmuebleActivo\`)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_contrato_inmueble_activo_unico\` ON \`contrato\``);
    await queryRunner.query(`ALTER TABLE \`contrato\` DROP COLUMN \`claveUnicaInmuebleActivo\``);
  }
}
