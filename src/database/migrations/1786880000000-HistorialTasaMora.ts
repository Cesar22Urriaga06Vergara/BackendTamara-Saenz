import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hallazgo MORA-02 de la auditoría: la tasa de mora (`Empresa.diasGraciaMora`/
 * `porcentajeMoraMensual`) vivía únicamente en la fila global mutable de `Empresa`, sin
 * historial — un cambio de tasa recalculaba retroactivamente toda la mora abierta, sin dejar
 * rastro de qué tasa aplicaba en qué fecha.
 *
 * Esta migración crea `historial_tasa_mora` y siembra una única fila con la tasa actual de
 * `empresa`, vigente desde una fecha muy anterior a cualquier obligación real del sistema —
 * representa "la tasa que ha regido siempre hasta hoy" tal como el sistema la conocía antes de
 * este cambio. A partir de aquí, cada vez que `EmpresaService.actualizarParametros` reciba un
 * cambio de `diasGraciaMora`/`porcentajeMoraMensual` insertará una nueva fila vigente desde el
 * día del cambio, sin tocar ni reescribir las anteriores.
 */
export class HistorialTasaMora1786880000000 implements MigrationInterface {
  name = 'HistorialTasaMora1786880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE \`historial_tasa_mora\` (
                \`id\` varchar(36) NOT NULL,
                \`diasGraciaMora\` int NOT NULL,
                \`porcentajeMoraMensual\` decimal(5,2) NOT NULL,
                \`vigenteDesde\` date NOT NULL,
                \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

    const empresas = await queryRunner.query(`SELECT diasGraciaMora, porcentajeMoraMensual FROM \`empresa\` LIMIT 1`);
    const diasGraciaMora = empresas[0]?.diasGraciaMora ?? 5;
    const porcentajeMoraMensual = empresas[0]?.porcentajeMoraMensual ?? 1.5;

    await queryRunner.query(
      `INSERT INTO \`historial_tasa_mora\` (\`id\`, \`diasGraciaMora\`, \`porcentajeMoraMensual\`, \`vigenteDesde\`) VALUES (UUID(), ?, ?, '2000-01-01')`,
      [diasGraciaMora, porcentajeMoraMensual],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`historial_tasa_mora\``);
  }
}
