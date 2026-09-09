# Plan 010: Columna Cliente ausente en el listado de Novedades (cross-repo)

> **ESTADO: DONE.** Ver commit al final. Contraparte frontend: ver
> `FrontendTamara-Saenz/plans/006-columna-cliente-novedades.md`.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: gap de UX (no es un bug de UUID expuesto — el campo simplemente no venía)

## Why this matters

`NovedadesService.listar()` (`src/modules/novedades/novedades.service.ts:68-82`) solo hacía
`leftJoinAndSelect('n.inmueble', 'inmueble')` — nunca unía `contrato`/`contrato.cliente`. Como
`Novedad.contrato` es `@ManyToOne(..., { nullable: true })` sin `eager`, la propiedad simplemente
no venía en el JSON del listado (no un UUID visible, ausencia total del campo). Ya era correcto en
`obtener()` (detalle) y en el PDF de novedad — el gap era solo en el listado, que es lo que
consumen `pages/novedades/index.vue` y `components/recibos/TablaRecibosNovedad.vue` del frontend.
Esto contradice `ESPECIFICACION_UI_UX_PAGINA_POR_PAGINA.md:607`, que exige la columna Cliente en
el tablero de Novedades.

## Fix

`novedades.service.ts:69`: se agregó `.leftJoinAndSelect('n.contrato', 'contrato')` y
`.leftJoinAndSelect('contrato.cliente', 'cliente')` a la query builder de `listar()`.
`Novedad→Contrato→Cliente` son ambos `ManyToOne` — el join no produce fan-out ni infla el `COUNT`
de `paginar()`.

## Scope

**In scope**: `src/modules/novedades/novedades.service.ts` (solo `listar()`),
`src/modules/novedades/novedades.integration.spec.ts` (2 tests nuevos).

**Out of scope**: `obtener()` y el PDF de novedad (ya correctos, no se tocaron).

## Verificación

- `npm run lint`, `npm run build`, `npm test` → exit 0 (175/175, 173 previos + 2 nuevos).
- Test nuevo 1: crear una novedad ligada a un contrato → `listar()` incluye
  `contrato.cliente.nombreCompleto`.
- Test nuevo 2: crear una novedad SIN contrato (solo inmueble) → `listar()` no revienta,
  `contrato` viene `null`.
- **Humo real** (backend + frontend corriendo, login Administrador): en `/novedades` y en la
  pestaña "Recibos de novedad" de `/recibos`, las 2 novedades existentes (con contrato) muestran
  el nombre del cliente; se registró una tercera novedad real sin contrato asociado
  ("Prueba de humo sin contrato") y la columna Cliente mostró `—` sin errores de consola nuevos
  (el único error de consola presente — "Hydration completed but contains mismatches" — es
  preexistente, del sidebar de navegación, no relacionado con este cambio).

## Maintenance notes

- **Reviewer**: confirmar que el join nuevo no afecta el `total` devuelto por `paginar()`.
- Ver la contraparte de frontend para el detalle de la columna nueva y el problema (y solución)
  de nombrar un slot de `UTable` con un `key` que contiene puntos.
