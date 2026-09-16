/**
 * Roles del sistema.
 * ADMINISTRADOR: control financiero total (recaudo, reportes, aprobaciones).
 * RECEPCIONISTA: control operativo (novedades, consulta), SIN acceso a dinero/reportes contables.
 * CONTADOR: lectura financiera y reportes, sin mutaciones sobre caja, pagos ni usuarios.
 */
export enum Rol {
  ADMINISTRADOR = 'ADMINISTRADOR',
  RECEPCIONISTA = 'RECEPCIONISTA',
  CONTADOR = 'CONTADOR',
}
