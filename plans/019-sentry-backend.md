# Plan 019: Error reporting con Sentry en el backend

> **Executor instructions**: Sigue los pasos, verifica cada uno, respeta las STOP conditions.
> Actualiza `plans/README.md` al terminar.
>
> **Drift check**: `git diff --stat 0436315..HEAD -- src/main.ts src/app.module.ts src/common/ package.json`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (pero conviene junto con el plan 020, logging)
- **Category**: dx / security
- **Planned at**: commit `0436315`, 2026-09-08

## Why this matters

Hoy no hay ningún reporte de errores. Un 500 en producción (deadlock no manejado, bug de cálculo,
fallo al persistir un recibo) solo deja rastro en los logs de Railway, que nadie mira
proactivamente — el dueño se entera por el cajero. Sentry captura las excepciones no manejadas con
stack trace, contexto de la petición y el usuario, y alerta. Para un sistema que mueve dinero es el
mínimo de observabilidad.

## Estado actual

- `package.json`: no tiene `@sentry/*`.
- `src/main.ts`: `async function bootstrap()`; `const app = await NestFactory.create(...)`;
  `const config = app.get(ConfigService)`; luego `validarSecretoJwt`, helmet, trust proxy, CORS,
  pipes, Swagger (opt-in), `await app.listen(port)`.
- `src/common/filters/typeorm-exception.filter.ts` — `@Injectable() class TypeOrmExceptionFilter
  implements ExceptionFilter`, registrado global con `app.useGlobalFilters(new TypeOrmExceptionFilter())`
  en `main.ts:56`. Traduce `QueryFailedError` a HttpException; **no** reporta a ningún lado.
- `src/common/interceptors/audit.interceptor.ts:48` — `console.error('[AUDITORIA] Error al persistir registro:', err.message)` — único "reporte" de error hoy.
- No hay `.env.example` entry para Sentry.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Instalar | `npm install @sentry/nestjs @sentry/profiling-node` | exit 0 |
| Lint / build | `npm run lint && npm run build` | exit 0 |
| Tests | `npm test` | 188 verde (Sentry inactivo sin DSN) |

## Scope

**In scope**:
- `package.json`
- `src/instrument.ts` (crear — init de Sentry, se importa PRIMERO)
- `src/main.ts` (import de `./instrument` como primera línea)
- `src/app.module.ts` (registrar `SentryModule.forRoot()` y el filtro global de Sentry)
- `.env.example`
- `README.md` (sección deploy: variable `SENTRY_DSN`), `PRODUCCION.md`, `plans/README.md`

**Out of scope**:
- Frontend Sentry — es el plan FE-018.
- Reemplazar `TypeOrmExceptionFilter` — sigue vivo; Sentry se suma, no lo reemplaza.
- Performance tracing / profiling agresivo — deja `tracesSampleRate` bajo.

## Git workflow

- Branch: `feat/019-sentry-backend`
- Conventional commits.

## Steps

### Step 1: Instalar

```bash
npm install @sentry/nestjs
```

**Verify**: `node -e "process.exit(require('./package.json').dependencies['@sentry/nestjs'] ? 0 : 1)"` → exit 0.

### Step 2: Crear `src/instrument.ts`

```ts
import * as Sentry from '@sentry/nestjs';

// Sentry debe inicializarse ANTES de importar cualquier otro módulo (para instrumentar). Por eso
// este archivo se importa como PRIMERA línea de main.ts. Sin `SENTRY_DSN` no hace nada — seguro
// en local y en test.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    // No enviar PII por defecto; el interceptor de auditoría ya guarda quién hizo qué.
    sendDefaultPii: false,
  });
}
```

### Step 3: Importarlo primero en `main.ts`

La **primera línea** de `src/main.ts`, antes de cualquier otro import:
```ts
import './instrument';
```

**Verify**: `head -1 src/main.ts` → `import './instrument';`

### Step 4: Registrar el módulo y el filtro de Sentry

En `src/app.module.ts`:
- `import { SentryModule } from '@sentry/nestjs/setup';`
- `import { APP_FILTER } from '@nestjs/core';`
- `import { SentryGlobalFilter } from '@sentry/nestjs/setup';`
- En `imports`, añade `SentryModule.forRoot()` como **primer** elemento del array.
- En `providers`, añade **antes** de los guards:
  `{ provide: APP_FILTER, useClass: SentryGlobalFilter },`

> `SentryGlobalFilter` captura y reenvía a Sentry las excepciones que llegan al filtro global, y
> luego re-lanza para que el manejo normal de Nest (y `TypeOrmExceptionFilter`) siga funcionando.
> El orden importa: Sentry primero, luego el resto.
> Verifica en la doc de la versión instalada que el nombre del filtro es `SentryGlobalFilter`
> (`ls node_modules/@sentry/nestjs/build/*/setup* 2>/dev/null` o revisa `node_modules/@sentry/nestjs`).
> Si el API difiere, **STOP y reporta** con el nombre real del export.

**Verify**: `npm run build` → exit 0. `npm test` → 188 verde (sin DSN, Sentry es no-op).

### Step 5: Documentar

- `.env.example`, sección nueva `# ================= OBSERVABILIDAD =================`:
  ```
  # Vacío = desactivado (dev/test). En prod: el DSN del proyecto Sentry.
  SENTRY_DSN=
  SENTRY_TRACES_SAMPLE_RATE=0.1
  ```
- `README.md`, tabla de variables de Railway (plan 015): añade fila `SENTRY_DSN` = *(DSN de Sentry)*.
- `PRODUCCION.md`, `### OBS-2`: marca `[x]` el sub-ítem del backend con "→ plan 019 (hecho)"; deja
  el del frontend para FE-018.

## Test plan

No hay lógica nueva testeable con valor. Verificación:
- `npm test` sigue en 188 (Sentry sin DSN no interfiere).
- Prueba manual (opcional, requiere un DSN de Sentry de prueba): setear `SENTRY_DSN`, arrancar,
  provocar un 500 (p. ej. `GET /api/v1/algo-que-no-existe` no basta — es 404; forzar un throw en
  un endpoint temporal o apagar la BD y pedir algo que la use), y confirmar que el evento llega a
  Sentry con el stack trace.

Añade una nota en el `README` de que un 500 en prod debe aparecer en Sentry — es el criterio de
"funciona".

## Done criteria

- [ ] `head -1 src/main.ts` → `import './instrument';`
- [ ] `npm ci && npm run lint && npm run build && npm test` → exit 0, 188 verde
- [ ] `grep -n "SentryModule\|SentryGlobalFilter" src/app.module.ts` → registrados
- [ ] `.env.example` tiene `SENTRY_DSN`
- [ ] Sin DSN, la app arranca normal (`npm run start:dev` con BD → sin errores de Sentry)
- [ ] `git status` sin archivos fuera de "In scope"
- [ ] `plans/README.md` y `PRODUCCION.md` actualizados

## STOP conditions

- El API de `@sentry/nestjs` de la versión instalada no coincide con los excerpts (`instrument.ts`
  first-import, `SentryModule.forRoot()`, `SentryGlobalFilter`) — reporta con los exports reales.
- Registrar `SentryGlobalFilter` como `APP_FILTER` rompe el `TypeOrmExceptionFilter`
  (algún test de traducción de errores de BD empieza a fallar) — reporta; puede que haya que
  registrar Sentry como filtro que NO consume la excepción.
- `import './instrument'` antes de los demás imports hace que TypeScript/ESLint se queje del orden
  de imports — añade el `eslint-disable-next-line` mínimo con un comentario explicando por qué.

## Maintenance notes

- Revisor: confirmar que `sendDefaultPii: false` y que no se loguean cuerpos de petición con datos
  financieros a Sentry.
- Cuando el plan 020 (pino) entre, integrar el nivel `error` del logger con Sentry (Sentry tiene
  integración de logging) para no duplicar.
- Ajustar `tracesSampleRate` según el plan de Sentry (el free tier tiene cuota de transacciones).
