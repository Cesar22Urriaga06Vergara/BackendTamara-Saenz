# Camino a producción — Inversiones Tamara & Saenz

> Estado a 2026-09-08. Sistema **nunca desplegado** (solo local/dev). Ronda 3 tanda 1 de
> correcciones en `main` (CI verde, `npm audit` 0 en backend, hardening de secretos a nivel código).
> Este archivo es la fuente de verdad del despliegue — actualízalo a medida que cierres ítems.

## Stack de despliegue elegido

| Pieza | Plataforma | Notas |
|---|---|---|
| Backend (NestJS) | **Railway** (servicio) | Auto-deploy desde `main`. TLS en el edge de Railway. |
| Base de datos | **Railway** (plugin MySQL) | ⚠️ Railway da **MySQL 8**, el código está tipado como **MariaDB 10.4** — ver bloqueante DB-1. |
| Frontend (Nuxt) | **Cloudflare Pages** | Auto-deploy desde `main`. DNS + CDN + SSL + WAF de Cloudflare. |
| Archivos subidos (logo empresa) | ⚠️ pendiente | Hoy es disco local; Railway tiene FS efímero — ver bloqueante DB-2. |

Railway/Cloudflare **ya resuelven**: hosting, SSL/TLS, DNS, CDN, gestión de variables de entorno,
y CI/CD de despliegue (deploy en cada push a `main`). Lo que sigue es lo que **no** resuelven.

---

## ✅ Ya resuelto (a nivel código)

CI verde en ambos repos · `npm audit` 0 (backend) · rate-limit en `/auth/login` (5/min) ·
CORS por env (no wildcard) · Helmet · `ValidationPipe` global (whitelist + forbidNonWhitelisted) ·
JWT + RolesGuard · `synchronize:false` gateado por env · 25 migraciones aplicadas en la BD local ·
cron diario de cánones · trazabilidad de auditoría persistida · guardia de arranque de secreto JWT ·
`SWAGGER_ENABLED` opt-in · seed sin contraseñas publicadas · `TRUST_PROXY` configurable.

---

## 🔴 BLOQUEANTE — no se puede ir a producción sin esto

### DB-1 — Compatibilidad MariaDB → MySQL 8 (Railway) — ✅ HECHO (plan BE-016, 2026-09-08)
- [x] Verificado contra **MySQL 8.4.11** real: las **25 migraciones** corren limpio (incluidas las
  2 con columnas `GENERATED STORED`), son idempotentes, y la **suite de 188 tests** pasa (con
  `synchronize:true` generando el esquema desde entidades).
- [x] `type: 'mariadb'` → **`type: 'mysql'`** en `app.module.ts` y `data-source.ts` (re-verificado).
- [x] CI (`.github/workflows/ci.yml`) cambiado de `mariadb:10.11` a `mysql:8.4`.
- [ ] Verificar el `date` de `obligacion.periodo` / "día calendario" en producción — cubierto por el **plan 022** (zona horaria).

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
- [ ] **Frontend Cloudflare** — Nitro preset + `_headers` + env + `engines` → **plan FE-017**.
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

### OBS-2 — Error reporting — 🟡 backend HECHO (plan 019), falta frontend (FE-018)
- [x] **Sentry backend** (`@sentry/nestjs`): `src/instrument.ts` (init gateado por `SENTRY_DSN`,
  primer import de `main.ts`), `SentryModule.forRoot()` + `SentryGlobalFilter` (`APP_FILTER`).
  Sin DSN es inerte. **Operativo**: crear el proyecto Sentry y setear `SENTRY_DSN` en Railway.
- [ ] **Sentry frontend** → plan FE-018.
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
- [ ] `nuxt.config.ts` **no tiene ninguna**. En Cloudflare Pages: archivo **`_headers`** o Transform Rules con CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`
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

### DATA-2 — Zona horaria del servidor
`esVencida()` usa `new Date()` de JS; la query usa `CURDATE()`. Según la TZ del contenedor de
Railway (UTC por defecto), "vencido hoy" puede desfasarse un día → afecta cartera, mora y
generación de canon.
- [ ] Fijar `TZ=America/Bogota` en las variables de Railway
- [ ] Pasada por todo el manejo de fechas + tests con TZ forzada (UTC y Bogotá) que prueben el límite de medianoche

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

- [ ] **FE-014** — deps vulnerables del frontend + regenerar `package-lock.json` (bloqueado por `force=true` en `~/.npmrc` local → `npm config delete force`)
- [ ] **`npm audit` en el CI del frontend** + **secret scanning** (gitleaks) en ambos CI
- [ ] **S-10** — job que limpie `refresh_token` revocados/expirados (la tabla crece sin límite) + detección de reuso de refresh token
- [ ] **P-4** — índices compuestos (`obligacion(estado,fechaVencimiento)`, `recibo_caja.creadoEn`, `movimiento(medioPago,tipo,esReverso)`) — `EXPLAIN` primero, luego migración
- [ ] **Política de contraseñas** — hoy solo `@MinLength(8)` (`cambiar-password.dto.ts:5`, `create-usuario.dto.ts:7`). Para un sistema con dinero: exigir mayúscula+número, y/o bloqueo tras N intentos fallidos
- [ ] **Accesibilidad** — pasada WCAG AA (navegación por teclado del cajero, contraste, foco en modales, errores asociados a campos). Sin auditar hoy.
- [ ] **Rate-limit global** en el backend (no solo login)
- [ ] **Pool de conexiones** de TypeORM dimensionado (`extra.connectionLimit`) según el plan de Railway
- [ ] **S-12** — `.gitignore` `**/*.md` demasiado amplio saca `AGENTS.md` y specs de negocio de git

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

1. **DB-1** (compat MySQL 8) — todo lo demás depende de saber si la BD funciona
2. **DEPLOY-1** + **DB-2** + **OBS-1** (`/health`) — poder desplegar algo a staging
3. **OBS-2/3/4** (Sentry, logs, uptime) + **SEC-1/2** — desplegar con visibilidad y seguro
4. **DATA-1** (dinero) + **DATA-2** (TZ) — integridad financiera
5. **QA-1/2/3** — validar en staging
6. **DB-3** (restore probado) + **DEPLOY-2** (rollback) — red de seguridad
7. Go-live con monitoreo activo la primera semana
