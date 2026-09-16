import { MigrationInterface, QueryRunner } from 'typeorm';

/** Alinea el esquema con el logo fijo, CONTADOR y servicios públicos. */
export class LogoFijoContadorYServiciosPublicos1786950000000 implements MigrationInterface {
  name = 'LogoFijoContadorYServiciosPublicos1786950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `usuario` MODIFY `rol` enum ('ADMINISTRADOR', 'RECEPCIONISTA', 'CONTADOR') NOT NULL DEFAULT 'RECEPCIONISTA'",
    );
    await queryRunner.query(`
      CREATE TABLE \`servicio_publico\` (
        \`id\` varchar(36) NOT NULL,
        \`inmuebleId\` varchar(36) NOT NULL,
        \`tipoServicio\` enum ('LUZ', 'AGUA', 'GAS') NOT NULL,
        \`periodo\` varchar(20) NOT NULL,
        \`numeroFactura\` varchar(80) NOT NULL,
        \`valor\` decimal(12,2) NOT NULL,
        \`fechaEmision\` date NOT NULL,
        \`fechaVencimiento\` date NOT NULL,
        \`responsablePago\` enum ('PENDIENTE', 'PROPIETARIO', 'ARRENDATARIO') NOT NULL DEFAULT 'PENDIENTE',
        \`estadoPago\` enum ('PENDIENTE', 'PAGADO', 'VENCIDO', 'ANULADO') NOT NULL DEFAULT 'PENDIENTE',
        \`observaciones\` text NULL,
        \`registradoPorEmail\` varchar(150) NOT NULL,
        \`aprobadoPorEmail\` varchar(150) NULL,
        \`aprobadoEn\` datetime NULL,
        \`creadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`actualizadoEn\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_servicio_publico_inmueble\` (\`inmuebleId\`),
        INDEX \`IDX_servicio_publico_tipo\` (\`tipoServicio\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_servicio_publico_inmueble\`
          FOREIGN KEY (\`inmuebleId\`) REFERENCES \`inmueble\`(\`id\`)
          ON DELETE NO ACTION ON UPDATE NO ACTION
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `servicio_publico`');
    await queryRunner.query("UPDATE `usuario` SET `rol` = 'RECEPCIONISTA' WHERE `rol` = 'CONTADOR'");
    await queryRunner.query(
      "ALTER TABLE `usuario` MODIFY `rol` enum ('ADMINISTRADOR', 'RECEPCIONISTA') NOT NULL DEFAULT 'RECEPCIONISTA'",
    );
  }
}
