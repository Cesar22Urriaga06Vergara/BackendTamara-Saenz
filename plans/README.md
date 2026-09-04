# Implementation Plans — Backend Tamara & Saenz

Generados por la skill `improve` el 2026-09-03, tras la ronda 1 de correcciones de auditoría
(rama `correccion-hallazgos-auditoria`, ya mergeable). Estos planes cubren lo que quedó **fuera**
de esa ronda, más lo que el dueño pidió después (sesión de 1 día).

Cada ejecutor: lee el plan completo antes de empezar, respeta sus STOP conditions, actualiza tu
fila al terminar. Los planes son auto-contenidos (no asumen contexto de la sesión que los generó).

**Planned against commit**: `0506b3d` (rama `correccion-hallazgos-auditoria`).

## Orden de ejecución y estado

| Plan | Título | Prioridad | Esfuerzo | Riesgo | Depende de | Estado |
|------|--------|-----------|----------|--------|------------|--------|
| 001 | Errores de BD transitorios → 503 (no 400) | P2 | S | LOW | — | **DONE** (commit `ecb0433`) |
| 002 | Protección "último Administrador" a prueba de concurrencia | P2 | S | LOW | — | **DONE** (commit `7aef72c`) |
| 003 | Montos de dinero como `@IsInt` en toda la API | P3 | S | LOW | — | **DONE** (commit `f0e431e`) |
| 004 | Helmet + `trust proxy` en el bootstrap | P2 | S | LOW | — | **DONE** (commit `8c249e7`) |
| 005 | Limpieza de documentación del backend | P3 | M | LOW | — | **DONE** (commits `78f761e`..`a4371d7`) |
| 006 | Duración de sesión de ~1 día (login diario) | P2 | S | LOW | — | **DONE** (commit `dd65558`) |

Valores de estado: TODO · IN PROGRESS · DONE · BLOCKED (con razón en una línea) · REJECTED (con motivo).

Los 6 planes son **independientes** — se pueden ejecutar en cualquier orden o en paralelo (tocan
archivos distintos). El orden numérico es solo por prioridad/leverage.

## Notas de dependencia

- Ninguna dependencia dura entre planes.
- **006** (sesión de 1 día) empareja con el plan **004 del repo frontend** (resiliencia de
  sesión / "reconectando…"): 006 acorta la sesión, 004 hace que un corte de red no la termine.
  No dependen técnicamente pero conviene desplegarlos juntos.
- **001** (errores 503) tiene un follow-up en el frontend: que `useApiFetch` reintente ante un
  503. El plan 004 del frontend ya deja `esFalloDeRed` contemplando 502/503/504 — al mergear 001
  eso ya funciona.

## Hallazgos considerados y NO planeados en esta tanda

Se documentan aquí para que no se re-auditen. Son reales pero se dejaron fuera por decisión
explícita del dueño (alcance: correctitud/concurrencia + hardening barato + docs + sesión):

| Hallazgo | Por qué no ahora |
|---|---|
| **`CajaService.registrarArqueo` no transaccional** | Evaluado: un `ArqueoCaja` es un registro-snapshot inmutable, no una mutación de saldo. Dos arqueos concurrentes producen dos registros con el mismo `saldoEsperado` — redundante, no corrupción. El único fix real (usar `redondearMoneda` en vez de `Math.round`) se pliega en el **plan 003**. |
| **`aplicacion_pago.concepto` en BD es `enum('CAPITAL','MORA')` vs enum TS solo `CAPITAL`** | Migración de estrechamiento de enum. Real pero inofensivo (el código nunca escribe 'MORA'). Va en una futura tanda de "limpieza de esquema muerto de mora" junto con lo siguiente. Esfuerzo S, riesgo MED (migración). |
| **Tabla `historial_tasa_mora` huérfana** (sin entidad, sin lector) | Migración destructiva. Agruparla con el enum de arriba en una tanda de limpieza de esquema. Sin impacto funcional mientras exista. |
| **Dependencia implícita de TZ del servidor** (`esVencida()` usa JS `new Date()`, la query usa `CURDATE()`) | Real (M, riesgo MED). Requiere una pasada cuidadosa por todo el manejo de fechas + tests con TZ forzada. Merece su propio plan `deep`; no cabe en esta tanda. |
| **Sin cliente TypeScript generado desde OpenAPI** (tipos compartidos BE↔FE) | L, alto valor a mediano plazo. Es un proyecto en sí (generación + wiring en el frontend + CI). Decisión de arquitectura, no de esta tanda. |
| **Listados sin paginar** (`/propietarios/todos`, `/inmuebles/disponibles`, `/inmuebles/barrios`) | Aceptable hoy (selects de formulario, volumen bajo). Vigilar si el portafolio crece. S, bajo valor inmediato. |
| **Falta test-cerrojo anti-mora** (que falle si `registrarPago` genera una `AplicacionPago` MORA) | S, valor de red de seguridad. Candidato claro para la próxima tanda de tests. |
| **`Consecutivo` con `@VersionColumn` redundante + carrera en primer uso** | Solo primera vez por tipo de contador; 409 espurio y recuperable. Muy bajo impacto. |
| **`GET /movimientos` sin `FilterMovimientoDto`** | El bug real (fecha `hasta`) ya se arregló a nivel service en la ronda 1. El DTO es consistencia; se puede plegar en cualquier plan que toque ese controller. |
| **Límite de vida ABSOLUTO de sesión** (re-login forzado cada X horas sin importar la actividad) | El plan 006 hace la ventana deslizante de 1 día, que cubre el 90% del caso. Un tope absoluto necesita rastrear `sessionStartedAt` aparte — plan propio si el dueño lo pide más estricto. |

## Decisiones de negocio pendientes (para el dueño — no son planes de código)

Ninguno de los planes de arriba las necesita, pero bloquean funcionalidad futura:

- **D11 — Permisos de Recepcionista**: el código permite a Recepcionista editar inmuebles
  (`PATCH /inmuebles/:id`) y cambiar estado de novedades; `ESPECIFICACION §3.2` define una lista
  cerrada de 6 acciones sin "editar". ¿Gana el código o la especificación?
- **§I — Propietarios / comisiones**: decidir si se construye el módulo grande (comisión de
  administración, liquidación mensual, estado de cuenta). Bloquea la UI de Propietarios (plan
  del repo frontend).
- **§A — Fechas de pago del canon**: frecuencia, día común vs por contrato, cambio de día
  pactado, festivos. Afecta el motor de generación de canon.
- **§C — Medios de pago**: ¿solo efectivo/transferencia? ¿pago parcial mixto?
- **§D — Terminación**: ¿preaviso obligatorio? ¿multa por terminación anticipada? ¿el canon
  futuro se anula automático (hoy sí) o caso por caso?
