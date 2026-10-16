import { MigrationInterface, QueryRunner } from 'typeorm';

/** Repara bases donde la migración original quedó registrada pero falta la fila de INMOBILIARIA. */
export class RestaurarPropietarioInmobiliaria1786980000000 implements MigrationInterface {
  name = 'RestaurarPropietarioInmobiliaria1786980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`propietario\` (\`id\`, \`nombre\`, \`esInmobiliaria\`)
      SELECT UUID(), 'INMOBILIARIA', 1
      WHERE NOT EXISTS (
        SELECT 1 FROM \`propietario\` WHERE \`esInmobiliaria\` = 1
      )
    `);
  }

  public async down(): Promise<void> {
    // No se elimina: la fila puede estar referenciada por inmuebles creados después de esta migración.
  }
}
