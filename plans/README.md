# Implementation Plans — Backend Tamara & Saenz

Generados por la skill `improve` el 2026-09-03, tras la ronda 1 de correcciones de auditoría
(rama `correccion-hallazgos-auditoria`, ya mergeable). Estos planes cubren lo que quedó **fuera**
de esa ronda, más lo que el dueño pidió después (sesión de 1 día).

Cada ejecutor: lee el plan completo antes de empezar, respeta sus STOP conditions, actualiza tu
fila al terminar. Los planes son auto-contenidos (no asumen contexto de la sesión que los generó).

**Planned against commit**: `0506b3d` (planes 001–011, ronda 2) · `a9c242c` (planes 012–014, ronda 3).

## Orden de ejecución y estado

| Plan | Título | Prioridad | Esfuerzo | Riesgo | Depende de | Estado |
|------|--------|-----------|----------|--------|------------|--------|
| 001 | Errores de BD transitorios → 503 (no 400) | P2 | S | LOW | — | **DONE** (commit `ecb0433`) |
| 002 | Protección "último Administrador" a prueba de concurrencia | P2 | S | LOW | — | **DONE** (commit `7aef72c`) |
| 003 | Montos de dinero como `@IsInt` en toda la API | P3 | S | LOW | — | **DONE** (commit `f0e431e`) |
| 004 | Helmet + `trust proxy` en el bootstrap | P2 | S | LOW | — | **DONE** (commit `8c249e7`) |
| 005 | Limpieza de documentación del backend | P3 | M | LOW | — | **DONE** (commits `78f761e`..`a4371d7`) |
| 006 | Duración de sesión de ~1 día (login diario) | P2 | S | LOW | — | **DONE** (commit `dd65558`) |
| 007 | UUID del contrato en el `concepto` de Movimientos (ronda 2) | P1 | S | LOW | — | **DONE** (commit `a81ab49`) |
| 008 | Mejoras visuales en PDF de Recibo de Caja/Novedad (ronda 2, ad-hoc) | P2 | S | LOW | — | **DONE** (commit `0c86a1c`) |
| 009 | `SanitizarHtmlPipe` corrompía `&`/`<`/`>` en texto plano (ronda 2, ad-hoc) | P1 | S | LOW | — | **DONE** (commit `f651ba9`) |
| 010 | Columna Cliente ausente en el listado de Novedades (ronda 2) | P2 | S | LOW | — | **DONE** (commit `6613fc8`) |
| 011 | El Recibo de Novedad no declaraba el costo/impacto financiero (ronda 2, ad-hoc) | P2 | S | LOW | — | **DONE** (commit `e32641c`) |

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

---

## Ronda 3 — auditoría 2026-09-05 (primera tanda: seguridad y configuración)

Generados por `improve` tras la auditoría exhaustiva de las 4 dimensiones (arquitectura,
seguridad/config, rendimiento, consistencia de datos). Esta primera tanda es la "limpia": solo
seguridad/config, esfuerzo S–M, riesgo LOW–MED, **sin decisiones de negocio de por medio**.

| Plan | Título | Prioridad | Esfuerzo | Riesgo | Depende de | Estado |
|------|--------|-----------|----------|--------|------------|--------|
| 012 | **PASO 0** — Merge de las ramas de corrección a `main` + verificación baseline (cross-repo) | P0 | S | MED | — | **DONE** (merge BE `b31ea14`, FE `61505a8`) |
| 013 | Endurecimiento de secretos JWT, contraseñas semilla y modo de arranque (S-1, S-2, S-7) | P1 | S | LOW (cód.) / MED (rotación) | 012 | **TODO** |
| 014 | Remediación de dependencias vulnerables del backend — `npm audit`, `bcrypt`→`bcryptjs` (S-3) | P1 | S–M | LOW–MED | 012 | **TODO** |

### Ejecución de 012 (2026-09-07)

La verificación baseline destapó tres bloqueos **preexistentes** (ninguno regresión de rondas 1-3),
corregidos antes del merge:

1. **`npm test` flaky en local** (distinta suite cada corrida, verde en aislamiento): el bootstrap
   de integración pesado supera el timeout de 5 s de Jest bajo carga. Fix: `jest.setTimeout(30000)`
   vía `test/jest.setup-after-env.ts` (commit `b256d9f`). Verificado 3× verde.
2. **CI de backend roto al 100% desde su creación**: `.gitignore` ignoraba `.env.test`, así que en
   CI se inyectaban 0 variables y las 14 suites reventaban con
   `Configuration key "JWT_ACCESS_SECRET" does not exist`. Fix: versionar `.env.test` (valores
   ficticios; commit `0482a17`). **Primer CI verde del repo: run `34076437509` sobre el merge.**
3. **Lockfile del frontend desincronizado** (`Missing: commander@10.0.1`): `npm install` para
   re-sincronizar (FE commit `4a57af0`).

**Paso 5 (migración BD real) — PENDIENTE DEL DUEÑO.** La migración
`1786930000000-AnulacionDescuentoDeposito` (heredada de ronda 1, DEP-REV-01) debe aplicarse a
`tamara_saenz_db` real. Con el `.env` apuntando a la BD real, verificar con
`npx typeorm-ts-node-commonjs migration:show -d src/database/data-source.ts` y, si aparece
pendiente, aplicarla con `npm run migration:run`. Sin ella, cualquier consulta a
`DescuentoDeposito` falla (pantalla `/depositos`, concepto en `/movimientos`).

**Paso 7 (CI del frontend) — HECHO** (`.github/workflows/ci.yml`, FE commits `c39f065`/`9af3e09`/
`72c1811`). Notas: usa Node 24 (npm 11) porque el lockfile no resuelve con npm 10; incluye
`npx nuxt prepare` antes de lint/typecheck. El árbol de deps del FE tiene drift real
(vue-router pide `pinia ^3||^4`, el proyecto fija `^2`) — remediación completa en **FE-014**.
Primer CI verde del frontend: run `34077294907`.

Hallazgos cubiertos: **S-1** secretos JWT débiles · **S-2** contraseñas semilla predecibles y
publicadas en `.env.example` · **S-3** 6 vulnerabilidades de deps (1 crítica `tar`, nunca
escaneadas) · **S-7** `NODE_ENV=development` → Swagger expuesto.

Emparejamiento con el frontend (rama coordinada): plan **012** cubre el merge de **ambos** repos;
plan BE-**014** empareja con FE-**014** (misma higiene de dependencias, desplegar juntos).

### Notas de dependencia (ronda 3)

- **012 es el paso 0**: 013 y 014 se ramifican desde `main` ya mergeado. Si el merge se pospone,
  ambos indican que pueden ejecutarse sobre `correccion-hallazgos-auditoria`.
- **013 y 014 son independientes entre sí** (tocan archivos distintos: 013 → `main.ts` /
  `.env.example` / `seed.ts` / `README.md`; 014 → `package.json` / `auth.service.ts` /
  `usuarios.service.ts` / imports).
- **013** invalida todas las sesiones al rotar `JWT_ACCESS_SECRET` — coordinar ventana de re-login.

### Hallazgos de la ronda 3 NO incluidos en esta tanda (para no re-auditar)

Reales, aplazados por acotación explícita a "tanda limpia de seguridad". Ver el informe de
auditoría completo para evidencia:

| Hallazgo | Sev | Por qué no ahora |
|---|---|---|
| **S-6** `useApiFetch` reintenta POSTs no idempotentes → doble cobro | MED-HIGH | Es del **frontend** — plan FE-015 (misma tanda). |
| **S-5** `pages/login.vue` filtra credenciales por GET pre-hidratación | MED | Es del **frontend** — plan FE-016 (misma tanda). |
| **A-5** `exceljs`/`file-saver` muertos en el FE | S | Frontend — plan FE-014. |
| **S-8** Access token de 8 h, no revocable | LOW-MED | Bajar `JWT_ACCESS_EXPIRES_IN` a 15-30 min. Muy relacionado con 013; se hará justo después (mencionado en las Notas de mantenimiento de 013). |
| **S-10** Refresh token sin detección de reuso ni limpieza de filas revocadas | LOW | Plan propio (M). |
| **S-11** CI del FE inexistente; `npm audit` no está en CI | MED | Parcialmente en 012 (Paso 7 opcional, CI mínimo FE) y en 014 (Paso 4, `npm audit` en CI BE). El resto, plan propio. |
| **S-12** `AGENTS.md` + docs de negocio fuera de git (`.gitignore` `**/*.md` demasiado amplio) | LOW-MED | S, sin riesgo; se puede plegar en cualquier plan que toque `.gitignore` o hacer uno pequeño. |
| **D-1 / D-4** Dinero `decimal` → string en JSON; sin transformer decimal↔number | MED | El fix keystone de consistencia de datos. Riesgo MED (toca todo cálculo financiero). Plan propio, siguiente tanda. |
| **P-1** `generarCanonesMensuales` O(contratos×meses) queries diarias | LOW-MED | Rendimiento; volumen bajo hoy. Plan propio. |
| **P-4** Índices compuestos faltantes (`obligacion(estado,fechaVencimiento)`, `recibo_caja.creadoEn`, `movimiento(medioPago,tipo,esReverso)`) | LOW | Verificar con `EXPLAIN` primero. Plan propio con migración. |
| **Observabilidad**: logging sin estructura ni correlation IDs | MED | Plan propio. |
| **A-1 / D-2** Cliente OpenAPI generado / tipos compartidos | MED | Ya estaba en "NO planeados" de la ronda 2. Proyecto en sí. |

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
