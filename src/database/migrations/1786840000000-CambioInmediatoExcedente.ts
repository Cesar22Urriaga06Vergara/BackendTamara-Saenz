import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * RDN-01 resuelta: por defecto, el excedente de un pago se devuelve de inmediato como cambio
 * (sea efectivo o transferencia); solo cuando el cliente pide expresamente dejar un abono
 * adelantado queda como `SaldoFavorCredito` acumulable (hallazgo RECAUDO-02 de la auditoría).
 * `excedenteComoSaldoFavor` registra cuál de las dos rutas tomó cada recibo, para que el PDF y
 * la API muestren la etiqueta correcta ("Cambio entregado" vs. "Excedente aplicado a saldo a
 * favor"). Todos los recibos ya emitidos (previos a esta migración) dejaban el excedente como
 * saldo a favor — el default `0` (false) los describiría incorrectamente como "cambio
 * entregado" si se dejara en `false`, así que se hace backfill explícito a `true` para ellos.
 */
export class CambioInmediatoExcedente1786840000000 implements MigrationInterface {
    name = 'CambioInmediatoExcedente1786840000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`recibo_caja\` ADD \`excedenteComoSaldoFavor\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`UPDATE \`recibo_caja\` SET \`excedenteComoSaldoFavor\` = 1 WHERE \`excedente\` > 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`recibo_caja\` DROP COLUMN \`excedenteComoSaldoFavor\``);
    }

}
