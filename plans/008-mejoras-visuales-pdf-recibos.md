# Plan 008: Mejoras visuales en los PDF de Recibo de Caja y Recibo de Novedad

> **ESTADO: DONE.** Ver commit al final de este archivo. Pedido ad-hoc del dueño durante la
> ejecución de BE-007 ("mejora los recibos... desde el logo que salga un poco más grande hasta
> todo los detalles mejorables").

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: UX/visual (documentos financieros)
- **Planned at**: ronda 2, 2026-09-04

## Why this matters

El dueño pidió, tras ver corregido el bug de UUID en Movimientos, una revisión más amplia de la
presentación visual de los PDFs oficiales (Recibo de Caja y Recibo de Novedad) — específicamente
el logo (mencionado como "un poco pequeño") y "todos los detalles mejorables". Se investigó el
código de ambos servicios (`pdf-recibo.service.ts`, `pdf-novedad.service.ts`) y se propusieron 4
mejoras concretas, confirmadas con el dueño antes de implementar (ver AskUserQuestion): las 4,
completas.

## Scope

**In scope**: `src/modules/documentos/pdf-recibo.service.ts`, `src/modules/documentos/pdf-novedad.service.ts`.

**Out of scope**: cualquier otro archivo de negocio/lógica — este plan es puramente visual, no
cambia ningún cálculo ni dato mostrado.

## Cambios aplicados

1. **Logo más grande**: 90×64pt → 112×80pt (misma proporción, +25%) en ambos PDFs. En el formato
   Media Carta del Recibo de Caja, el logo ahora se escala por `espaciado.escala` (antes NO se
   reducía ahí — quedaba igual de grande en una hoja de la mitad de alto, desproporcionado).
2. **Total destacado** (solo Recibo de Caja, el de Novedad no maneja dinero): "Valor total
   recibido" ahora tiene una caja de fondo color oro claro detrás, mismo criterio visual que ya
   usaba la insignia de estado en el Recibo de Novedad.
3. **Número de recibo con más peso visual**: "No. REC-000030" / "No. NOV-000002" pasan de texto
   plano a negrita + color oro corporativo, en ambos PDFs.
4. **Paleta de colores unificada**: `pdf-recibo.service.ts` tenía hex sueltos repetidos; ahora usa
   las mismas constantes nombradas que ya existían en `pdf-novedad.service.ts`
   (`COLOR_TEXTO`/`COLOR_GRIS`/`COLOR_ORO`/`COLOR_BORDE`/`COLOR_DIVISOR`/`COLOR_ROJO`/`COLOR_BLANCO`,
   más `COLOR_ORO_CLARO` nuevo para el fondo del total).

## Verificación

- `npm run lint`, `npm run build`, `npm test` → exit 0 (167/167, sin tests nuevos — cambio
  puramente visual, cubierto por los 8 tests existentes de `pdf.service.spec.ts` que ya validan
  contenido/estructura del PDF).
- **Humo visual real**: se configuró temporalmente `empresa.logoUrl` (revertido a `NULL` después)
  para poder ver el logo en el render; se generaron los 3 PDF reales (Recibo Carta, Recibo Media
  Carta, Recibo de Novedad) vía los endpoints reales con un token de sesión real, convertidos a
  PNG y revisados visualmente — logo más grande y bien proporcionado en ambos formatos, caja de
  total visible y legible, número de recibo con jerarquía visual clara. Sin errores de layout
  (nada se solapa ni se corta).

## Hallazgo colateral (NO corregido aquí, fuera de alcance)

`empresa.nombre` se muestra como `"Inversiones Tamara &amp; Saenz S. En C."` (entidad HTML `&amp;`
literal en vez de `&`) en los 3 PDFs revisados — bug preexistente de escape de HTML en algún punto
de la cadena guardado/lectura del nombre de la empresa, no introducido por este plan. Reportado al
dueño; pendiente de un plan propio si se quiere corregir.

## Maintenance notes

- El logo temporal usado para el humo (`uploads/empresa/88bb0144-....png`, ya existente en disco)
  no se tocó ni se borró; solo se limpió la referencia en `empresa.logoUrl`.
- Estos cambios no afectan el cálculo de ningún valor mostrado, solo su presentación.
