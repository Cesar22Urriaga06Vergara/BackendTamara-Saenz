# Plan 018: Endpoint `/health` y endurecimiento de la CSP del backend

> **Executor instructions**: Sigue los pasos, verifica cada uno, respeta las STOP conditions.
> Al terminar actualiza `plans/README.md`.
>
> **Drift check**: `git diff --stat 0436315..HEAD -- src/main.ts src/app.module.ts package.json`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / security
- **Planned at**: commit `0436315`, 2026-09-08

## Why this matters

**`/health`**: Railway usa un healthcheck HTTP para saber si un deploy quedó sano y para reiniciar
el servicio si se cae. El monitor de uptime externo también lo necesita. Hoy **no existe** ningún
endpoint sin auth que confirme "la app arrancó y la BD responde".

**CSP**: `src/main.ts` configura Helmet con `contentSecurityPolicy` pero `script-src` incluye
`'unsafe-inline'`, y el comentario dice que es "para que Swagger UI cargue". Ahora que Swagger es
opt-in (`SWAGGER_ENABLED`, plan 013) y estará **apagado en producción**, la CSP puede endurecerse.

## Estado actual

- `package.json`: **no** tiene `@nestjs/terminus`. Sí tiene `@nestjs/typeorm`, `typeorm`, `mysql2`.
- `src/app.module.ts`: `imports: [ConfigModule.forRoot({isGlobal:true}), TypeOrmModule.forRootAsync({...}), ScheduleModule.forRoot(), AuthModule, EmpresaModule, ...]`. `providers` incluye
  `{ provide: APP_GUARD, useClass: JwtAuthGuard }` (guard global de auth) y `{ provide: APP_GUARD, useClass: RolesGuard }`.
- Hay un decorador `@Public()` (`src/common/decorators/public.decorator.ts`) que exime del
  `JwtAuthGuard` — se usa en `empresa.controller.ts` (`@Public() @Get('publico')`).
- `src/main.ts:16-30`:
  ```ts
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  ```
- `main.ts` fija `setGlobalPrefix('api')` y `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })` → las rutas quedan bajo `/api/v1/...`.
- Prefijo real de la API: `/api/v1`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Instalar la dep | `npm install @nestjs/terminus` | exit 0, aparece en `dependencies` |
| Lint / build | `npm run lint && npm run build` | exit 0 |
| Tests | `npm test` | 188 + los nuevos, verde |
| Probar el endpoint | `npm run start:dev` y `curl -s localhost:3010/api/v1/health` | `{"status":"ok",...}` con la BD levantada |

## Scope

**In scope**:
- `package.json` (dep `@nestjs/terminus`)
- `src/modules/health/health.module.ts` (crear)
- `src/modules/health/health.controller.ts` (crear)
- `src/app.module.ts` (registrar `HealthModule`)
- `src/main.ts` (solo el bloque `helmet`)
- `src/modules/health/health.integration.spec.ts` (crear)
- `PRODUCCION.md`, `plans/README.md`

**Out of scope**:
- Métricas / Prometheus — es otro plan (observabilidad de métricas, no en esta tanda).
- Cualquier otro `main.ts` cambio (trust proxy, cors, etc. — ya están).
- El healthcheck config de `railway.json` — lo pone el plan 015.

## Git workflow

- Branch: `feat/018-health-csp`
- Conventional commits.

## Steps

### Step 1: Instalar `@nestjs/terminus`

```bash
npm install @nestjs/terminus
```

**Verify**: `node -e "process.exit(require('./package.json').dependencies['@nestjs/terminus'] ? 0 : 1)"` → exit 0. `npm ci` sigue funcionando (`npm ci && echo OK`).

### Step 2: Crear el módulo health

`src/modules/health/health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database', { timeout: 3000 })]);
  }
}
```

`src/modules/health/health.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

> **Importante**: el endpoint DEBE llevar `@Public()` para saltar el `JwtAuthGuard` global. Sin
> eso, Railway recibiría un 401 y marcaría el deploy como no sano. Verifica que
> `src/common/decorators/public.decorator.ts` existe y cómo lo consume el `JwtAuthGuard`
> (`grep -rn "IS_PUBLIC\|isPublic\|Public" src/common/guards/jwt-auth.guard.ts`). Si el guard usa
> otro mecanismo (p. ej. `@SkipAuth`), usa ese. Si NO hay ningún mecanismo de exención,
> **STOP y reporta** — no desactives el guard global.

### Step 3: Registrar `HealthModule`

En `src/app.module.ts`, añade `HealthModule` al array `imports` (después de `DashboardModule`) y su
`import` arriba: `import { HealthModule } from './modules/health/health.module';`

**Verify**: `npm run build` → exit 0. `grep -n "HealthModule" src/app.module.ts` → 2 líneas (import + registro).

### Step 4: Endurecer la CSP

En `src/main.ts`, reemplaza el objeto `contentSecurityPolicy.directives` por:
```ts
directives: {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"], // Swagger UI y algunos estilos inline propios
  'img-src': ["'self'", 'data:'],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
},
```
Y actualiza el comentario de arriba: "Swagger (solo con `SWAGGER_ENABLED=true`, apagado en prod)
necesita `'unsafe-inline'` en `style-src`; el `script-src` ya no lo lleva".

> Si al probar Swagger localmente (`SWAGGER_ENABLED=true npm run start:dev`, abrir
> `/api/v1/docs`) la UI queda rota por CSP en la consola del navegador, añade **solo** lo mínimo
> que pida el error (típicamente `'unsafe-inline'` en `style-src` ya cubierto; si pide
> `script-src`, documenta que Swagger requiere aflojarlo y que por eso va apagado en prod).

**Verify**: `grep -n "unsafe-inline" src/main.ts` → aparece solo en `style-src` (1 vez).

### Step 5: Marcar en `PRODUCCION.md`

- `### OBS-1` → `[x]` con "→ plan 018 (hecho)".
- `### SEC-2`, sub-ítem "Revisar la CSP del backend" → `[x]` con "→ plan 018".

## Test plan

Crea `src/modules/health/health.integration.spec.ts`, patrón =
`src/modules/empresa/empresa-autoseed.integration.spec.ts` (usa `bootstrapTestApp()` de
`test/test-app.ts`, hace peticiones HTTP con `supertest` o llama al controller directo):

- `GET /health` con la BD arriba → status 200, body `{ status: 'ok', info: { database: { status: 'up' } } }`.
- `GET /health` es alcanzable **sin token** (no devuelve 401) — este es el caso que importa para Railway.

Si el repo no usa `supertest` en los specs (revisa `test/test-app.ts` y un spec existente), llama
`testApp.app.getHttpServer()` con `supertest` — `@nestjs/terminus` lo trae como transitiva, o
añádelo como devDependency (`npm i -D supertest @types/supertest`) y anótalo.

**Verify**: `npm test` → 188 + los 2 nuevos, verde.

## Done criteria

- [ ] `npm ci && npm run lint && npm run build && npm test` → exit 0, tests verde
- [ ] `curl -s localhost:3010/api/v1/health` (con `npm run start:dev` + BD) → JSON con `"status":"ok"` y sin pedir auth
- [ ] `grep -n "unsafe-inline" src/main.ts` → solo en `style-src`
- [ ] `@nestjs/terminus` en `dependencies` de `package.json`
- [ ] `git status` sin archivos fuera de "In scope"
- [ ] `plans/README.md` fila 018 y `PRODUCCION.md` OBS-1/SEC-2 actualizados

## STOP conditions

- El `JwtAuthGuard` global NO tiene un mecanismo de exención (`@Public()` o equivalente) — no lo
  desactives; reporta.
- Endurecer la CSP rompe algo del frontend real servido por el backend (no debería — el frontend
  es una app aparte en Cloudflare; el backend solo sirve `/api` y `/uploads`).
- `npm test` falla en más de los 2 tests nuevos tras registrar `HealthModule`.

## Maintenance notes

- Revisor: confirmar que `/health` NO expone info sensible (versión, hostname de BD). El default de
  `@nestjs/terminus` con `pingCheck` solo dice `up`/`down` — no lo enriquezcas con datos internos.
- Si se añade Redis / colas más adelante, sumar un indicador al `health.check([...])`.
- Follow-up deferido: un endpoint `/health/ready` vs `/health/live` (readiness vs liveness) si se
  migra a Kubernetes; para Railway con uno basta.
