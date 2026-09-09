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
| 013 | Endurecimiento de secretos JWT, contraseñas semilla y modo de arranque (S-1, S-2, S-7) | P1 | S | LOW (cód.) / MED (rotación) | 012 | **DONE (código)** — rotación operativa PENDIENTE DEL DUEÑO |
| 014 | Remediación de dependencias vulnerables del backend — `npm audit`, `bcrypt`→`bcryptjs` (S-3) | P1 | S–M | LOW–MED | 012 | **DONE** — `npm audit` → **0 vulnerabilidades** |

---

## Ronda 4 — Bloqueantes de producción (2026-09-08, stack: Railway + Cloudflare)

Generados por `improve` (variante `plan`) a partir de `PRODUCCION.md`. Cubren los ítems 🔴
BLOQUEANTE de ese checklist. **Planned against commit `0436315`.** Deploy elegido:
backend + MySQL 8 en **Railway**, frontend en **Cloudflare Pages**.

| Plan | Título | Prioridad | Esfuerzo | Riesgo | Depende de | Estado |
|------|--------|-----------|----------|--------|------------|--------|
| 015 | Configurar el despliegue del backend en Railway (Dockerfile, `railway.json`, `engines`, matriz de env) | P1 | M | LOW | — | **DONE** (2026-09-08) |
| 016 | Verificar y asegurar la compatibilidad con MySQL 8 (Railway) | P1 | M | MED | — | **DONE** (2026-09-08) — 25 migraciones + 188 tests verde en MySQL 8.4.11; `type:'mysql'`; CI → `mysql:8.4` |
| 017 | Mover el logo de empresa a almacenamiento persistente (Railway Volume) | P1 | S | LOW | — | **DONE** (2026-09-08) |
| 018 | Endpoint `/health` + endurecer la CSP | P1 | S | LOW | — | **DONE** (2026-09-08) — hand-rolled (sin `@nestjs/terminus`, v12 es ESM); CSP sin `'unsafe-inline'` en `script-src` |
| 019 | Error reporting con Sentry en el backend | P1 | S | LOW | — | **DONE** (2026-09-09) — `@sentry/nestjs` v10, inerte sin `SENTRY_DSN` |
| 020 | Logging estructurado (pino) + correlation IDs | P1 | M | LOW-MED | — | **DONE** (2026-09-09) — `nestjs-pino` v5; `x-request-id` por petición |
| 021 | Transformer `decimal ↔ number` en las columnas de dinero (D-1/D-4) | P1 | M | MED | — | **TODO** |
| 022 | Fijar zona horaria (app + conexión BD) y blindar el manejo de fechas (DATA-2) | P1 | M | MED | — | **TODO** |

### Ejecución de 016 (2026-09-08, rama `migration/016-mysql8-compat`)

Verificado contra **MySQL 8.4.11** real (zip portable, sin Docker) en el puerto 3307:
- Las **25 migraciones** corren limpio con `type:'mariadb'` Y con `type:'mysql'` — no hubo que
  tocar ninguna. Las 2 con columnas `GENERATED ... STORED` (`obligacion.claveUnicaCanon`,
  `contrato.claveUnicaInmuebleActivo`) ya estaban escritas MySQL-8-aware (`CAST(... AS CHAR)`,
  `CASE WHEN`, sin `DATE_FORMAT`). Idempotentes ("No migrations are pending" en la 2da corrida).
- La **suite de 188 tests** (con `synchronize:true` generando el esquema desde entidades) pasa
  con `type:'mysql'` contra MySQL 8.
- Cambios: `type:'mariadb'` → `type:'mysql'` en `app.module.ts` y `data-source.ts` (+ comentarios);
  `.github/workflows/ci.yml` servicio `mariadb:10.11` → `mysql:8.4` (+ healthcheck `mysqladmin ping`);
  `.env.example` y `README.md` (MariaDB 10.4 → MySQL 8).
- **DEV local ahora necesita MySQL 8** en `localhost:3306` para `npm test` (antes MariaDB de XAMPP).
  El CI ya usa `mysql:8.4`.

### Ejecución de 015 (2026-09-08, rama `deploy/015-railway-backend`)

- **`tsconfig.build.json`** nuevo (`rootDir: src`, `incremental: false`, excluye `test`/specs): `nest build`
  ahora emite `dist/main.js` limpio (antes `dist/src/main.js` — `start:prod` estaba roto sin que nadie
  lo notara) y de forma **determinista** (el `incremental: true` heredado producía `dist/` parciales
  en rebuilds).
- **`Dockerfile`** multi-stage (`node:20-slim`), **`.dockerignore`**, **`railway.json`**
  (`startCommand: "npm run deploy:migrate && node dist/main"`, healthcheck `/api/v1/health`), **`.nvmrc`** = `20`.
- `package.json`: `engines` (`>=20 <21`), script `deploy:migrate` (`typeorm migration:run -d dist/database/data-source.js`
  — CLI sin ts-node, funciona con `--omit=dev`), `dotenv` movido a `dependencies` (lo importa `data-source.ts`).
- `src/main.ts`: `app.listen(port)` → `app.listen(port, '0.0.0.0')` (contenedor).
- README: sección "Despliegue (Railway)" con la matriz completa de variables.
- **No verificado localmente**: `docker build` (no hay Docker en la máquina). Sí verificado: `npm ci`
  + build (determinista, 28 archivos clave), `npm ci --omit=dev` + `node dist/main` (arranca, falla solo
  en conexión BD), `deploy:migrate` (carga el data-source compilado). `npm audit` 0.
- **La suite de tests no se ve afectada** (jest usa `tsconfig.json`; `main.ts` bootstrap no corre en tests).
  El CI (mysql:8.4) lo confirma.
- **Pendiente**: `railway.json` apunta a `/api/v1/health` — ese endpoint es el **plan 018**.

### Ejecución de 017 (2026-09-08, rama `fix/017-logo-volumen`)

- Nuevo `src/common/utils/rutas-archivos.util.ts` (+ spec, 5 casos): `directorioUploads()` lee
  `UPLOADS_DIR` (o `<repo>/uploads`), `directorioLogos()`, `rutaFisicaDesdeUrlPublica()`.
- Consumidores cambiados a la resolución centralizada: `empresa.controller.ts` (`diskStorage`),
  `empresa.service.ts` (unlink del logo anterior), `main.ts` (`useStaticAssets`),
  `pdf-recibo.service.ts` **y `pdf-novedad.service.ts`** (el plan solo listaba recibo — novedad
  también incrusta el logo con el mismo `join(process.cwd(), logoUrl)`).
- `grep "process.cwd()|'./uploads" src/` en los archivos tocados → limpio.
- `.env.example` + README ("Volumen de uploads"): variable `UPLOADS_DIR`.
- **Operativo pendiente**: Railway Volume + `UPLOADS_DIR=/data/uploads`.

### Ejecución de 018 (2026-09-08, rama `feat/018-health-csp`)

- **`@nestjs/terminus` descartado**: la v12 (única compatible con Nest 11) es **ESM puro**
  (`import.meta.url`, `export` en `dist/index.js`) y revienta la suite Jest CJS del repo
  (`ts-jest`, `module: commonjs`) — ni `transformIgnorePatterns` lo salva. Downgrade a v10 = peer
  mismatch con Nest 11. Se hizo **a mano**: `HealthController` inyecta el `DataSource`, hace
  `SELECT 1` con timeout de 3 s (`Promise.race`), responde 200 `{status:'ok',info:{database:{status:'up'}}}`
  o 503 `{status:'error',error:{database:{status:'down'}}}`. Cuerpo con la misma forma que terminus
  (`info`/`error`/`details`) por si un monitor lo parsea. Cero dependencias nuevas de runtime.
- `@Public()` en el handler (lo respetan `JwtAuthGuard` **y** `RolesGuard` vía `IS_PUBLIC_KEY`).
  `AuditInterceptor` no lo toca (no lleva `@AuditAction()`).
- `HealthModule` sin `imports` (el `DataSource` por defecto es inyectable app-wide).
- `src/main.ts`: `script-src` pierde `'unsafe-inline'` (queda solo en `style-src`, para Swagger
  opt-in); + `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`.
- Test: `src/modules/health/health.integration.spec.ts` con **`supertest`** (nuevo devDep, +
  `@types/supertest`) contra `bootstrapTestApp()` — 200 sin token + body shape + no-401/403.
- **Verificado local**: `npm run lint` + `npm run build` limpios. **La suite de integración NO se
  pudo correr en local** (no hay MySQL 8 en `:3306` en esta máquina; el server que estaba se
  apagó a mitad de sesión). Queda a cargo del CI (`mysql:8.4`, corre en el PR).

### Remediación de dependencias — advisories multer/js-yaml (2026-09-09, rama `chore/test-env-local-override`)

El 2026-09-09 GitHub publicó advisories `high` para **`multer` <=2.2.0** (4 CVE de DoS) y **`js-yaml`
3.0.0–3.15.1 / 4.0.0–4.3.1** (DoS por merge keys). El CI del backend (`npm audit --audit-level=high`)
pasó a **rojo para cualquier PR** (destapado por el CI de la PR #9, cuyo diff era solo `jest.setup.ts`).
No lo introdujo ningún plan — son deps transitivas de `@nestjs/platform-express` (multer) y de
`@nestjs/cli`/`ts-jest` (js-yaml, devDeps).

Fix por `overrides` (mismo patrón que BE-014):
- `"multer": "^2.3.0"` — release de seguridad, minor, API compatible. El `fileFilter` de
  `empresa.controller.ts` es **síncrono**, así que la CVE de "race en fileFilter async" no aplicaba.
- `cosmiconfig > js-yaml: "^4.3.2"` y `@istanbuljs/load-nyc-config > js-yaml: "^3.15.2"` — parches
  en la misma línea major, scoped para no romper el consumidor 3.x de istanbul.
- `@nestjs/swagger` usa `js-yaml@5.3.0` (nunca estuvo en rango vulnerable) — sin tocar.

`npm audit` → **0**. `npm ci` + lint + build + `npm test` verde. `multer` sin cobertura de test de
subida real (no hay spec que haga POST de archivo) — build/tipos OK; el humo de logo va en QA-2.

### Ejecución de 019 (2026-09-09, rama `feat/019-sentry-backend`)

- `@sentry/nestjs` **v10.73** (no v8 como asumía el plan). API igual: `instrument.ts` primero,
  `SentryModule.forRoot()`, `SentryGlobalFilter` como `APP_FILTER`.
- `src/instrument.ts`: `Sentry.init` **solo si `SENTRY_DSN`** — inerte en local/test/CI.
  `sendDefaultPii: false`, `tracesSampleRate` = `SENTRY_TRACES_SAMPLE_RATE` (0.1 por defecto).
- `src/main.ts`: `import './instrument';` como primerísima línea (sin regla `import/order` en el
  eslint del repo → no hizo falta `eslint-disable`).
- `src/app.module.ts`: `SentryModule.forRoot()` primero en `imports`; `{provide: APP_FILTER,
  useClass: SentryGlobalFilter}` primero en `providers`.
- **Orden de filtros — verificado leyendo `@nestjs/core@11.1.29`**: los filtros globales se
  evalúan con `getGlobalFilters().concat(scoped).reverse()` + `.find(primer match)`.
  `SentryGlobalFilter` (APP_FILTER) se registra durante el scan; `TypeOrmExceptionFilter` se
  añade después vía `app.useGlobalFilters()` en `main.ts` → tras el `.reverse()` queda **primero**.
  Resultado: `QueryFailedError` → `TypeOrmExceptionFilter` (409/400/503, sin cambio);
  todo lo demás no-`HttpException` → `SentryGlobalFilter` (reporta + 500). Los `HttpException`
  caen en `SentryGlobalFilter` pero su `isExpectedError` los deja pasar sin reportar.
- Sin cobertura de test nueva con valor (el plan lo dice). `npm test` sigue verde (Sentry sin DSN
  no interfiere). `.env.example` + README (tabla Railway) + `PRODUCCION.md` OBS-2.
- **Deferido**: reportar también los 5xx `HttpException` a Sentry (hoy no) — filtro propio si se pide.
- **Operativo pendiente del dueño**: crear el proyecto Sentry backend y setear `SENTRY_DSN` en Railway.

### Ejecución de 020 (2026-09-09, rama `feat/020-logging-pino`)

- `nestjs-pino` **v5.1** + `pino` v10 + `pino-http` v11 (deps) + `pino-pretty` v13 (devDep).
- `app.module.ts`: `LoggerModule.forRoot()` (2º en `imports`, tras `SentryModule`). Nivel vía
  helper `nivelDeLog()`: `LOG_LEVEL` manda; si no `test`→`silent`, `prod`→`info`, resto→`debug`.
  `transport: pino-pretty` **solo** si `NODE_ENV === 'development'` (worker thread; en test/prod =
  JSON crudo — evita la STOP condition del worker en jest). `genReqId` reusa/genera `x-request-id`
  y lo pone en la respuesta. `redact` de `authorization`/`cookie`. `serializers` req/res mínimos.
- `main.ts`: `NestFactory.create(AppModule, { bufferLogs: true })` + `app.useLogger(app.get(Logger))`.
  Los 2 `console.log` del banner de arranque y el `console.warn` de `TRUST_PROXY` → `logger.*`.
- `audit.interceptor.ts`: inyecta `PinoLogger` (`setContext(AuditInterceptor.name)`); el
  `console.error` de "Error al persistir registro" → `this.logger.error({ err }, ...)`.
- El único `new Logger()` restante (`obligaciones.cron.ts`) lo intercepta `app.useLogger` — sin tocar.
  Los `console.log` de `src/database/seeds/*` son scripts CLI — fuera de scope (el criterio del plan
  los excluye). Los `console.log` dentro de STRINGS en `validar-secreto-jwt.util.ts` son texto de
  un mensaje de error, no llamadas — el grep del done-criteria da ese falso positivo.
- Test nuevo: `src/common/http-logging.integration.spec.ts` (2 casos: `x-request-id` generado /
  propagado). `auditoria.integration.spec.ts` sigue verde con el `PinoLogger` inyectado.
  `npm test` → **28 suites / 197 tests verde**, exit 0 en ~2 min (sin hang; un run parcial mostró
  el aviso "did not exit" de jest por el stream stdout de pino — benigno, el run completo cierra
  limpio; si el CI colgara, añadir un flush en `jest.setup-after-env.ts`).

### Orden y dependencias (ronda 4)

- ~~**016**~~ · ~~**015**~~ · ~~**017**~~ · ~~**018**~~ · ~~**019**~~ · ~~**020**~~ **HECHOS.** Sigue: 021 (dinero), 022 (TZ) (+ FE-017).
- **015 + 017 + 018** habilitan el primer deploy a staging (config + logo persistente + healthcheck).
- **019 + 020** dan visibilidad antes de exponer a usuarios.
- **021** bloquea al plan **FE-019** (limpieza del dinero-como-string en el frontend) — desplegar 021
  antes de FE-019.
- **022** es independiente de todos; hacerlo antes de que haya datos reales.
- Todos son independientes entre sí en cuanto a archivos (015→config, 016→`data-source.ts`/migraciones,
  017→`empresa`+`main.ts`, 018→`health`+`main.ts`, 019→`instrument.ts`+`app.module.ts`,
  020→`app.module.ts`+`main.ts`, 021→entidades+services, 022→`obligaciones.service.ts`). Cuidado
  con 017/018/019/020 que tocan todos `main.ts` — mergear de a uno y rebasear.

### Emparejamiento con el frontend

- **015** (backend Railway) ↔ **FE-017** (frontend Cloudflare) — el `CORS_ORIGIN` del backend debe
  ser el dominio de Cloudflare Pages; el `NUXT_PUBLIC_API_BASE_URL` del frontend debe ser el de Railway.
- **018/SEC-2** (CSP backend) ↔ **FE-017** (`_headers` de Cloudflare) — misma tanda de hardening.
- **019** (Sentry backend) ↔ **FE-018** (Sentry frontend).
- **021** (transformer dinero) → **FE-019** (limpieza dinero-como-string) — dependencia dura.

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

**Paso 5 (migración BD real) — HECHO.** `migration:show` sobre `tamara_saenz_db` real
(2026-09-07) confirma las 25 migraciones aplicadas, incluida
`1786930000000-AnulacionDescuentoDeposito` (DEP-REV-01); `migration:run` → "No migrations are
pending".

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

### Ejecución de 013 (2026-09-07, rama `hardening-secretos-arranque`)

**Código (S-1, S-2, S-7):**
- `src/common/utils/validar-secreto-jwt.util.ts` (+ spec, 6 casos) — guardia de arranque:
  `main.ts` aborta si `JWT_ACCESS_SECRET` < 32 chars o contiene un marcador de ejemplo
  (`change_this`/`REEMPLAZAR`/`example`/…). **Es un piso, no un chequeo de entropía**: un secreto
  largo pero predecible (p. ej. el actual `TAMARA_SAENZ_…_2026`, 41 chars) **pasa** la guardia —
  la rotación a un valor aleatorio sigue siendo tarea operativa.
- `main.ts` — Swagger pasa de "encendido salvo `NODE_ENV=production`" a **opt-in explícito
  `SWAGGER_ENABLED=true`** (S-7: el `.env` real tiene `NODE_ENV=development`).
- `seed.ts` — sin fallbacks `?? 'Admin#2026'` / `?? 'Recepcion#2026'`; ahora exige
  `SEED_*_PASSWORD` (≥ 8 chars) o falla.
- `.env.example` — `NODE_ENV=production` + `SWAGGER_ENABLED=false` por defecto; `JWT_ACCESS_SECRET`
  placeholder inequívoco; `SEED_*_PASSWORD` vacías; `JWT_REFRESH_SECRET` eliminado (config muerta,
  nada lo lee); cabecera DB "MySQL 8" → "MariaDB 10.4".
- `.env.test` — `JWT_ACCESS_SECRET` pasa a 64 hex (para que la guardia quede activa también en
  test, opción 2 del plan); `JWT_REFRESH_SECRET` eliminado.
- `README.md` — generación de secretos, `SWAGGER_ENABLED`, sección "Rotación de secretos".
- **Paso 6 (validationSchema de ConfigModule) — omitido** por el propio plan ("sáltalo si añade
  fricción/deps"; `joi` no está y `JWT_ACCESS_SECRET` ya tiene guardia dedicada).

Verificado: lint + build + `npm test` 24 suites / **185 tests** verde.

**PENDIENTE DEL DUEÑO — rotación operativa (fuera del diff, en el `.env` real + BD real):**
1. `JWT_ACCESS_SECRET` → valor aleatorio de ≥ 32 chars
   (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). **Invalida todas
   las sesiones activas** — coordinar ventana de re-login.
2. `NODE_ENV=production`; quitar `SWAGGER_ENABLED` o dejarlo en `false`.
3. Eliminar `JWT_REFRESH_SECRET` del `.env` real (no lo usa nada).
4. Cambiar las contraseñas de `admin@` y `recepcion@` desde `/administracion` (o
   `PATCH /usuarios/:id/password`) si alguna vez se sembraron con `Admin#2026` / `Recepcion#2026`.
5. **Ojo**: con el `.env` real en `NODE_ENV=development`, tras desplegar este cambio el backend
   **sigue arrancando** (el secreto actual tiene 41 chars y pasa la guardia), pero Swagger deja de
   servirse en `/api/v1/docs` salvo que se defina `SWAGGER_ENABLED=true`.

**S-8 — HECHO (2026-09-07).** El código ya defaulteaba a `15m` (`auth.module.ts:23`,
`auth.service.ts:64`); solo faltaba `.env.test` (estaba en `8h` → `15m`) y documentarlo en el
README ("Rotación de secretos"). El `.env` real de producción debe fijar `JWT_ACCESS_EXPIRES_IN=15m`
(tarea operativa del dueño, junto con la rotación de BE-013).

### Ejecución de 014 (2026-09-07, rama `remediacion-deps-be14`)

Baseline: 6 vulnerabilidades (1 crítica `tar`, 2 altas, 3 moderadas). **Resultado: `npm audit` → 0.**

- **`bcrypt` → `bcryptjs`** (Paso 2): elimina el binario nativo y con él `@mapbox/node-pre-gyp` +
  `tar` (la CVE crítica y la alta). `bcryptjs@3` trae sus propios tipos → `@types/bcrypt` eliminado.
  3 imports cambiados (`auth.service.ts`, `usuarios.service.ts`, `seed.ts`). Nuevo spec
  `bcryptjs-compat.spec.ts`: los hashes `$2a$`/`$2b$` ya guardados siguen validando — **sin rehash**.
- **`uuid` directo eliminado** (Paso 3): era dependencia muerta (`grep uuid src/` → 0; el único
  UUID del código es `randomUUID` de `node:crypto`).
- **`overrides` en vez de `npm audit fix`** (Pasos 1 y 3): `npm audit fix` insistía en **degradar
  `exceljs` 4.x → 3.x** (STOP del plan) aun sin `--force`. En su lugar: `overrides` fuerza
  `qs ^6.16.0` (transitiva de express), `fast-uri ^3.1.7` (transitiva devDep de `@nestjs/cli`) y
  `exceljs > uuid ^11.1.1`. `exceljs` se queda en `^4.4.0`.
  - El `uuid` de `exceljs` solo se usa como `v4()` sin `buf` (`cf-rule-ext-xform.js`), así que la
    CVE (bounds check "when `buf` is provided") no era alcanzable; el override es defensa extra.
    `excel-reportes.service.spec.ts` genera y **relee** los .xlsx → cubre que `exceljs` sigue OK
    con `uuid@11`.
- **Paso 4:** `.github/workflows/ci.yml` gana un paso `npm audit --audit-level=high` tras `npm ci`.
- Nota de máquina (no del repo): el `~/.npmrc` global tiene `force=true`. No afecta a este cambio
  (`npm ci` y `npm audit` dan resultados coherentes local y en CI), pero conviene quitarlo.

Verificado: `npm audit` 0 · `npm ci` · lint · build · `npm test` 25 suites / **188 tests** verde.

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
| ~~**S-8** Access token de 8 h~~ | LOW-MED | **HECHO 2026-09-07** — `15m` (ver "Ejecución de 013"). Sigue "no revocable"; la revocación real de access tokens (lista negra / tokens de vida ultracorta + refresh) es otro plan si se pide. |
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
