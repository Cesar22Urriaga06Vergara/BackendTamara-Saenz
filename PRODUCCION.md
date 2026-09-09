# Camino a producción — Inversiones Tamara & Saenz

> Estado a **2026-09-09**. Sistema **nunca desplegado** (solo local/dev).
>
> **Ronda 4 (bloqueantes de código) — CERRADA.** Backend 015–022 y frontend FE-017/FE-018
> mergeados a `main`, CI verde en ambos repos. Excepciones:
> - **BE-022 parcial**: el fix de fechas (`hoyNegocioISO`) sí; `timezone:'Z'` no (rompe
>   `type:'date'`) → **plan 023** (P2/MED, no bloquea staging si Railway queda en UTC).
> - **FE-019** (dinero-como-string): **bloqueado hasta el primer deploy del backend** (BE-021
>   mergeado, no desplegado).
>
> Lo que queda para staging es **operativo** (crear proyectos Railway/Cloudflare/Sentry, cargar
> variables, DNS, primer seed) + **validación** (QA-1/2/3). Este archivo es la fuente de verdad
> del despliegue — actualízalo a medida que cierres ítems.

## Stack de despliegue elegido

| Pieza | Plataforma | Notas |
|---|---|---|
| Backend (NestJS) | **Railway** (servicio) | Auto-deploy desde `main`. TLS en el edge de Railway. **`TZ` sin definir** (proceso en UTC, igual que el plugin MySQL — ver DATA-2). |
| Base de datos | **Railway** (plugin MySQL 8) | Código en `type: 'mysql'` (DB-1 hecho, plan BE-016). Las 25 migraciones + 212 tests verde contra MySQL 8. |
| Frontend (Nuxt) | **Cloudflare Pages** | SPA estática (`ssr: false`, output `dist/`). DNS + CDN + SSL + WAF de Cloudflare. Build: `npm run generate`. |
| Archivos subidos (logo empresa) | **Railway Volume** | Código listo (`UPLOADS_DIR`, plan 017). Falta crear el Volume + setear la variable (DB-2 operativo). |

Railway/Cloudflare **ya resuelven**: hosting, SSL/TLS, DNS, CDN, gestión de variables de entorno,
y CI/CD de despliegue (deploy en cada push a `main`). Lo que sigue es lo que **no** resuelven.

---

## ✅ Ya resuelto (a nivel código)

CI verde en ambos repos · `npm audit` 0 (backend) · rate-limit en `/auth/login` (5/min) ·
CORS por env (no wildcard) · Helmet + **CSP endurecida** (sin `'unsafe-inline'` en `script-src`) ·
`ValidationPipe` global (whitelist + forbidNonWhitelisted) · JWT + RolesGuard ·
`synchronize:false` gateado por env · 25 migraciones aplicadas en la BD local ·
cron diario de cánones · trazabilidad de auditoría persistida · guardia de arranque de secreto JWT ·
`SWAGGER_ENABLED` opt-in · seed sin contraseñas publicadas · `TRUST_PROXY` configurable ·
**`GET /api/v1/health`** (plan 018) · **Sentry** back + front gateado por DSN (019, FE-018) ·
**logging JSON `pino` + `x-request-id`** (020) · **dinero `decimal→number`** en toda la API (021) ·
**"hoy de negocio" en Bogotá** para cartera/canon (022) · frontend **SPA Cloudflare Pages + `_headers`**
(FE-017). 212 tests backend / 22 frontend.

---

## 🔴 BLOQUEANTE — no se puede ir a producción sin esto

### DB-1 — Compatibilidad MariaDB → MySQL 8 (Railway) — ✅ HECHO (plan BE-016, 2026-09-08)
- [x] Verificado contra **MySQL 8.4.11** real: las **25 migraciones** corren limpio (incluidas las
  2 con columnas `GENERATED STORED`), son idempotentes, y la **suite de 188 tests** pasa (con
  `synchronize:true` generando el esquema desde entidades).
- [x] `type: 'mariadb'` → **`type: 'mysql'`** en `app.module.ts` y `data-source.ts` (re-verificado).
- [x] CI (`.github/workflows/ci.yml`) cambiado de `mariadb:10.11` a `mysql:8.4`.
- [x] El "día calendario" (`obligacion.periodo`, cartera vencida) ya no depende del TZ de la
  sesión — plan 022 (`hoyNegocioISO`). Pendiente el `timezone:'Z'` de la sesión → plan 023.

### DB-2 — Almacenamiento del logo de empresa (FS efímero en Railway) — ✅ HECHO (plan 017, 2026-09-08)
- [x] Todas las rutas de uploads pasan por `src/common/utils/rutas-archivos.util.ts`
  (`directorioUploads()` = `UPLOADS_DIR` o `<repo>/uploads`). Tocado: `empresa.controller.ts`,
  `empresa.service.ts`, `main.ts`, `pdf-recibo.service.ts`, **`pdf-novedad.service.ts`** (este
  último no estaba en el plan original — también incrusta el logo).
- [x] Nueva variable `UPLOADS_DIR` documentada en `.env.example` y el README.
- [ ] **Operativo**: crear un Railway Volume (mountPath `/data`) y setear `UPLOADS_DIR=/data/uploads`.
  Sin eso, el logo se sigue perdiendo en cada deploy.

### DEPLOY-1 — Configuración de plataforma
- [x] **Backend Railway** — `Dockerfile` multi-stage + `railway.json` (`startCommand`, `healthcheckPath`, restart policy) + `tsconfig.build.json` (build determinista, `dist/main.js`) + `engines` + `.nvmrc` + script `deploy:migrate` + `app.listen(port, '0.0.0.0')` + matriz de variables en el README. **→ plan 015 (hecho, 2026-09-08)**. Verificado: `npm ci` + build + `npm ci --omit=dev` + `node dist/main` + `deploy:migrate` cargan bien.
- [x] **Frontend Cloudflare** — ✅ HECHO (plan FE-017, 2026-09-09): `ssr: false` + preset
  `cloudflare-pages` (SPA estática, output **`dist/`**), `public/_headers` (CSP/HSTS/…),
  `public/_redirects` (`/* /index.html 200` para los deep links), `.nvmrc`=`24` + `engines`,
  README con la config del dashboard. **Operativo**: reemplazar el placeholder del backend en
  `connect-src` de `_headers` antes del deploy.
- [x] **`healthcheckPath` de `railway.json`** apunta a `/api/v1/health` — ya existe (plan 018, 2026-09-08).
- [ ] **Variables de entorno en producción** (lista completa en el README, sección "Despliegue (Railway)").
- [ ] **CORS**: `CORS_ORIGIN` = dominio exacto de Cloudflare Pages (no `*`, no `localhost`) — setear al cablear los dominios.
- [ ] **Dominio propio** + registros DNS en Cloudflare apuntando a Pages (frontend) y CNAME a Railway (backend).
- [ ] **Primer seed**: correr `node dist/database/seeds/seed.js` una vez, luego quitar `SEED_*_PASSWORD`.

### DB-3 — Backups y restore
- [ ] Confirmar la política de **backup del plugin MySQL de Railway** (frecuencia, retención)
- [ ] **Probar un restore** en un proyecto Railway aparte — un backup no probado no es un backup
- [ ] Documentar el procedimiento de restore en este archivo

### OBS-1 — Health check — ✅ HECHO (plan 018, 2026-09-08)
- [x] Endpoint **`GET /api/v1/health`** (sin auth, `@Public()`): pinga la BD (`SELECT 1`, timeout 3 s),
  200 `{status:'ok',...}` / 503 `{status:'error',...}`. Lo consume el healthcheck de `railway.json`
  y el monitor de uptime. Sin `@nestjs/terminus` (v12 es ESM y rompe la suite Jest CJS) — hand-rolled,
  cuerpo con la misma forma (`info`/`error`/`details`). No expone versión ni host.

### OBS-2 — Error reporting — ✅ HECHO (backend plan 019, frontend plan FE-018, 2026-09-09)
- [x] **Sentry backend** (`@sentry/nestjs@10.73.0`): `src/instrument.ts` (init gateado por `SENTRY_DSN`,
  primer import de `main.ts`), `SentryModule.forRoot()` + `SentryGlobalFilter` (`APP_FILTER`).
  Sin DSN es inerte. **Operativo**: crear el proyecto Sentry backend y setear `SENTRY_DSN` en Railway.
- [x] **Sentry frontend** (`@sentry/vue@10.73.0`, no `@sentry/nuxt` — SPA estática): plugin
  `plugins/sentry.client.ts` gateado por `NUXT_PUBLIC_SENTRY_DSN`; `replaysSessionSampleRate: 0`,
  `sendDefaultPii: false`. **Operativo**: proyecto Sentry frontend + `NUXT_PUBLIC_SENTRY_DSN` en
  Cloudflare Pages + su host en `connect-src` de `public/_headers`.
- [x] Filtro global que reporta a Sentry los errores no controlados y devuelve 500 genérico
  (`SentryGlobalFilter`); `TypeOrmExceptionFilter` sigue traduciendo `QueryFailedError` primero
  (orden de filtros verificado). Los `HttpException` no se reportan (son "esperados").

### OBS-3 — Logging estructurado — ✅ HECHO (plan 020, 2026-09-09)
- [x] `nestjs-pino` — JSON de una línea a stdout en prod, `pino-pretty` legible solo en dev,
  `silent` en test. Nivel por `LOG_LEVEL` (default: `info` prod / `debug` dev). `app.useLogger`
  + `bufferLogs`. `redact` de `authorization`/`cookie`. El `console.error` del audit interceptor
  ahora usa el logger inyectado (`PinoLogger`).
- [x] Correlation ID por petición: header `x-request-id` en cada respuesta (propaga el entrante o
  genera un UUID). Falta: que el frontend mande uno por operación (follow-up).

### OBS-4 — Monitoreo de uptime + alertas
- [ ] UptimeRobot / BetterStack / Cloudflare Health Checks sobre `/health` y `POST /auth/login`
- [ ] Canal de alerta (email / WhatsApp / Telegram) definido

### SEC-1 — Rotación operativa de secretos (BE-013)
- [ ] `JWT_ACCESS_SECRET` real → valor aleatorio (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) — **invalida todas las sesiones**
- [ ] `NODE_ENV=production`, `SWAGGER_ENABLED` ausente, `JWT_REFRESH_SECRET` eliminado del `.env`
- [ ] Contraseñas de `admin@`/`recepcion@` cambiadas desde `/administracion` si se sembraron con valores de ejemplo

### SEC-2 — Cabeceras de seguridad del frontend
- [x] ✅ HECHO (plan FE-017): `public/_headers` con CSP, HSTS, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. `script-src
  'unsafe-inline'` es la concesión conocida (Nuxt inyecta el payload de hidratación inline; Pages
  estático no genera nonce por request). **Operativo**: reemplazar el placeholder del backend en
  `connect-src` antes del primer deploy.
- [x] Revisar la CSP del **backend** (`main.ts`) — ✅ HECHO (plan 018): `script-src` ya no lleva
  `'unsafe-inline'` (solo `style-src`, para Swagger opt-in); + `object-src 'none'`,
  `frame-ancestors 'none'`, `base-uri 'self'`.

### DATA-1 — Dinero como `decimal` → string en el JSON (D-1 / D-4) — 🟡 backend HECHO (plan 021), falta frontend (FE-019)
- [x] Transformer TypeORM `decimal ↔ number` (`src/common/utils/columna-numerica.transformer.ts`)
  en las **27 columnas de dinero** de 12 entidades. La columna se hidrata como `number`; el JSON
  del API sale con números. Los `Number(...)` redundantes de los services quitados (quedan solo
  los de agregados `getRawOne`/`SUM`, que TypeORM sí devuelve como string).
- [x] Test de integración: tras `registrarPago`, `typeof recibo.valorTotal === 'number'` (+ 6
  campos más). Unit del transformer (8 casos).
- [ ] **FE-019**: limpiar los `Number()` y las uniones `number | string` del frontend — depende
  de que este plan esté desplegado.

### DATA-2 — Zona horaria del servidor — 🟡 el bug de lógica HECHO (plan 022, 2026-09-09); el `timezone` de sesión queda como follow-up
- [x] El "hoy de negocio" se calcula siempre en **America/Bogota** (`hoyNegocioISO()` en
  `fecha.util.ts`, vía `Intl`, sin deps ni DST, independiente del `TZ` del proceso).
  `esVencida()` (JS) y `condicionCarteraVencida` (SQL, ahora `:hoyNegocio` en vez de la función
  "hoy" de MySQL) comparan contra el mismo día — **se acabó el desfase de la franja nocturna**.
  Igual para la generación de canon (`generarCanonesParaContrato`) y el recaudo del mes (dashboard).
- [x] Tests: `vencimiento-tz.integration.spec.ts` (JS ↔ SQL coinciden en la frontera hoy/mañana) +
  `fecha.util.spec.ts` (5 casos, frontera de medianoche con fake timers). Verificado además con
  `TZ=UTC npm test` y `TZ=America/Bogota npm test`.
- [ ] **`timezone: 'Z'` en la conexión mysql2 — NO aplicado.** Se probó y **rompe el round-trip de
  las columnas `type: 'date'`**: mysql2 serializa los `Date` de query en UTC y TypeORM re-formatea
  con getters locales → corrimiento de un día en `periodo`/`fechaVencimiento` (revienta el índice
  único de canon). Hacerlo bien exige pasar strings "YYYY-MM-DD" en vez de `Date` en todo el motor
  de canon + `dateStrings: ['DATE']` — es un plan propio (`023`, MED). Mientras tanto:
- [ ] **Operativo**: **NO** definir `TZ` en Railway (dejar el proceso en UTC, igual que el plugin
  MySQL). Así mysql2 (`timezone: 'local'` por defecto) y la BD concuerdan y los `datetime`/
  `creadoEn` se leen bien. Si más adelante se quiere `TZ=America/Bogota` para los logs, primero el plan 023.

### QA-1 — Entorno de staging
- [ ] Segundo proyecto Railway + segundo Cloudflare Pages (rama `staging` o preview deploys) con datos de prueba
- [ ] Mismas variables que prod salvo secretos y BD

### QA-2 — Humo manual de los flujos críticos (en staging)
- [ ] login → dashboard → seleccionar contrato → **registrar pago mixto** → PDF de recibo → **anular** → verificar reverso exacto
- [ ] liquidar depósito de un contrato terminado → verificar egreso y descuentos
- [ ] generar cánones manual → verificar que no duplica
- [ ] BE-012: `/depositos` carga sin 500 (ejercita `recaudo.service.ts:815`, columna `anuladoEn`)
- [ ] FE-015: DevTools Network → Offline al confirmar un pago → **1 sola** request + aviso ámbar
- [ ] FE-016: JS deshabilitado en `/login` → Enter **no** pone la clave en la URL

### QA-3 — Test E2E del camino del dinero
- [ ] Al menos un E2E (Playwright): login → registrar pago → verificar recibo + movimientos + saldo del contrato

### DEPLOY-2 — Runbook de rollback
- [ ] Railway: "Redeploy" de un deployment anterior (< 2 min). Documentar el paso exacto.
- [ ] Cloudflare Pages: "Rollback" a un deployment anterior.
- [ ] Qué hacer con una migración ya aplicada (¿tiene `down()`? — verificar cada una)
- [ ] A quién se avisa y por qué canal

---

## 🟠 ALTO — antes de dar acceso a usuarios reales

- [x] **FE-014** — deps muertas fuera + `overrides` js-yaml/svgo + `npm audit` en el CI del front
  (PR #5). **FE-014b**: `pinia ^4` + `.nvmrc` a Node 22 LTS (PR #7).
- [ ] **secret scanning** (gitleaks) en ambos CI. (`npm audit` ya está en los dos CI.)
- [x] **S-10** — cron diario `RefreshTokenCron.podar()` (borra expirados + revocados > 7 días;
  conserva revocados recientes como ventana para detección de reuso). La **detección de reuso**
  en sí sigue pendiente (plan propio).
- [ ] **P-4** — índices compuestos (`obligacion(estado,fechaVencimiento)`, `recibo_caja.creadoEn`,
  `movimiento(medioPago,tipo,esReverso)`) — migración. _(en curso, misma tanda)_
- [ ] **Política de contraseñas** — regex mayúscula+dígito en los DTOs. Lockout tras N intentos
  lo mitiga hoy el rate-limit de 5/min en `/auth/login`. _(en curso, misma tanda)_
- [ ] **Accesibilidad** — pasada WCAG AA. Sin auditar.
- [x] **Rate-limit global** — `ThrottlerModule` global (200/min por IP), `/auth/login` 5/min,
  `/health` exento. ⚠️ Requiere `TRUST_PROXY` seteado en Railway para contar la IP del cliente.
- [x] **Pool de conexiones** — `extra.connectionLimit` = `DB_POOL_SIZE` (default 10). Dimensionar
  al máx. del plugin MySQL de Railway.
- [x] **S-12** — docs y planes versionados en git (PR #15 backend, #6 frontend).

---

## 🟡 RECOMENDADO — primeras semanas

- [ ] Documentación de operaciones en este archivo: deploy, backup/restore, rotación de secretos, "qué hacer si X"
- [ ] ADRs de las decisiones grandes (SSR vs SPA, dinero como número, MariaDB→MySQL) + `CHANGELOG.md`
- [ ] Mini-guía para cajero y recepción
- [ ] Métricas de negocio en un dashboard (recaudo del día, cartera, arqueos)
- [ ] Core Web Vitals + presupuesto de bundle del frontend (Cloudflare Web Analytics es gratis)
- [ ] Refactor "refetch dentro del `try` de la mutación" en 8 páginas del frontend
- [ ] **P-1** — `generarCanonesMensuales` O(contratos×meses) — no urgente a volumen bajo
- [ ] Limpieza de esquema muerto de mora (enum `aplicacion_pago.concepto`, tabla `historial_tasa_mora`)
- [ ] Feature flags — baja prioridad para el primer lanzamiento de una herramienta interna de 1 oficina

---

## Decisiones de negocio del dueño (bloquean features, no el deploy)

**D11** permisos Recepcionista · **§I** módulo Propietarios/comisiones · **§A** fechas de pago del
canon · **§C** medios de pago · **§D** terminación (preaviso/multa). **§A** y **§D** afectan el
motor de cánones que sí va a producción — conviene cerrarlas antes de que haya datos reales.

---

## Orden sugerido de ataque

**Código: ✅ 1–4 hechos** (DB-1, DEPLOY-1, DB-2, OBS-1/2/3, SEC-2, DATA-1 backend, DATA-2 lógica).
Falta código: **OBS-3 correlation-id→frontend** (follow-up menor), **DATA-1 frontend** (FE-019,
bloqueado por deploy), **plan 023** (timezone sesión, no bloquea si Railway=UTC).

Lo que sigue es **operativo** (solo el dueño):

1. **Railway**: proyecto + servicio backend + plugin MySQL 8 + **Volume** `/data`
   (`UPLOADS_DIR=/data/uploads`) + matriz de variables del README + Sentry DSN. **No** setear `TZ`.
2. **SEC-1**: rotar `JWT_ACCESS_SECRET`, `NODE_ENV=production`, quitar `SWAGGER_ENABLED`/
   `JWT_REFRESH_SECRET`, cambiar claves de `admin@`/`recepcion@`.
3. **Cloudflare Pages**: proyecto frontend (build `npm run generate`, output `dist/`) + variables
   (`NUXT_PUBLIC_API_BASE_URL`, `NUXT_PUBLIC_SENTRY_DSN`) + reemplazar el placeholder del backend
   en `public/_headers` `connect-src`.
4. **CORS**: `CORS_ORIGIN` del backend = el dominio de Pages (sin barra final).
5. **Dominio + DNS** en Cloudflare (Pages para el front, CNAME a Railway para la API).
6. **Sentry**: 2 proyectos (back/front), DSNs a las variables.
7. **OBS-4**: monitor de uptime (UptimeRobot/BetterStack) sobre `/api/v1/health` + canal de alerta.
8. **Primer seed** (`node dist/database/seeds/seed.js`), luego quitar `SEED_*_PASSWORD`.
9. **QA-1/2/3** en staging — humo de flujos críticos + 1 E2E.
10. **DB-3** (restore probado) + **DEPLOY-2** (runbook de rollback).
11. Go-live con monitoreo activo la primera semana.

Antes de exponer a usuarios reales: la tanda **🟠 ALTO** (FE-014, `npm audit`+gitleaks en CI,
S-10, P-4, política de contraseñas, accesibilidad, rate-limit global, pool de conexiones, S-12).
