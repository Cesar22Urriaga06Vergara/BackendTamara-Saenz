/**
 * Medio financiero de un movimiento de dinero.
 * Alcance de control interno confirmado: solo efectivo y transferencias (H10).
 * Compartido entre `recaudo` (DetallePago) y `movimientos` (Movimiento) para que
 * ambos módulos puedan filtrar/reportar por el mismo criterio sin acoplarse entre sí.
 */
export enum MedioPago {
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA',
}
