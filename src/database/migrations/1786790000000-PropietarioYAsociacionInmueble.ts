import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hallazgo PROP-01 de la auditoría: la entidad Propietario exigida por §4 de la especificación
 * ("Todo inmueble debe quedar asociado a una entidad Propietario") no existía en absoluto.
 *
 * Esta migración:
 * 1) Crea la tabla `propietario`.
 * 2) Inserta el propietario especial "INMOBILIARIA" (representa los inmuebles propios de la
 *    inmobiliaria), marcado con `esInmobiliaria=1` — es el default cuando un inmueble no
 *    especifica propietario explícito.
 * 3) Agrega `inmueble.propietarioId`, hace backfill de TODOS los inmuebles existentes hacia
 *    "INMOBILIARIA" (no hay forma de inferir un propietario real distinto para datos ya
 *    existentes sin esa información — es una decisión de datos, no de negocio: se documenta
 *    aquí para que quede auditable y pueda corregirse manualmente inmueble por inmueble desde
 *    `PATCH /inmuebles/:id` si en la realidad pertenecen a otro propietario), y la vuelve
 *    NOT NULL + FK.
 */
export class PropietarioYAsociacionInmueble1786790000000 implements MigrationInterface {
  name = 'PropietarioYAsociacionInmueble1786790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE \`propietario\` (
                \`id\` varchar(36) NOT NULL,
                \`nombre\` varchar(200) NOT NULL,
                \`numeroDocumento\` varchar(30) NULL,
                \`telefono\` varchar(30) NULL,
                \`email\` varchar(150) NULL,
                \`esInmobiliaria\` tinyint NOT NULL DEFAULT 0,
                \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`actualizadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

    await queryRunner.query(
      `INSERT INTO \`propietario\` (\`id\`, \`nombre\`, \`esInmobiliaria\`) VALUES (UUID(), 'INMOBILIARIA', 1)`,
    );

    await queryRunner.query(`ALTER TABLE \`inmueble\` ADD \`propietarioId\` varchar(36) NULL`);
    await queryRunner.query(`
            UPDATE \`inmueble\`
            SET \`propietarioId\` = (SELECT \`id\` FROM \`propietario\` WHERE \`esInmobiliaria\` = 1 LIMIT 1)
            WHERE \`propietarioId\` IS NULL
        `);
    await queryRunner.query(`ALTER TABLE \`inmueble\` MODIFY \`propietarioId\` varchar(36) NOT NULL`);
    await queryRunner.query(`CREATE INDEX \`IDX_inmueble_propietarioId\` ON \`inmueble\` (\`propietarioId\`)`);
    await queryRunner.query(`
            ALTER TABLE \`inmueble\`
            ADD CONSTRAINT \`FK_inmueble_propietario\`
            FOREIGN KEY (\`propietarioId\`) REFERENCES \`propietario\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`inmueble\` DROP FOREIGN KEY \`FK_inmueble_propietario\``);
    await queryRunner.query(`DROP INDEX \`IDX_inmueble_propietarioId\` ON \`inmueble\``);
    await queryRunner.query(`ALTER TABLE \`inmueble\` DROP COLUMN \`propietarioId\``);
    await queryRunner.query(`DROP TABLE \`propietario\``);
  }
}
