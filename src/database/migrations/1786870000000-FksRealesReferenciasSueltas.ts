import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hallazgo BD-02 de la auditoría: `movimiento.reciboId/novedadId/contratoId` y
 * `obligacion.novedadOrigenId` eran `varchar` sueltos sin constraint FK real — un patrón de
 * desacoplamiento deliberado entre módulos, pero que sacrificaba integridad referencial
 * estructural (nada impedía, a nivel de BD, que apuntaran a un id inexistente).
 *
 * Se agrega la garantía ESTRUCTURAL (constraint FK) SIN tocar las entidades de TypeORM ni
 * ningún código de aplicación — decisión deliberada de esta migración, no un descuido:
 * - Convertir estas columnas en relaciones `@ManyToOne` reales tocaría ~20 sitios en 5+
 *   archivos (servicios que las escriben, filtros `where` en queries y tests), con riesgo de
 *   romper silenciosamente una inserción si algún sitio quedara mal migrado.
 * - No hace falta: en producción `DB_SYNCHRONIZE=false` (confirmado en `app.module.ts` y
 *   `.env`), así que las migraciones son la ÚNICA fuente de verdad del esquema — un FK
 *   agregado solo aquí, sin declarar en la entidad, es seguro y no será revertido por
 *   `synchronize` (eso solo podría pasar contra la BD de test, efímera y sin datos reales).
 *
 * Verificado ANTES de escribir esta migración (no asumido): cero filas huérfanas en las 4
 * columnas contra la BD real, y todos los valores existentes miden exactamente 36 caracteres
 * (UUID), por lo que angostar de `varchar(255)` a `varchar(36)` — para que coincida con el
 * tipo real de las columnas `id` referenciadas — es seguro.
 */
export class FksRealesReferenciasSueltas1786870000000 implements MigrationInterface {
    name = 'FksRealesReferenciasSueltas1786870000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`movimiento\` MODIFY \`reciboId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`movimiento\` MODIFY \`novedadId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`movimiento\` MODIFY \`contratoId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`obligacion\` MODIFY \`novedadOrigenId\` varchar(36) NULL`);

        await queryRunner.query(`CREATE INDEX \`IDX_movimiento_reciboId\` ON \`movimiento\` (\`reciboId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_movimiento_novedadId\` ON \`movimiento\` (\`novedadId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_movimiento_contratoId\` ON \`movimiento\` (\`contratoId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_obligacion_novedadOrigenId\` ON \`obligacion\` (\`novedadOrigenId\`)`);

        await queryRunner.query(`
            ALTER TABLE \`movimiento\`
            ADD CONSTRAINT \`FK_movimiento_recibo\`
            FOREIGN KEY (\`reciboId\`) REFERENCES \`recibo_caja\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`movimiento\`
            ADD CONSTRAINT \`FK_movimiento_novedad\`
            FOREIGN KEY (\`novedadId\`) REFERENCES \`novedad\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`movimiento\`
            ADD CONSTRAINT \`FK_movimiento_contrato\`
            FOREIGN KEY (\`contratoId\`) REFERENCES \`contrato\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`obligacion\`
            ADD CONSTRAINT \`FK_obligacion_novedadOrigen\`
            FOREIGN KEY (\`novedadOrigenId\`) REFERENCES \`novedad\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`obligacion\` DROP FOREIGN KEY \`FK_obligacion_novedadOrigen\``);
        await queryRunner.query(`ALTER TABLE \`movimiento\` DROP FOREIGN KEY \`FK_movimiento_contrato\``);
        await queryRunner.query(`ALTER TABLE \`movimiento\` DROP FOREIGN KEY \`FK_movimiento_novedad\``);
        await queryRunner.query(`ALTER TABLE \`movimiento\` DROP FOREIGN KEY \`FK_movimiento_recibo\``);

        await queryRunner.query(`DROP INDEX \`IDX_obligacion_novedadOrigenId\` ON \`obligacion\``);
        await queryRunner.query(`DROP INDEX \`IDX_movimiento_contratoId\` ON \`movimiento\``);
        await queryRunner.query(`DROP INDEX \`IDX_movimiento_novedadId\` ON \`movimiento\``);
        await queryRunner.query(`DROP INDEX \`IDX_movimiento_reciboId\` ON \`movimiento\``);

        await queryRunner.query(`ALTER TABLE \`obligacion\` MODIFY \`novedadOrigenId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`movimiento\` MODIFY \`contratoId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`movimiento\` MODIFY \`novedadId\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`movimiento\` MODIFY \`reciboId\` varchar(255) NULL`);
    }

}
