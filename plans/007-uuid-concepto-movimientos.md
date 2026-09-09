# Plan 007: El `concepto` de Movimientos expone el UUID del contrato, no el cliente

> **ESTADO: DONE.** Ver commit al final de este archivo.

## Status

- **Priority**: P1 — el Administrador ve un UUID crudo en una pantalla de uso diario (Movimientos).
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (UX/datos)
- **Planned at**: ronda 2, 2026-09-04

## Why this matters

`Movimiento` (`src/modules/movimientos/entities/movimiento.entity.ts:65-80`) guarda
`contratoId`/`novedadId`/`reciboId` como UUIDs sueltos a propósito (no acoplar el módulo vía
`@ManyToOne`). El único campo humano-legible es `concepto`, y ahí se filtraba el UUID crudo en dos
sitios de `recaudo.service.ts`:

- `registrarPago` (línea 200): `` `Recaudo recibo ${formateado} — contrato ${contrato.id} (${detalle.medioPago})` ``
- `liquidarDeposito` (línea 670): `` `Devolución depósito de garantía — contrato ${contrato.id}. ${dto.observaciones ?? ''}`.trim() ``

En ambos casos `contrato` se cargaba sin la relación `cliente`. Confirmado en el consumidor real
`pages/movimientos/index.vue:187` (`{{ row.concepto }}`) — el Administrador veía literalmente
*"Recaudo recibo REC-000123 — contrato 3f2504e0-4f89-…"*.

**Fuera de alcance, ya correcto**: Recibos de Caja (`RecaudoService.listar/obtener`, PDF, Excel)
ya usan `contrato.cliente?.nombreCompleto` correctamente — no se tocaron.

**Evaluado y descartado**: `novedades.service.ts:232`, `` `Pago gasto novedad ${novedad.consecutivo ?? novedad.id}` ``
— el fallback es al id de la propia novedad, no de un cliente; solo se activa si `consecutivo`
viniera `null` (no debería en flujo normal). No es el mismo bug, no se toca.

## Scope

**In scope**: `src/modules/recaudo/recaudo.service.ts` (2 query builders + 2 interpolaciones de
`concepto`), `src/modules/recaudo/recaudo.integration.spec.ts` (2 tests nuevos).

**Out of scope**: `pages/movimientos/index.vue` (no requiere cambio, ya renderiza `row.concepto`
tal cual venga).

## Steps aplicados

1. `registrarPago`: añadido `.leftJoinAndSelect('c.cliente', 'cliente')` a la query builder de
   `contrato`; `concepto` ahora interpola `contrato.cliente?.nombreCompleto ?? contrato.id`.
2. `liquidarDeposito`: mismo patrón.
3. 2 tests nuevos en `recaudo.integration.spec.ts`: verifican que el `Movimiento` generado por
   cada operación contiene el nombre del cliente y NO contiene el UUID del contrato.
4. Smoke manual: registrado un pago real vía `/recaudo` (Paula Andrea Sánchez Moreno) → `/movimientos`
   muestra "Recaudo recibo REC-000030 — Paula Andrea Sánchez Moreno (EFECTIVO)". Confirmado.

## Done criteria

- [x] `npm run lint`, `npm run build`, `npm test` → exit 0 (167/167, 165 previos + 2 nuevos)
- [x] Los 2 tests nuevos pasan
- [x] Smoke manual confirmado en `/movimientos`
- [x] `git status --porcelain` sin archivos fuera de scope
- [x] Fila en `plans/README.md` actualizada

## Maintenance notes

- Registros de `Movimiento` creados ANTES de este fix conservan el UUID en su `concepto` (son
  datos históricos inmutables, no se reescriben — coherente con el principio de auditoría del
  sistema). Solo los movimientos nuevos muestran el nombre.
- El límite de 200 caracteres de `concepto` sigue siendo holgado incluso con nombres largos.
