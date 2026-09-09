# Plan 013: Endurecimiento de secretos JWT, contraseñas semilla y modo de arranque

> **ESTADO: TODO.** Generado por la skill `improve` (auditoría ronda 3, 2026-09-05). Cubre tres
> hallazgos de configuración/seguridad que comparten los mismos archivos (`.env.example`,
> `src/main.ts`, `README.md`, `src/database/seeds/seed.ts`), por lo que se hacen en un solo plan
> para no editar esos archivos tres veces:
>
> - **S-1** — secretos JWT débiles y predecibles en el `.env` real.
> - **S-2** — contraseñas semilla predecibles y publicadas en `.env.example` (commiteado).
> - **S-7** — `NODE_ENV=development` en el `.env` real → Swagger expone el mapa completo de la API sin autenticar.

## Status

- **Priority**: P1 (seguridad; sin decisiones de negocio de por medio)
- **Effort**: S (código pequeño; el grueso es rotación operativa)
- **Risk**: LOW en código; **MED operativo** — rotar `JWT_ACCESS_SECRET` invalida TODAS las
  sesiones activas (todos deben volver a hacer login). Coordinar ventana.
- **Depends on**: plan 012 (ejecutar sobre `main` ya mergeado; si 012 se pospone, ejecutar sobre
  `correccion-hallazgos-auditoria`).
- **Category**: security
- **Planned at**: commit `a9c242c` (rama `correccion-hallazgos-auditoria`), 2026-09-05

## Por qué importa

### S-1 — Secretos JWT adivinables

`JWT_ACCESS_SECRET` en el `.env` real es una cadena legible y predecible (patrón: nombre de la
empresa + palabra genérica de "seguro" + año). Es el único material que firma los access tokens
(`auth.service.ts:63`, `auth.module.ts:22`, `jwt.strategy.ts:18`, todos con `getOrThrow`).
Cualquiera que adivine esa cadena puede **forjar un JWT válido de rol `ADMINISTRADOR`** y operar
todo el motor financiero. El `.env` real NO está en git (bien), pero el patrón es trivial de
adivinar y no hay defensa en el código contra un secreto débil.

`JWT_REFRESH_SECRET` existe en el `.env` y en `.env.example` pero **no lo lee nada** (verificado:
`grep -rn JWT_REFRESH_SECRET src/` → 0 resultados). Los refresh tokens son cadenas opacas
`crypto.randomBytes(48)` hasheadas con SHA-256 (`auth.service.ts:67,81-83`), no JWTs. Es
configuración muerta que confunde sobre "qué secretos importan".

### S-2 — Contraseñas semilla publicadas

`.env.example` (archivo **commiteado**, `git ls-files` lo confirma) contiene
`SEED_ADMIN_PASSWORD` y `SEED_RECEPCION_PASSWORD` con valores formulaicos (`<Rol>#<año>`). El seed
(`seed.ts:59,75`) usa esos valores como *fallback* incluso si el `.env` no los define
(`process.env.SEED_ADMIN_PASSWORD ?? 'Admin#2026'`). Si el despliegue real usó los defaults y
nadie rotó, la cuenta de Administrador tiene una contraseña que está literalmente en el
repositorio.

### S-7 — Swagger expuesto si `NODE_ENV` no es exactamente `production`

`main.ts:81-93`:

```ts
const esProduccion = config.get<string>('NODE_ENV') === 'production';
let swaggerHabilitado = false;
if (!esProduccion) {
  // ... SwaggerModule.setup(`${prefix}/docs`, app, document) ...
  swaggerHabilitado = true;
}
```

El `.env` real tiene `NODE_ENV=development` (`.env:1`). Si el proceso de producción hereda ese
`.env` (no hay documentación de despliegue que diga lo contrario), Swagger UI queda servida en
`/api/docs` **sin pasar por `JwtAuthGuard`/`RolesGuard`** (se sirve fuera del pipeline de Nest,
como dice el propio comentario del código) — expone todas las rutas, DTOs y formas de respuesta a
cualquiera con acceso de red. Además, `NODE_ENV` sin fijar (`undefined`) también cae en la rama
`!esProduccion` → Swagger encendido "por accidente".

## Estado actual

- `.env` real (NO en git): `NODE_ENV=development`, `JWT_ACCESS_SECRET=<cadena predecible>`,
  `JWT_ACCESS_EXPIRES_IN=8h`, `JWT_REFRESH_SECRET=<cadena predecible, no usada>`,
  `JWT_REFRESH_EXPIRES_IN=1d`, `SEED_ADMIN_PASSWORD`/`SEED_RECEPCION_PASSWORD` presentes.
- `.env.example` (EN git): mismas claves; `NODE_ENV=development`; `JWT_ACCESS_SECRET=change_this_access_secret`;
  `JWT_REFRESH_SECRET=change_this_refresh_secret`; `SEED_ADMIN_PASSWORD="Admin#2026"`;
  `SEED_RECEPCION_PASSWORD="Recepcion#2026"`.
- `src/main.ts:12-13` — `async function bootstrap()`; `const config = app.get(ConfigService)` en
  la línea 14; el bloque Swagger en 77-101.
- `src/database/seeds/seed.ts:56-86` — bloque de usuarios iniciales; líneas 59 y 75 con el
  `?? 'Admin#2026'` / `?? 'Recepcion#2026'`.
- `README.md:85-99` — sección "Puesta en marcha" + "Usuarios de prueba (definidos en `.env`)".
- `ConfigModule.forRoot({ isGlobal: true })` en `app.module.ts:29` — sin `validationSchema`.

## Comandos que vas a necesitar

| Propósito | Comando | Éxito esperado |
|---|---|---|
| Instalar | `npm ci` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0, sin errores TS |
| Tests | `npm test` | todos pasan (requiere MariaDB local; usa `.env.test`) |
| Generar un secreto | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | 64 hex chars |

## Alcance

**En alcance:**
- `src/main.ts` — guardia de arranque que rechaza secretos JWT débiles; Swagger tras flag explícito.
- `src/database/seeds/seed.ts` — eliminar los fallbacks de contraseña hardcodeados; exigir la env var.
- `.env.example` — placeholders inequívocos; `NODE_ENV=production` como default seguro; documentar
  `SWAGGER_ENABLED`; quitar `JWT_REFRESH_SECRET`.
- `README.md` — instrucciones de generación de secretos y de rotación; nota sobre `SWAGGER_ENABLED`.
- `test/` — un spec nuevo para la guardia de arranque (opcional pero recomendado, ver Plan de pruebas).
- **Acción operativa (fuera del código, en el checklist de cierre):** rotar los secretos y las
  contraseñas en el `.env` real y en la BD real.

**Fuera de alcance (NO tocar):**
- `JWT_ACCESS_EXPIRES_IN=8h` → acortarlo a 15-30 min es el hallazgo **S-8**, plan aparte. Este
  plan no cambia la duración del token, solo el secreto.
- La lógica de rotación de refresh tokens, detección de reuso (hallazgo S-10) — plan aparte.
- `auth.service.ts`, `auth.module.ts`, `jwt.strategy.ts` — ya usan `getOrThrow`, no se tocan.
- Cualquier cambio a `RolesGuard` o al RBAC.

## Pasos

### Paso 1: Guardia de arranque contra secretos JWT débiles (S-1)

En `src/main.ts`, dentro de `bootstrap()`, **después** de `const config = app.get(ConfigService)`
y **antes** del `app.use(helmet(...))`, añade una validación:

```ts
// Rechaza arrancar con un JWT_ACCESS_SECRET ausente, corto o de la lista de placeholders
// conocidos. Un secreto débil permite forjar tokens de rol ADMINISTRADOR (hallazgo S-1).
const jwtSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
const PLACEHOLDERS_PROHIBIDOS = ['change_this_access_secret', 'change_this_refresh_secret', 'test_secret'];
if (jwtSecret.length < 32 || PLACEHOLDERS_PROHIBIDOS.includes(jwtSecret)) {
  throw new Error(
    'JWT_ACCESS_SECRET inseguro: debe tener al menos 32 caracteres y no ser un valor de ejemplo. ' +
      'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}
```

> El entorno de test (`.env.test`) usa `JWT_ACCESS_SECRET=test_secret` (9 chars). Ese valor
> quedaría rechazado por esta guardia y **rompería `npm test`**. Opciones (elige una y déjala
> documentada en el código):
> 1. Saltar la guardia cuando `NODE_ENV === 'test'`:
>    `if (config.get('NODE_ENV') !== 'test' && (jwtSecret.length < 32 || ...))`.
> 2. Cambiar `.env.test` a un `JWT_ACCESS_SECRET` de ≥32 chars (p. ej. 64 hex) y quitar
>    `'test_secret'` de `PLACEHOLDERS_PROHIBIDOS`. **Esta es la opción preferida** — mantiene la
>    guardia activa también en test y no crea una rama de código solo-para-test.

**Verify**: `npm run build` → exit 0. `npm test` → todos los tests pasan (con la opción 2,
`.env.test` ya tiene un secreto largo). Prueba manual: pon temporalmente
`JWT_ACCESS_SECRET=corto` en un `.env` local y corre `npm run start` → el proceso debe abortar con
el mensaje de error, no arrancar.

### Paso 2: Swagger tras flag explícito (S-7)

En `src/main.ts`, reemplaza la condición de Swagger. En vez de "encendido salvo en producción",
pasa a "apagado salvo opt-in explícito":

```ts
// Swagger expone el esquema completo de la API sin pasar por los guards de Nest (se sirve fuera
// de ese pipeline). Antes se encendía salvo cuando NODE_ENV === 'production' — pero si NODE_ENV
// no se fija (o queda en 'development' en el .env de prod, hallazgo S-7) quedaba expuesto. Ahora
// requiere SWAGGER_ENABLED=true explícito.
const swaggerHabilitado = config.get<string>('SWAGGER_ENABLED') === 'true';
if (swaggerHabilitado) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ERP Inmobiliario - Inversiones Tamara & Saenz S. En C.')
    .setDescription('API de control de recaudo, contratos, inmuebles y novedades operativas.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${prefix}/docs`, app, document);
}
```

Borra la línea `const esProduccion = config.get<string>('NODE_ENV') === 'production';` si ya no se
usa en ningún otro lado de `main.ts` (verifica con `grep -n esProduccion src/main.ts`).

**Verify**: `npm run build` → exit 0. `grep -n "esProduccion\|SWAGGER_ENABLED" src/main.ts` →
solo aparece `SWAGGER_ENABLED`. Prueba manual: con `SWAGGER_ENABLED` sin definir, arranca el
backend y confirma que `GET /api/docs` devuelve 404. Con `SWAGGER_ENABLED=true`, confirma que
carga la UI.

### Paso 3: Seed sin contraseñas hardcodeadas (S-2)

En `src/database/seeds/seed.ts`, líneas 56-86, reemplaza los fallbacks:

```ts
// ANTES:
const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'Admin#2026', 10);
// DESPUÉS:
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword || adminPassword.length < 8) {
  throw new Error('SEED_ADMIN_PASSWORD debe estar definida (>= 8 caracteres) para sembrar el usuario Administrador.');
}
const passwordHash = await bcrypt.hash(adminPassword, 10);
```

Lo mismo para `SEED_RECEPCION_PASSWORD` (línea 75).

**Verify**: `npm run build` → exit 0. Prueba manual: corre `npm run seed` **sin**
`SEED_ADMIN_PASSWORD` en el entorno → debe fallar con el mensaje, no crear el usuario con una
contraseña de ejemplo.

### Paso 4: `.env.example` — placeholders inequívocos y defaults seguros

Edita `.env.example`:

- `NODE_ENV=production` (era `development`) + comentario: `# usa "development" solo en tu máquina local`.
- Añade una línea nueva: `SWAGGER_ENABLED=false   # ponlo en "true" solo en local para ver /api/v1/docs`.
- `JWT_ACCESS_SECRET=REEMPLAZAR_con_openssl_rand_hex_32` (era `change_this_access_secret`).
- **Elimina** la línea `JWT_REFRESH_SECRET=...` por completo (configuración muerta, S-1) y su
  comentario si lo tiene.
- Deja `JWT_REFRESH_EXPIRES_IN=1d` (esa sí se usa).
- `SEED_ADMIN_PASSWORD=` y `SEED_RECEPCION_PASSWORD=` **vacías**, con comentario:
  `# obligatorias para "npm run seed"; define contraseñas fuertes propias, no las reutilices`.
- Actualiza el comentario de encabezado de la sección DB si dice "MySQL 8" (el motor real es
  MariaDB 10.4).

**Verify**: `grep -n "JWT_REFRESH_SECRET" .env.example` → sin resultados.
`grep -n "SWAGGER_ENABLED\|NODE_ENV=production" .env.example` → ambos presentes.

### Paso 5: README — generación y rotación de secretos

En `README.md`, sección "Puesta en marcha" (línea ~85) y "Usuarios de prueba" (línea ~97):

- Tras `cp .env.example .env`, añade un bloque:

  ```markdown
  Genera los secretos JWT (NO uses los de ejemplo):

      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

  Pega el resultado en `JWT_ACCESS_SECRET`. Define `SEED_ADMIN_PASSWORD` y
  `SEED_RECEPCION_PASSWORD` con contraseñas fuertes propias antes de `npm run seed`.
  ```

- Cambia "Swagger: `http://localhost:3010/api/docs`" por:
  "Swagger (solo con `SWAGGER_ENABLED=true`): `http://localhost:3010/api/v1/docs`".
- En "Usuarios de prueba", quita cualquier valor literal de contraseña si lo hubiera; deja solo
  la referencia a las env vars.
- Añade una subsección corta "## Rotación de secretos" explicando que cambiar
  `JWT_ACCESS_SECRET` invalida todas las sesiones activas (todos deben volver a hacer login) y
  que las contraseñas de los usuarios se cambian desde `/administracion` (o
  `PATCH /usuarios/:id/password`), no editando el seed.

**Verify**: `npm run lint` no aplica a `.md`; revisa a ojo que el README compile como Markdown
(sin bloques de código sin cerrar).

### Paso 6: (Opcional, recomendado) validación de entorno con schema

En `app.module.ts`, `ConfigModule.forRoot({ isGlobal: true })` → añade un `validationSchema` con
`class-validator` o `joi` (revisa `package.json`: si `joi` no está, usa una función
`validate` simple en vez de agregar una dependencia). Valida al arrancar que existen
`DB_HOST`, `DB_USERNAME`, `DB_DATABASE`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`,
`JWT_REFRESH_EXPIRES_IN`, `CORS_ORIGIN`. Esto convierte "falta una variable" de un error en
tiempo de request a un error en tiempo de arranque.

> Si esto añade fricción o dependencias nuevas, **sáltalo** — no es el core del plan. Los Pasos
> 1-5 son lo esencial.

**Verify**: `npm run build && npm test` en verde.

### Paso 7: Actualizar `plans/README.md`

Marca la fila del plan 013 como **DONE** con el hash del commit.

## Plan de pruebas

**Test nuevo (recomendado):** `test/arranque-secretos.spec.ts` (o dentro de un spec de
integración existente que ya bootea la app), siguiendo el patrón de los `*.integration.spec.ts`
del repo:

- Caso 1: con `JWT_ACCESS_SECRET` de <32 chars, `bootstrap()` (o la función de validación
  extraída) lanza.
- Caso 2: con `JWT_ACCESS_SECRET` = `'change_this_access_secret'`, lanza.
- Caso 3: con un secreto de 64 hex, no lanza.
- Caso 4: `SWAGGER_ENABLED` sin definir → la ruta `/api/v1/docs` responde 404.
- Caso 5: `SWAGGER_ENABLED=true` → `/api/v1/docs` responde 200.

Para que los casos 1-3 sean testeables, extrae la validación de secreto a una función pura
exportada (p. ej. `validarSecretoJwt(secret: string): void` en `src/common/utils/` o en un
`config.validation.ts`) y llámala desde `main.ts`. Así el test no necesita levantar todo Nest.

**Comando:** `npm test` → todos pasan, incluidos los nuevos.

## Criterios de cierre

TODOS deben cumplirse:

- [ ] `npm run lint && npm run build && npm test` → exit 0.
- [ ] `grep -rn "Admin#2026\|Recepcion#2026" src/` → sin resultados.
- [ ] `grep -rn "JWT_REFRESH_SECRET" .` (excluyendo `node_modules`, `.git`) → sin resultados.
- [ ] `grep -n "SWAGGER_ENABLED" src/main.ts .env.example` → presente en ambos.
- [ ] `grep -n "esProduccion" src/main.ts` → sin resultados (o justificado si se reusa).
- [ ] Con un `.env` de prueba con secreto corto, `npm run start` aborta con mensaje claro.
- [ ] `plans/README.md` actualizado.
- [ ] **(Operativo, checklist de despliegue, NO en el diff):** en el `.env` real —
      `NODE_ENV=production`, `SWAGGER_ENABLED` ausente o `false`, `JWT_ACCESS_SECRET` rotado a un
      valor aleatorio de ≥32 chars, `JWT_REFRESH_SECRET` eliminado. Las contraseñas de `admin@` y
      `recepcion@` en la BD real cambiadas desde `/administracion`. Comunicada la ventana de
      re-login a los usuarios.

## STOP conditions

Detente y reporta si:

- Ajustar la guardia de secretos rompe `npm test` y ninguna de las dos opciones del Paso 1 lo
  resuelve limpiamente.
- Descubres que `NODE_ENV` sí se fija a `production` por otro medio en el despliegue real (variable
  de entorno del proceso, no el `.env`) — entonces S-7 es menos grave; documenta el hallazgo y
  continúa igual (el flag `SWAGGER_ENABLED` sigue siendo la mejora correcta).
- El seed se usa en algún flujo automatizado (CI, script de despliegue) que dependa de los
  fallbacks hardcodeados — verifica `grep -rn "seed" .github/ scripts/` antes de quitarlos; si
  algo depende de ellos, ajústalo en el mismo cambio.
- No tienes acceso al `.env` real ni a la BD real para el checklist operativo — entrégalo al
  dueño con las instrucciones exactas y marca el plan como BLOCKED (código listo, rotación pendiente).

## Notas de mantenimiento

- **Revisor:** confirmar que la guardia de secreto se ejecuta ANTES de cualquier `SwaggerModule`
  o `app.listen`, y que el mensaje de error no imprime el valor del secreto.
- **Seguimiento inmediato recomendado (plan aparte, S-8):** bajar `JWT_ACCESS_EXPIRES_IN` de `8h`
  a `15m`-`30m`. Con la sesión de 1 día (plan 006) y la resiliencia de sesión del frontend (plan
  004 FE), un access token corto no molesta al usuario y reduce la ventana de un token filtrado
  de 8 h a minutos.
- **Seguimiento (S-10):** detección de reuso de refresh token (revocar toda la familia si llega
  un refresh ya revocado) + job de limpieza de filas `refresh_token` revocadas/expiradas.
- Si más adelante se agrega un entorno de staging, `SWAGGER_ENABLED=true` ahí es razonable;
  `NODE_ENV=production` + `SWAGGER_ENABLED=false` en el productivo real.
