import { MigrationInterface, QueryRunner } from 'typeorm';

export class EntrevistasArrendamiento1786960000000 implements MigrationInterface {
  name = 'EntrevistasArrendamiento1786960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`entrevista_arrendamiento\` (
        \`id\` varchar(36) NOT NULL,
        \`consecutivo\` varchar(20) NOT NULL,
        \`estado\` enum ('BORRADOR','REALIZADA','APROBADA','RECHAZADA') NOT NULL DEFAULT 'BORRADOR',
        \`nombreCompleto\` varchar(150) NOT NULL,
        \`numeroDocumento\` varchar(30) NOT NULL,
        \`fechaNacimiento\` date NULL,
        \`estadoCivil\` varchar(60) NULL,
        \`telefono\` varchar(30) NULL,
        \`correoElectronico\` varchar(150) NULL,
        \`personasInmueble\` text NULL,
        \`empresaActividad\` varchar(150) NULL,
        \`cargo\` varchar(120) NULL,
        \`tipoContratoLaboral\` varchar(80) NULL,
        \`tiempoLaborando\` varchar(80) NULL,
        \`ingresosMensuales\` decimal(12,2) NULL,
        \`otrosIngresos\` decimal(12,2) NULL,
        \`presentaSoportes\` tinyint NOT NULL DEFAULT 0,
        \`direccionActual\` varchar(300) NULL,
        \`motivoMudanza\` text NULL,
        \`arrendadorAnterior\` varchar(150) NULL,
        \`telefonoArrendadorAnterior\` varchar(30) NULL,
        \`problemasPago\` text NULL,
        \`referenciaLaboral\` varchar(150) NULL,
        \`telefonoReferenciaLaboral\` varchar(30) NULL,
        \`referenciaPersonal\` varchar(150) NULL,
        \`telefonoReferenciaPersonal\` varchar(30) NULL,
        \`referenciaFamiliar\` varchar(150) NULL,
        \`telefonoReferenciaFamiliar\` varchar(30) NULL,
        \`mascotas\` text NULL,
        \`fuma\` tinyint NULL,
        \`permanenciaEstimada\` varchar(80) NULL,
        \`fiadorCodeudor\` varchar(150) NULL,
        \`aceptaEstudioCredito\` tinyint NOT NULL DEFAULT 0,
        \`observaciones\` text NULL,
        \`firmaSolicitante\` varchar(150) NULL,
        \`fechaFirma\` date NULL,
        \`creadoPorEmail\` varchar(150) NOT NULL,
        \`decididoPorEmail\` varchar(150) NULL,
        \`motivoDecision\` text NULL,
        \`clienteId\` varchar(36) NULL,
        \`inmuebleId\` varchar(36) NULL,
        \`contratoId\` varchar(36) NULL,
        \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`actualizadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_entrevista_arrendamiento_estado\` (\`estado\`),
        INDEX \`IDX_entrevista_arrendamiento_documento\` (\`numeroDocumento\`),
        INDEX \`IDX_entrevista_arrendamiento_inmueble\` (\`inmuebleId\`),
        UNIQUE INDEX \`IDX_entrevista_arrendamiento_consecutivo\` (\`consecutivo\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_entrevista_cliente\` FOREIGN KEY (\`clienteId\`) REFERENCES \`cliente\`(\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`FK_entrevista_inmueble\` FOREIGN KEY (\`inmuebleId\`) REFERENCES \`inmueble\`(\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`FK_entrevista_contrato\` FOREIGN KEY (\`contratoId\`) REFERENCES \`contrato\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `entrevista_arrendamiento`');
  }
}
