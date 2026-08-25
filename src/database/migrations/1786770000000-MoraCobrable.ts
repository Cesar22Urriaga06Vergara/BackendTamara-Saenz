import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Hallazgo RECAUDO-01 de la auditoría: la mora se calculaba y se mostraba en cartera, pero
 * el motor de recaudo nunca la aplicaba como pago — el dinero solo cancelaba capital de
 * Canon/Novedad en orden puramente cronológico, sin respetar Canon → Novedad → Mora (§10).
 *
 * `obligacion.valorMoraPagada` registra la mora efectivamente cobrada; `valorMoraAcumulada`
 * (ya existía, pero nunca se persistía) pasa a ser un ledger "congelado" que nunca disminuye,
 * para no perder mora ya devengada cuando el capital se salda por completo.
 *
 * `aplicacion_pago.concepto` distingue si cada línea de aplicación fue a CAPITAL o a MORA,
 * necesario para revertir cada una correctamente al anular un recibo. Todas las aplicaciones
 * históricas fueron siempre a capital (la mora nunca se cobró antes de esta migración), por
 * lo que el default 'CAPITAL' es también correcto semánticamente para los datos existentes.
 */
export class MoraCobrable1786770000000 implements MigrationInterface {
    name = 'MoraCobrable1786770000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`obligacion\` ADD \`valorMoraPagada\` decimal(12,2) NOT NULL DEFAULT '0.00'`);
        await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` ADD \`concepto\` enum ('CAPITAL', 'MORA') NOT NULL DEFAULT 'CAPITAL'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`aplicacion_pago\` DROP COLUMN \`concepto\``);
        await queryRunner.query(`ALTER TABLE \`obligacion\` DROP COLUMN \`valorMoraPagada\``);
    }

}
