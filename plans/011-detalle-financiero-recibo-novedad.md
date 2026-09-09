# Plan 011: El Recibo de Novedad no declaraba el costo (impacto financiero)

> **ESTADO: DONE.** Ver commit al final. Ad-hoc, pedido por el dueño en el mismo hilo de trabajo
> de la ronda 2 ("hay que declarar el costo y esas cosas no solo la descripcion... asi como en el
> de caja").

## Status

- **Priority**: P2 · **Effort**: S · **Risk**: LOW

## Why this matters

`PdfNovedadService` (`src/modules/documentos/pdf-novedad.service.ts`) mostraba Fecha, Estado,
Inmueble, Responsable sugerido, Contrato relacionado, Registrado por, Descripción y Observaciones
— pero **nunca** el impacto financiero real. La entidad `Novedad` ya guarda todo eso como columnas
planas (`impactoFinanciero`, `montoAprobado`, `aprobadoPorEmail`, `gastoPagado`,
`medioPagoGasto`, `referenciaPagoGasto`, `fechaPagoGasto`, `pagadoPorEmail`) y ya venían cargadas
(`NovedadesService.obtener()` no necesita joins nuevos, son columnas propias de `Novedad`) — el
dato existía, solo no se imprimía. El dueño pidió el mismo nivel de detalle que ya tiene el Recibo
de Caja (que declara cada medio de pago y cada aplicación línea por línea, no solo un total).

## Fix

- Nueva sección "Impacto financiero" en `pdf-novedad.service.ts`, insertada entre la tarjeta de
  datos y el bloque de Descripción/Observaciones:
  - `Tipo:` siempre visible (`Pendiente de aprobación financiera` / `Cargo al arrendatario` /
    `Gasto de la inmobiliaria` — mismas 3 etiquetas que `useEstados.ts` en el frontend).
  - `Monto:` en una caja destacada (mismo patrón visual del "Total destacado" del Recibo de Caja,
    color `COLOR_ORO_CLARO`) — **solo si** `montoAprobado != null` (una novedad `PENDIENTE` no
    tiene costo aprobado todavía; no se inventa un monto ni se muestra "$0").
  - `Aprobado por:` si existe.
  - Si `impactoFinanciero === 'GASTO_INMOBILIARIA'`: `Estado de pago:` (Pagado/Pendiente de pago)
    y, solo si ya está pagado, `Medio de pago:` (con `(Ref: ...)` si hay referencia),
    `Fecha de pago:` y `Pagado por:`.
- Implementado como líneas sueltas (`lineaDato()`), no una tarjeta de grilla de alto precalculado
  como la de arriba — el número de líneas varía según la combinación
  `impactoFinanciero`/`gastoPagado`, y la tarjeta superior depende de un cálculo de alturas fijo
  por fila que no vale la pena generalizar para un caso variable.
- Actualizado el docstring de la clase (afirmaba "SIN impacto financiero", ya no es cierto).

## Hallazgo durante la verificación (importante para quien toque este archivo después)

El comentario original de la prueba de UUID (`pdf.service.spec.ts`) afirmaba: *"El texto del PDF
vectorial queda embebido sin comprimir por defecto en pdfkit"* — **falso**. Se confirmó en
`node_modules/pdfkit/js/pdfkit.js`: `this.compress = this.options.compress != null ? ... : true`
— PDFKit comprime cada content stream con Flate **por defecto**, y encima escribe el texto como
hex-strings dentro de operadores `Tj`/`TJ` (con números de kerning intercalados a mitad de
palabra). Las pruebas anteriores que hacían `buffer.toString('latin1')` y buscaban un substring
literal **nunca podían encontrar nada** — el único test que dependía de eso
(`not.toContain(uuid)`) "pasaba" por la razón equivocada (un buffer comprimido tampoco iba a
contener ese substring por azar), no porque probara lo que decía probar.

Se agregó un helper `textoPlano(buffer)` en `pdf.service.spec.ts` que: (1) localiza y descomprime
cada `stream...endstream` con `zlib.inflateSync`, (2) extrae cada token `<hex>` en orden (ignora
los números de kerning, no son caracteres) y concatena los bytes decodificados. Reconstruye el
texto tal como se ve en el PDF. Se aprovechó para corregir también el test viejo del UUID, que
ahora además verifica que el nombre del cliente sí aparece (antes solo probaba la ausencia del
UUID, nunca la presencia del reemplazo correcto).

## Verificación

- `npm run lint && npm run build && npm test` → exit 0 (23 suites, 179 tests). 4 tests nuevos en
  `pdf.service.spec.ts` (PENDIENTE sin monto; CARGO_ARRENDATARIO con monto; GASTO_INMOBILIARIA
  pagado con medio/referencia/fecha/pagado-por; GASTO_INMOBILIARIA aprobado sin pagar) + 1 test
  existente reforzado (UUID).
- **Humo real** (backend reiniciado en limpio para descartar código viejo en caché de
  `--watch`): se descargaron los 3 recibos de novedad reales del seed
  (`NOV-000001` GASTO_INMOBILIARIA pagado, `NOV-000002` CARGO_ARRENDATARIO, `NOV-000003`
  PENDIENTE), convertidos a PNG e inspeccionados visualmente — los 3 escenarios reales
  (pendiente sin monto, cargo con monto, gasto pagado con los 4 datos de pago) se ven correctos,
  con el mismo criterio visual del Recibo de Caja.

## Maintenance notes

- Si se agrega un nuevo valor a `ImpactoFinanciero` en el futuro, agregarlo a `ETIQUETA_IMPACTO`
  en `pdf-novedad.service.ts` (y a `useEstados.ts` en el frontend, que ya tiene el mismo mapa).
- El bloque de pago (`Estado de pago`/`Medio de pago`/`Fecha de pago`/`Pagado por`) es exclusivo
  de `GASTO_INMOBILIARIA` a propósito — un `CARGO_ARRENDATARIO` no tiene ese ciclo de pago propio
  (el cobro real ocurre vía Recibo de Caja cuando el cliente paga la obligación generada).
