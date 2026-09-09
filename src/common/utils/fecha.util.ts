/**
 * Convierte un string "YYYY-MM-DD" (o un `Date` ya hidratado) en un `Date` que representa
 * el mismo día calendario en hora LOCAL del servidor.
 *
 * `new Date("YYYY-MM-DD")` lo interpreta como medianoche UTC (ECMA-262); en una zona horaria
 * negativa como Bogotá (UTC-5) eso cae en el día calendario ANTERIOR al leer sus componentes
 * locales, y TypeORM persiste columnas `type: 'date'` usando esos componentes locales
 * (`DateUtils.mixedDateToDateString`) — el string llega a guardarse un día antes del pedido.
 * Mismo mecanismo de fondo que los hallazgos MORA-01/CONT-04/AUD-021 de la auditoría (ver
 * `ObligacionesService.fechaLocalDesdeColumnaDate`). Parsear los componentes Y-M-D
 * directamente evita el parseo ISO-UTC del constructor `Date`.
 */
export function fechaLocalDesdeString(valor: Date | string): Date {
  if (typeof valor === 'string') {
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    return new Date(anio, mes - 1, dia);
  }
  return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
}

/**
 * Último instante (`23:59:59.999`, hora LOCAL del servidor) del día calendario que representa
 * un string `"YYYY-MM-DD"`. Se usa como límite superior inclusivo al filtrar columnas
 * `datetime` por un rango de fechas: comparar `columna <= "2026-09-03"` directamente contra un
 * `datetime` excluye todo lo registrado ese mismo día después de la medianoche (hallazgo
 * AUD-021, y su no-propagación a `/movimientos` y `/recaudo/recibos` — N1). Construye los
 * componentes Y-M-D directamente para no pasar por el parseo ISO-UTC de `new Date(string)`.
 */
export function finDelDiaLocal(valor: string): Date {
  const base = fechaLocalDesdeString(valor);
  base.setHours(23, 59, 59, 999);
  return base;
}

/**
 * `"YYYY-MM-DD"` del día calendario ACTUAL en la zona de NEGOCIO (America/Bogota por defecto),
 * sin importar el `TZ` del proceso (en Railway suele ser UTC). Toda regla de negocio que
 * dependa de "hoy" (vencimiento de cartera, mes de generación de canon, recaudo del mes) debe
 * derivar su "hoy" de aquí — nunca de `new Date()` directo — para que el veredicto de la app
 * (JS) y el de la BD (SQL) coincidan siempre. Colombia no tiene horario de verano, así que el
 * offset es constante (-05:00) y `Intl` basta sin dependencias.
 */
export function hoyNegocioISO(zona = 'America/Bogota'): string {
  // 'en-CA' formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());
}
