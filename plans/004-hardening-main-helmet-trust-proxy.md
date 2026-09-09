# Plan 004: Cabeceras de seguridad (Helmet) y `trust proxy` en el bootstrap

> **Executor instructions**: Sigue el plan, verifica cada paso, respeta las STOP
> conditions, actualiza `plans/README.md` al terminar.
>
> **Drift check (primero)**: `git diff --stat 0506b3d..HEAD -- src/main.ts package.json`
> Si `main.ts` cambió, compara contra "Current state"; si no coincide, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `0506b3d`, 2026-09-03

## Why this matters

Dos gaps de hardening en `src/main.ts`:

1. **Sin Helmet / cabeceras de seguridad.** La app no envía `X-Content-Type-Options`,
   `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy` ni CSP. `/uploads/` se
   sirve como estático **sin autenticación** (el logo de la empresa) — sin `X-Content-Type-Options: nosniff`
   un archivo malicioso servido desde ahí podría interpretarse como HTML/JS. Hoy está mitigado
   porque la subida de logo valida MIME + magic bytes y rechaza SVG, pero la defensa en
   profundidad falta.
2. **Sin `trust proxy`.** El interceptor de auditoría registra `req.ip` como IP de origen de
   cada acción. Detrás de cualquier reverse-proxy (nginx, Traefik, un load balancer, Cloudflare),
   `req.ip` es la IP **del proxy**, no la del cliente real — la traza de auditoría queda
   inservible para investigar "quién hizo qué desde dónde", que es justo su propósito.

El coste es bajo (una dependencia + ~4 líneas) y no cambia ningún comportamiento funcional.

## Current state

### `src/main.ts` (completo)

```typescript
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { SanitizarHtmlPipe } from './common/pipes/sanitizar-html.pipe';
import { TypeOrmExceptionFilter } from './common/filters/typeorm-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.useGlobalFilters(new TypeOrmExceptionFilter());

  const prefix = config.get<string>('API_PREFIX', 'api');
  app.setGlobalPrefix(prefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new SanitizarHtmlPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3001'),
    credentials: true,
  });

  // ... Swagger (solo fuera de producción) ...

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  // ... console.log ...
}
void bootstrap();
```

### `src/common/interceptors/audit.interceptor.ts` (fragmento — el consumidor de `req.ip`)

```typescript
    const registrar = (accion: string) => {
      // ...
      this.auditoriaService.registrar({
        // ...
        ipOrigen: req.ip,
      })
    };
```

### `package.json` — `helmet` **no está** en dependencies (confirmado).

### Repo conventions to follow

- La app es `NestExpressApplication` (`main.ts:12`), así que `app.use(...)` y
  `app.set(...)` de Express están disponibles directamente.
- Config vía `ConfigService` con defaults: `config.get<T>('CLAVE', valorPorDefecto)` — ver
  `API_PREFIX`, `CORS_ORIGIN`, `PORT` en el mismo archivo. **Toda config nueva sigue este patrón**
  (env var + default), nunca hardcode.
- `.env.example` documenta todas las variables (con comentarios de sección `# ===== X =====`).
- Comentarios que explican el porqué.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Instalar dep | `npm install helmet` | exit 0; `helmet` aparece en `package.json` dependencies |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |
| Tests | `npm test` | verde, exit 0 |
| Arranque manual | `npm run start:dev` | log `Nest application successfully started`; luego `curl -sI http://localhost:3000/api/v1/empresa/publico` muestra `x-content-type-options: nosniff` |

> `npm install helmet` **sí** modifica `package.json` y `package-lock.json` — es una excepción
> permitida para este plan (es el objetivo). No ejecutes ningún otro comando que mute el árbol.
> `npm test` necesita MariaDB en `localhost:3306`.

## Suggested executor toolkit

- Skill `nestjs-best-practices` en `.claude/skills/nestjs-best-practices/` — `rules/security-sanitize-output.md`
  tiene el ejemplo de setup de Helmet con CSP.

## Scope

**In scope**:
- `package.json` / `package-lock.json` (solo por `npm install helmet`)
- `src/main.ts`
- `.env.example` (documentar la nueva variable `TRUST_PROXY`)

**Out of scope**:
- `nuxt.config.ts` del frontend — las cabeceras del lado Nuxt van en un plan separado del repo
  de frontend.
- Mover `/uploads/` detrás de un guard — evaluado y descartado en el README del backend (rompe
  `<img src>` sin ganar seguridad real; solo hay logos con nombre `randomUUID`). NO lo hagas.
- Cambiar el interceptor de auditoría — solo se beneficia de `trust proxy`, no cambia.
- CSP estricta con `directives` afinadas — para una API JSON el `contentSecurityPolicy` por
  defecto de Helmet puede romper Swagger UI. Ver Step 2 para el ajuste mínimo.

## Git workflow

- Rama: `advisor/004-hardening-main`.
- Un commit: `BE-7/BE-8: Helmet y trust proxy en el bootstrap`.

## Steps

### Step 1: Instalar Helmet

```
npm install helmet
```

**Verify**: `grep '"helmet"' package.json` → 1 coincidencia en `dependencies`.

### Step 2: Aplicar Helmet en `main.ts`

- Importar: `import helmet from 'helmet';`
- Justo **después** de `const config = app.get(ConfigService);` y **antes** de
  `app.useStaticAssets(...)`, añadir:

```typescript
  // Cabeceras de seguridad (nosniff, frameguard, HSTS, referrer-policy, etc.). La CSP se
  // relaja lo justo para que Swagger UI (solo fuera de producción) siga cargando su bundle.
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
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // el logo en /uploads lo consume el frontend en otro origen
    }),
  );
```

> `crossOriginResourcePolicy: cross-origin` es necesario porque el frontend (otro origen) carga
> el logo desde `/uploads/`. Sin esto, el default `same-origin` de Helmet bloquea la imagen.

**Verify**: `npm run build` → exit 0.

### Step 3: `trust proxy` configurable

- Después del bloque de Helmet, añadir:

```typescript
  // Detrás de un reverse-proxy (nginx, LB, Cloudflare), Express necesita saber cuántos saltos
  // de proxy confiar para que `req.ip` sea la IP real del cliente y no la del proxy — clave
  // para que la traza de auditoría (`ipOrigen`) sirva. Valor por env: número de saltos, o
  // "false" para deshabilitar (default en desarrollo local, sin proxy).
  const trustProxy = config.get<string>('TRUST_PROXY', 'false');
  app.set('trust proxy', trustProxy === 'false' ? false : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
```

**Verify**: `npm run build` → exit 0. `npm run lint` → exit 0.

### Step 4: Documentar la variable en `.env.example`

Añadir una sección (junto a las otras `# ===== X =====`):

```
# ===== PROXY / RED =====
# Nº de saltos de reverse-proxy a confiar para resolver la IP real del cliente
# (req.ip, usado en la auditoría). "false" = sin proxy (desarrollo local). En prod
# detrás de un LB/nginx suele ser "1".
TRUST_PROXY=false
```

**Verify**: `grep TRUST_PROXY .env.example` → 1 coincidencia.

### Step 5: Verificación en caliente

```
npm run start:dev
```

Esperar el log `Nest application successfully started`. En otra terminal:

```
curl -sI http://localhost:3000/api/v1/empresa/publico | grep -i "x-content-type-options\|x-frame-options\|content-security-policy"
```

**Verify**: la respuesta incluye `x-content-type-options: nosniff` y `content-security-policy: ...`.
Detener el server (Ctrl+C).

### Step 6: Suite completa

**Verify**: `npm test` → exit 0, sin regresiones. (Los tests de integración usan
`@nestjs/testing`, que **no** ejecuta `bootstrap()` — así que Helmet no afecta a los tests; solo
se confirma que nada se rompió.)

## Test plan

- **No hay tests unitarios nuevos.** `bootstrap()` no se testea en este repo (los specs usan
  `bootstrapTestApp()` que arma el módulo sin `main.ts`). La verificación de las cabeceras es el
  `curl` manual del Step 5.
- Regresión: `npm test` completo sigue en verde.

## Done criteria

- [ ] `npm install helmet` hecho; `helmet` en `package.json` dependencies
- [ ] `npm run build` exit 0
- [ ] `npm run lint` exit 0
- [ ] `npm test` exit 0 (sin regresiones)
- [ ] `grep -n "helmet(" src/main.ts` → 1 coincidencia
- [ ] `grep -n "trust proxy" src/main.ts` → 1 coincidencia
- [ ] `grep TRUST_PROXY .env.example` → 1 coincidencia
- [ ] Step 5: `curl -sI` muestra `x-content-type-options: nosniff`
- [ ] `git status --porcelain` sin archivos fuera del scope (salvo `package-lock.json`)
- [ ] Fila en `plans/README.md` actualizada

## STOP conditions

- `main.ts` no coincide con "Current state".
- Tras aplicar Helmet, Swagger UI (`http://localhost:3000/api/v1/docs` con `NODE_ENV` != production)
  deja de cargar (errores de CSP en la consola del navegador) — relajar `script-src`/`style-src`
  lo mínimo y documentarlo; si no se resuelve en un intento, reportar.
- El frontend deja de mostrar el logo de la empresa tras el cambio (problema de
  `crossOriginResourcePolicy`) — reportar.
- `npm test` no arranca por falta de MariaDB.

## Maintenance notes

- **Reviewer**: verificar que `TRUST_PROXY` tiene default `false` (no rompe desarrollo local) y
  que la CSP no está tan abierta como para ser inútil (`'unsafe-eval'` NO debe aparecer).
- **Despliegue**: en producción, quien despliegue debe poner `TRUST_PROXY=1` (o el nº de saltos
  real) en el `.env` de producción. Anotarlo en el runbook de despliegue.
- **Interacción futura**: si el frontend pasa a servirse desde el mismo origen que la API (mismo
  dominio + path), se puede endurecer `crossOriginResourcePolicy` a `same-origin` y afinar CORS.
- **Diferido**: CSP con nonce/hash por request (en vez de `'unsafe-inline'`) — solo tiene sentido
  si la API llega a servir HTML, que hoy no hace.
