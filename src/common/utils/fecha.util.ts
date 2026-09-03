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
