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

### DB-2 — Almacenamiento del logo de empresa (FS efímero en Railway)
`empresa.controller.ts` guarda el logo en `./uploads/empresa` con `diskStorage`; `main.ts:58` lo
sirve como estático. En Railway ese directorio **se borra en cada redeploy** → el logo desaparece
de la UI y de **todos los PDF de recibo** (`pdf-recibo.service.ts:58`).
- [ ] Opción A: **Railway Volume** montado en `/uploads` (más simple, 1 archivo)
- [ ] Opción B: subir a **Cloudflare R2** / S3 y guardar la URL absoluta en `empresa.logoUrl`
- [ ] Ajustar `pdf-recibo.service.ts` para resolver la ruta física / URL nueva

### DEPLOY-1 — Configuración de plataforma
- [ ] **`railway.json`** (o `railway.toml`) en el backend: comando de build, `startCommand` (`node dist/main`), `healthcheckPath: /health`, `restartPolicyType`
- [ ] **Nixpacks vs Dockerfile** — decidir. Un `Dockerfile` multi-stage da control y reproducibilidad; Nixpacks es cero-config. Recomendado: Dockerfile.
- [ ] **Nitro preset del frontend** para Cloudflare: `NITRO_PRESET=cloudflare-pages` (o `nitro.preset` en `nuxt.config.ts`). Decidir **SSR en Workers vs `ssr: false` + estático** — dado que ya todo el fetch es cliente (P-6), `ssr: false` + Pages estático es el camino limpio y sin sorpresas.
- [ ] **Variables de entorno en producción**:
  - Backend (Railway): `NODE_ENV=production`, `JWT_ACCESS_SECRET` (rotado, ≥32 aleatorio), `JWT_ACCESS_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=1d`, `DB_*` (de la referencia del plugin MySQL), `CORS_ORIGIN=https://<dominio-frontend>`, `TRUST_PROXY=true`, `SEED_*` solo para el primer seed y luego quitar, `TZ=America/Bogota`
  - Frontend (Cloudflare): `NUXT_PUBLIC_API_BASE_URL=https://<backend>.up.railway.app/api/v1`
- [ ] **`engines`** en ambos `package.json` + `.nvmrc` — hoy no hay pin de Node
- [ ] **CORS**: `CORS_ORIGIN` = dominio exacto de Cloudflare Pages (no `*`, no `localhost`)
- [ ] **Dominio propio** + registros DNS en Cloudflare apuntando a Pages (frontend) y CNAME a Railway (backend)

### DB-3 — Backups y restore
- [ ] Confirmar la política de **backup del plugin MySQL de Railway** (frecuencia, retención)
- [ ] **Probar un restore** en un proyecto Railway aparte — un backup no probado no es un backup
- [ ] Documentar el procedimiento de restore en este archivo

### OBS-1 — Health check
- [ ] Endpoint **`/health`** (sin auth) con `@nestjs/terminus`: chequea DB + memoria. Lo consume el healthcheck de Railway y el monitor de uptime.

### OBS-2 — Error reporting
- [ ] **Sentry** (o equivalente) en **backend y frontend**. Sin esto los fallos se descubren por el cajero, no por un dashboard.
- [ ] Filtro de excepciones global en el backend que reporte a Sentry y devuelva un error genérico al cliente (hoy solo existe `TypeOrmExceptionFilter` para errores de BD)

### OBS-3 — Logging estructurado
- [ ] `nestjs-pino` (o `pino`) con salida JSON y niveles. Hoy: logger por defecto de Nest sin formato + un `console.error` suelto en `audit.interceptor.ts:48`.
- [ ] Correlation ID por petición (para rastrear un flujo de pago completo en los logs de Railway)

### OBS-4 — Monitoreo de uptime + alertas
- [ ] UptimeRobot / BetterStack / Cloudflare Health Checks sobre `/health` y `POST /auth/login`
- [ ] Canal de alerta (email / WhatsApp / Telegram) definido

### SEC-1 — Rotación operativa de secretos (BE-013)
- [ ] `JWT_ACCESS_SECRET` real → valor aleatorio (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) — **invalida todas las sesiones**
- [ ] `NODE_ENV=production`, `SWAGGER_ENABLED` ausente, `JWT_REFRESH_SECRET` eliminado del `.env`
- [ ] Contraseñas de `admin@`/`recepcion@` cambiadas desde `/administracion` si se sembraron con valores de ejemplo

### SEC-2 — Cabeceras de seguridad del frontend
- [ ] `nuxt.config.ts` **no tiene ninguna**. En Cloudflare Pages: archivo **`_headers`** o Transform Rules con CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`
- [ ] Revisar la CSP del **backend** (`main.ts:20`): hoy `script-src 'unsafe-inline'` (permisivo). Endurecer ahora que Swagger es opt-in.

### DATA-1 — Dinero como `decimal` → string en el JSON (D-1 / D-4)
El backend serializa los `decimal` de MySQL como **string**; el frontend lo parchea con `Number()`
disperso y uniones `number | string`. Riesgo de bug silencioso de redondeo/coerción en **todo** el
cálculo financiero visible.
- [ ] Transformer TypeORM `decimal ↔ number` centralizado en las columnas de dinero
- [ ] Limpiar los `Number()` y las uniones `number | string` del frontend
- [ ] Tests de que un pago mixto, un excedente y una anulación devuelven `number` en toda la cadena

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
