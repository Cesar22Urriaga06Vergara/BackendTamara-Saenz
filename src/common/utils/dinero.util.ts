/**
 * Helpers de aritmética monetaria centralizados. El motor de recaudo/obligaciones opera en
 * `number` de JS (punto flotante) sobre columnas `decimal(12,2)` de MariaDB — sin un punto
 * único de redondeo, el drift de centavos se acumula a través de sumas/restas encadenadas
 * (`calcularPlanAplicacion`, consumo de saldo a favor, abonos parciales) y puede dejar una
 * obligación atascada en PARCIAL por fracciones de centavo, o generar aplicaciones de pago
 * con `montoAplicado ≈ 0`.
 */

/** Redondea a 2 decimales (la escala de toda columna `decimal(12,2)` del dominio financiero). */
export function redondearMoneda(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** `true` si `valor` es, en la práctica, cero (dentro de medio centavo) — guardia de punto flotante. */
export function esCeroMoneda(valor: number): boolean {
  return Math.abs(valor) < 0.005;
}
