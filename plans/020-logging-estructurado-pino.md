# Plan 020: Logging estructurado (pino) + correlation IDs

> **Executor instructions**: Sigue los pasos, verifica cada uno, respeta las STOP conditions.
> Actualiza `plans/README.md` al terminar.
>
> **Drift check**: `git diff --stat 0436315..HEAD -- src/main.ts src/app.module.ts src/common/ package.json`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED (cambia el logger global; hay que verificar que nada dependa del formato actual)
- **Depends on**: none (idealmente después del 019)
- **Category**: dx
- **Planned at**: commit `0436315`, 2026-09-08

## Why this matters

El backend usa el logger por defecto de Nest (texto plano, sin correlación) y tiene un
`console.error` suelto en `src/common/interceptors/audit.interceptor.ts:48`. En Railway los logs
son la única ventana a lo que pasa. Sin **JSON estructurado** no se pueden filtrar/buscar, y sin
un **correlation ID por petición** es imposible seguir un flujo de pago completo (login → simular →
registrar → PDF) a través de varias líneas de log. `nestjs-pino` da ambas cosas y es el estándar
en NestJS.

## Estado actual

- `package.json`: no tiene `pino`, `nestjs-pino`, `pino-http`, `pino-pretty`.
- `src/main.ts`: `NestFactory.create<NestExpressApplication>(AppModule)` sin opción `{ logger }`.
  No hay `app.useLogger(...)`.
- `src/app.module.ts`: imports empiezan con `ConfigModule.forRoot({isGlobal:true})`.
- `src/common/interceptors/audit.interceptor.ts:48`: `console.error('[AUDITORIA] Error al persistir registro:', err.message);`
- Otros usos de `Logger` de Nest: `grep -rn "new Logger\|private.*logger\|Logger(" src/ --include=*.ts | grep -v spec` →
  al menos `src/modules/obligaciones/obligaciones.cron.ts:8` (`private readonly logger = new Logger(ObligacionesCron.name)`).
  Revisa la lista completa antes de empezar.
- `TRUST_PROXY` ya se configura en `main.ts` (para `req.ip` real detrás de proxy).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Instalar | `npm install nestjs-pino pino-http` y `npm install -D pino-pretty` | exit 0 |
| Lint / build | `npm run lint && npm run build` | exit 0 |
| Tests | `npm test` | 188 verde |
| Ver logs en dev | `npm run start:dev` | líneas legibles con `pino-pretty` |

## Scope

**In scope**:
- `package.json`
- `src/app.module.ts` (registrar `LoggerModule.forRoot(...)`)
- `src/main.ts` (`app.useLogger(app.get(Logger))` + `bufferLogs: true`)
- `src/common/interceptors/audit.interceptor.ts` (cambiar el `console.error` por el logger inyectado)
- `.env.example` (`LOG_LEVEL`)
- `README.md`, `PRODUCCION.md`, `plans/README.md`

**Out of scope**:
- Reescribir todos los `new Logger()` existentes — siguen funcionando (nestjs-pino los intercepta
  cuando se hace `app.useLogger`). Solo se toca el `console.error` del audit interceptor.
- Enviar logs a un servicio externo (Logtail, Datadog) — Railway ya captura stdout; eso es follow-up.
- Métricas.

## Git workflow

- Branch: `feat/020-logging-pino`
- Conventional commits.

## Steps

### Step 1: Instalar

```bash
npm install nestjs-pino pino-http
npm install -D pino-pretty
```

**Verify**: `node -e "const p=require('./package.json'); process.exit(p.dependencies['nestjs-pino'] && p.devDependencies['pino-pretty'] ? 0 : 1)"` → exit 0.

### Step 2: Registrar `LoggerModule` en `app.module.ts`

Como **primer** import del array (antes de `ConfigModule` o justo después — pino necesita
`ConfigModule` si lee env por `ConfigService`, pero puede leer `process.env` directo):

```ts
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';

// ...dentro de imports: []
LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    // Correlation ID: usa el header entrante si viene de un proxy, si no genera uno.
    genReqId: (req, res) => {
      const existing = req.headers['x-request-id'];
      const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    // En prod: JSON a stdout (Railway lo captura). En dev: pino-pretty legible.
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : { target: 'pino-pretty', options: { singleLine: true } },
    // No loguear los cuerpos; sí método, url, status, tiempo, reqId.
    autoLogging: true,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  },
}),
```

**Verify**: `npm run build` → exit 0.

### Step 3: Usar el logger de pino como logger de Nest

En `src/main.ts`:
- En `NestFactory.create(AppModule, { bufferLogs: true })` (añade `bufferLogs: true`).
- Justo después de `const app = await NestFactory.create(...)`:
  ```ts
  app.useLogger(app.get(Logger)); // Logger de nestjs-pino
  ```
  con `import { Logger } from 'nestjs-pino';`

**Verify**: `grep -n "bufferLogs\|useLogger\|nestjs-pino" src/main.ts` → las 3 cosas presentes.

### Step 4: Cambiar el `console.error` del audit interceptor

En `src/common/interceptors/audit.interceptor.ts`:
- Inyecta el logger en el constructor: si la clase ya tiene constructor, añade
  `private readonly logger: Logger` (de `nestjs-pino`) o usa `@InjectPinoLogger` según el patrón;
  lo más simple: `import { PinoLogger } from 'nestjs-pino';` y `constructor(..., private readonly logger: PinoLogger) {}`,
  luego `this.logger.setContext('AuditInterceptor')`.
- Reemplaza `console.error('[AUDITORIA] Error al persistir registro:', err.message);` por
  `this.logger.error({ err }, 'Error al persistir registro de auditoría');`

> Si `AuditInterceptor` se instancia manualmente (con `new AuditInterceptor(...)`) en vez de por
> DI, la inyección del logger no funciona. Revisa cómo se registra
> (`grep -rn "AuditInterceptor" src/`). En `app.module.ts` está como
> `{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }` → es DI, la inyección funciona. Si
> encuentras un `new AuditInterceptor` en algún test, ese test necesitará pasar un mock del logger.

**Verify**: `grep -n "console.error\|console.log" src/common/interceptors/audit.interceptor.ts` → sin resultados.

### Step 5: Documentar

- `.env.example`, sección OBSERVABILIDAD: `LOG_LEVEL=info   # debug|info|warn|error — en prod: info`.
- `README.md`, tabla de variables de Railway: fila `LOG_LEVEL` = `info`.
- `PRODUCCION.md`, `### OBS-3`: marca `[x]` con "→ plan 020 (hecho)".

## Test plan

- `npm test` → 188 verde. Si algún spec de `AuditInterceptor` falla por el logger inyectado,
  ajústalo para pasar un `PinoLogger` mock (`{ error: jest.fn(), setContext: jest.fn() }`).
- Opcional: un test que verifique que una petición devuelve el header `x-request-id`
  (patrón: cualquier `*.integration.spec.ts` que haga una petición HTTP).
- Prueba manual: `npm run start:dev` → los logs salen legibles (pino-pretty). Setear
  `NODE_ENV=production LOG_LEVEL=info` y arrancar → los logs salen como JSON de una línea.

## Done criteria

- [ ] `npm ci && npm run lint && npm run build && npm test` → exit 0, 188 verde
- [ ] `grep -rn "console\.(log|error|warn)" src/ --include=*.ts | grep -v spec | grep -v "seeds/"` → sin resultados (los seeds pueden quedar con console.log — son scripts)
- [ ] `npm run start:dev` con `NODE_ENV=production` → una línea de log es JSON parseable con un campo `reqId`
- [ ] Una respuesta HTTP incluye el header `x-request-id`
- [ ] `git status` sin archivos fuera de "In scope"
- [ ] `plans/README.md` y `PRODUCCION.md` actualizados

## STOP conditions

- `app.useLogger(app.get(Logger))` lanza en el arranque (el `Logger` de nestjs-pino no está
  disponible en el contexto) — revisa que `LoggerModule.forRoot` esté en `imports` de `AppModule`.
- Más de 3 specs fallan tras el cambio y el motivo no es solo "pasar un mock del logger".
- El transport `pino-pretty` en dev hace que el proceso no arranque (worker thread) — usa
  `transport: undefined` siempre y documenta que en dev los logs salen como JSON.
- Encuentras `console.log` con datos financieros que hoy se usan para depurar en prod — reporta
  antes de borrarlos por si alguien depende de ellos.

## Maintenance notes

- Revisor: confirmar `redact` de `authorization`/`cookie` y que no se loguean bodies.
- El `x-request-id` debería propagarse del frontend → backend en el futuro (el frontend genera uno
  por operación) para trazar una acción de punta a punta; hoy el backend lo genera si no viene.
- Integrar con Sentry (plan 019): los `logger.error` importantes deberían crear breadcrumbs/eventos.
- Follow-up: enviar logs a un servicio con retención (Railway los rota) si se necesita auditoría de logs.
