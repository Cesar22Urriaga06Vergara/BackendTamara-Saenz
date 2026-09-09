import { ValueTransformer } from 'typeorm';

/**
 * El driver `mysql2` devuelve las columnas `DECIMAL` como **string** (`"500000.00"`). TypeORM no
 * las convierte por su cuenta, así que sin esto:
 *  - cada respuesta JSON del API manda los montos como string (hallazgo D-1);
 *  - cada lectura de un monto en los services hay que envolverla en `Number(...)` (y olvidar uno
 *    = concatenación de strings o `NaN`).
 *
 * Este transformer hidrata la columna como `number` y la persiste tal cual. Un `null` (columna
 * nullable sin valor) se conserva como `null`.
 *
 * Toda `@Column` nueva que represente pesos DEBE llevar `transformer: columnaNumerica`.
 */
export const columnaNumerica: ValueTransformer = {
  to: (valor: number | null | undefined): number | null | undefined => valor,
  from: (valor: string | number | null | undefined): number | null =>
    valor === null || valor === undefined ? null : Number(valor),
};
