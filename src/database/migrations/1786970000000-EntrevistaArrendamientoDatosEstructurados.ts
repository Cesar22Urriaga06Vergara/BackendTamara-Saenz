import { MigrationInterface, QueryRunner } from 'typeorm';

/** Evolución aditiva de entrevistas: no elimina ni reescribe información histórica. */
export class EntrevistaArrendamientoDatosEstructurados1786970000000 implements MigrationInterface {
  name = 'EntrevistaArrendamientoDatosEstructurados1786970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `entrevista_arrendamiento` ADD `tipoDocumento` enum ('CC','CE','PASAPORTE','NIT') NOT NULL DEFAULT 'CC'",
    );
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `numeroPersonas` int NULL');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `detallePersonas` text NULL');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `tiempoDireccionActual` varchar(30) NULL');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `empresaReferenciaLaboral` varchar(150) NULL');
    await queryRunner.query(
      'ALTER TABLE `entrevista_arrendamiento` ADD `relacionReferenciaPersonal` varchar(100) NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `entrevista_arrendamiento` ADD `parentescoReferenciaFamiliar` varchar(100) NULL',
    );
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `tieneMascotas` tinyint NULL');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `detalleMascotas` text NULL');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `tieneFiador` tinyint NULL');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `fiadorNombreCompleto` varchar(150) NULL');
    await queryRunner.query(
      "ALTER TABLE `entrevista_arrendamiento` ADD `fiadorTipoDocumento` enum ('CC','CE','PASAPORTE','NIT') NULL",
    );
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `fiadorNumeroDocumento` varchar(30) NULL');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `fiadorTelefono` varchar(30) NULL');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `fiadorDireccion` varchar(300) NULL');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `fiadorRelacion` varchar(100) NULL');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` ADD `decididoEn` datetime NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `decididoEn`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `fiadorRelacion`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `fiadorDireccion`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `fiadorTelefono`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `fiadorNumeroDocumento`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `fiadorTipoDocumento`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `fiadorNombreCompleto`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `tieneFiador`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `detalleMascotas`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `tieneMascotas`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `parentescoReferenciaFamiliar`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `relacionReferenciaPersonal`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `empresaReferenciaLaboral`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `tiempoDireccionActual`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `detallePersonas`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `numeroPersonas`');
    await queryRunner.query('ALTER TABLE `entrevista_arrendamiento` DROP COLUMN `tipoDocumento`');
  }
}
