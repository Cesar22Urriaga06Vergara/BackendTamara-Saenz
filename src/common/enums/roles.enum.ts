/**
 * Roles del sistema.
 * ADMINISTRADOR: control financiero total (recaudo, reportes, aprobaciones).
 * RECEPCIONISTA: control operativo (novedades, consulta), SIN acceso a dinero/reportes contables.
 */
export enum Rol {
  ADMINISTRADOR = 'ADMINISTRADOR',
  RECEPCIONISTA = 'RECEPCIONISTA',
}
