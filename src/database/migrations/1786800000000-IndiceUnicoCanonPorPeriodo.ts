import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hallazgo CONC-01 de la auditoría: `generarCanonesMensuales` verificaba "¿ya existe canon
 * para este contrato/periodo?" y luego insertaba, sin transacción ni lock — dos ejecuciones
 * concurrentes (el cron nocturno solapado con un disparo manual del Administrador, o dos
 * corridas del cron) podían pasar ambas la verificación antes de que cualquiera insertara,
 * duplicando el canon del mismo mes para el mismo contrato.
 *
 * El lock pesimista agregado en `ObligacionesService.generarCanonesDeContrato` cierra la
 * ventana de carrera en el caso normal, pero esta migración agrega la garantía ESTRUCTURAL
 * final: un índice único sobre (contratoId, periodo) que aplica SOLO a obligaciones tipo
 * CANON. MySQL no soporta índices únicos parciales/filtrados de forma nativa (a diferencia de
 * Postgres), así que se usa el patrón estándar de columna generada: `claveUnicaCanon` vale
 * `contratoId + periodo` cuando `tipo = 'CANON'`, y NULL en cualquier otro caso — un índice
 * único permite múltiples NULL en MySQL, así que las obligaciones NOVEDAD (donde SÍ es válido
 * tener varias el mismo día para el mismo contrato) nunca chocan entre sí ni con esta regla.
 * Se usa CAST(periodo AS CHAR) en vez de DATE_FORMAT(): MySQL prohíbe DATE_FORMAT() dentro
 * de GENERATED ALWAYS AS por considerarlo no determinista (depende del locale de sesión).
 */
export class IndiceUnicoCanonPorPeriodo1786800000000 implements MigrationInterface {
    name = 'IndiceUnicoCanonPorPeriodo1786800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`obligacion\`
            ADD \`claveUnicaCanon\` varchar(80)
            GENERATED ALWAYS AS (
                CASE WHEN \`tipo\` = 'CANON' THEN CONCAT(\`contratoId\`, '_', CAST(\`periodo\` AS CHAR)) ELSE NULL END
            ) STORED
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`IDX_obligacion_canon_unico\` ON \`obligacion\` (\`claveUnicaCanon\`)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_obligacion_canon_unico\` ON \`obligacion\``);
        await queryRunner.query(`ALTER TABLE \`obligacion\` DROP COLUMN \`claveUnicaCanon\``);
    }

}
