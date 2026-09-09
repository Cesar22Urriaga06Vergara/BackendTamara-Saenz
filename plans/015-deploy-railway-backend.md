# Plan 015: Configurar el despliegue del backend en Railway

> **Executor instructions**: Sigue el plan paso a paso. Corre cada comando de verificación y
> confirma el resultado esperado antes de continuar. Si ocurre algo de "STOP conditions", detente
> y reporta — no improvises. Al terminar, actualiza la fila de este plan en `plans/README.md`.
>
> **Drift check (córrelo primero)**:
> `git diff --stat 0436315..HEAD -- package.json tsconfig.json src/main.ts .env.example`
> Si algún archivo en alcance cambió desde este plan, compara los excerpts de "Estado actual"
> contra el código vivo antes de seguir; si no coinciden, es una STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (archivos nuevos; no toca lógica)
- **Depends on**: none (pero el deploy real no funcionará hasta que 016 confirme MySQL 8 y 017 resuelva el logo)
- **Category**: dx / migration
- **Planned at**: commit `0436315`, 2026-09-08

## Why this matters

El sistema nunca se ha desplegado y no hay ningún archivo de configuración de plataforma. El dueño
eligió **Railway** para el backend + su plugin de **MySQL 8**. Sin un `Dockerfile` reproducible,
un `railway.json` con healthcheck, un pin de versión de Node y una lista clara de variables de
entorno de producción, el primer deploy es a ciegas y no repetible. Este plan deja el backend
**listo para conectar a Railway** (el operador hace el `railway link` / conexión del repo aparte).

## Estado actual

- `package.json` (raíz): scripts `build` = `nest build`, `start:prod` = `node dist/main`,
  `migration:run` = `typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts`,
  `seed` = `ts-node src/database/seeds/seed.ts`. **No hay campo `engines`.**
- `tsconfig.json`: `"outDir": "./dist"`. `nest build` produce `dist/main.js`.
- `src/main.ts`: `const port = config.get<number>('PORT', 3010); await app.listen(port);`
  (línea ~95). Railway inyecta `PORT` automáticamente — el código ya lo respeta, **pero
  `app.listen(port)` sin host escucha en `::` (todas las interfaces) por defecto en Express, que
  es lo correcto para Railway.** No hay que cambiar main.ts para esto.
- `.env.example`: ya tiene `NODE_ENV`, `PORT`, `API_PREFIX`, `CORS_ORIGIN`, `SWAGGER_ENABLED`,
  `DB_HOST/PORT/USERNAME/PASSWORD/DATABASE/SYNCHRONIZE/LOGGING`, `JWT_ACCESS_SECRET`,
  `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `TRUST_PROXY`, `EMPRESA_*`,
  `HORIZONTE_MESES_CANON`, `SEED_*`.
- `.github/workflows/ci.yml`: usa `node-version: '20'`. Los tests corren contra un servicio
  `mariadb:10.11`.
- No hay `Dockerfile`, `.dockerignore`, `railway.json`, `railway.toml` ni `nixpacks.toml`.
- Migraciones: 25 archivos en `src/database/migrations/`. Se corren con `npm run migration:run`
  (necesita `ts-node` → devDependency; ver Paso 4 sobre cómo correrlas en Railway).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Instalar | `npm ci` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0, genera `dist/main.js` |
| Tests | `npm test` | 188 tests verde (requiere MySQL/MariaDB local en `localhost:3306`, base `tamara_saenz_db_test`; el CI usa un servicio `mariadb:10.11`) |
| Probar la imagen Docker | `docker build -t tamara-be . && docker run --rm -e JWT_ACCESS_SECRET=$(node -e "console.log('x'.repeat(40))") -e DB_HOST=x -e DB_PORT=3306 -e DB_USERNAME=x -e DB_PASSWORD=x -e DB_DATABASE=x -p 3010:3010 tamara-be` | el contenedor arranca hasta el intento de conexión a BD (fallará ahí — es esperado sin BD) |

## Scope

**In scope** (los únicos archivos a crear/modificar):
- `Dockerfile` (crear)
- `.dockerignore` (crear)
- `railway.json` (crear)
- `.nvmrc` (crear)
- `package.json` (añadir `engines` y el script `deploy:migrate`)
- `README.md` (añadir sección "Despliegue")
- `PRODUCCION.md` (marcar DEPLOY-1 backend como hecho)
- `plans/README.md` (fila de estado)

**Out of scope** (NO tocar):
- `src/main.ts` — el manejo de `PORT` ya es correcto. Endurecer la CSP es el **plan 018**.
- `src/app.module.ts` / `data-source.ts` — el cambio `type: 'mariadb'` → `'mysql'` es el **plan 016**.
- `src/modules/empresa/*` — el logo en volumen es el **plan 017**.
- `.github/workflows/ci.yml` — el CI de tests no cambia por esto.
- Cualquier valor real de secreto. Este plan solo documenta **nombres** de variables.

## Git workflow

- Branch: `deploy/015-railway-backend`
- Commits estilo conventional commits (ver `git log --oneline -5`, p. ej. `chore: ...`, `feat: ...`).
- NO hagas push ni abras PR salvo que el operador lo pida.

## Steps

### Step 1: Crear el `Dockerfile` multi-stage

Crea `Dockerfile` en la raíz:

```dockerfile
# ---- build ----
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Las migraciones y el data-source se compilan a dist/ por nest build; se corren con el
# script deploy:migrate (ver Paso 4). ts-node NO está en la imagen de runtime.
COPY --from=build /app/src/database/migrations ./dist/src/database/migrations
EXPOSE 3010
CMD ["node", "dist/main"]
```

> **Nota sobre las migraciones**: `npm run migration:run` usa `typeorm-ts-node-commonjs` (ts-node),
> que es devDependency y NO está en la imagen de runtime. El Paso 4 añade un script que corre las
> migraciones ya compiladas con el CLI de `typeorm` sobre JS. Si `nest build` NO emite
> `dist/src/database/data-source.js` (verifícalo en el Paso 3), es una STOP condition — hay que
> ajustar `tsconfig.build.json` para incluir `src/database`.

**Verify**: `docker build -t tamara-be .` → termina con `naming to docker.io/library/tamara-be`.

### Step 2: Crear `.dockerignore`

```
node_modules
dist
.git
.github
coverage
*.md
!README.md
plans
advisor-plans
uploads
Claude outputs
.env
.env.*
!.env.example
.claude
.agents
```

**Verify**: `cat .dockerignore` muestra el contenido de arriba.

### Step 3: Verificar qué emite `nest build` y ajustar si falta el data-source

```bash
npm run build
ls dist/main.js dist/src/database/data-source.js dist/src/database/migrations/ 2>&1
```

**Verify**: los tres existen. Si `dist/src/database/data-source.js` **no** existe:
- Abre `nest-cli.json` y `tsconfig.build.json`. Si `tsconfig.build.json` excluye `src/database`
  o `nest-cli.json` tiene `"sourceRoot"` que lo deja fuera, ajústalo para incluir
  `src/database/**/*`. Vuelve a `npm run build` y re-verifica.
- Si tras un intento razonable el data-source sigue sin compilarse, **STOP y reporta**.

### Step 4: Añadir `engines`, `.nvmrc` y el script de migración de producción

En `package.json`, añade (después de `"version"`):

```json
"engines": {
  "node": ">=20 <21"
},
```

Y en `"scripts"`, añade:

```json
"deploy:migrate": "typeorm migration:run -d dist/src/database/data-source.js",
```

> `typeorm` (el CLI, sin ts-node) SÍ queda disponible: es un bin de la dependencia `typeorm`
> que está en `dependencies` (no devDependencies). Verifícalo: `grep '"typeorm"' package.json`
> debe mostrarlo bajo `dependencies`.

Crea `.nvmrc` en la raíz con una sola línea:

```
20
```

**Verify**:
- `node -e "const p=require('./package.json'); if(!p.engines?.node) process.exit(1); if(!p.scripts['deploy:migrate']) process.exit(1)"` → exit 0
- `cat .nvmrc` → `20`
- `node -e "const p=require('./package.json'); process.exit(p.dependencies.typeorm ? 0 : 1)"` → exit 0

### Step 5: Crear `railway.json`

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "node dist/main",
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

> `healthcheckPath` apunta a `/api/v1/health` porque `main.ts` fija `setGlobalPrefix('api')` +
> `enableVersioning({ defaultVersion: '1' })`. El endpoint lo crea el **plan 018** — hasta que
> exista, Railway reportará el healthcheck como fallido. Si el operador despliega este plan antes
> del 018, debe quitar temporalmente las líneas `healthcheck*` del `railway.json`.

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('railway.json','utf8'))"` → exit 0.

### Step 6: Documentar el despliegue en el README

En `README.md`, añade una sección `## Despliegue (Railway)` con este contenido (ajusta redacción,
mantén los nombres de variable exactos):

```markdown
## Despliegue (Railway)

El backend se despliega en Railway como servicio Docker (ver `Dockerfile` y `railway.json`),
con el plugin **MySQL** de Railway como base de datos.

### Variables de entorno del servicio (Railway → Variables)

| Variable | Valor | Nota |
|---|---|---|
| `NODE_ENV` | `production` | |
| `PORT` | *(lo inyecta Railway)* | no la definas a mano |
| `API_PREFIX` | `api` | |
| `TZ` | `America/Bogota` | crítico para cartera/mora (ver plan 022) |
| `TRUST_PROXY` | `true` | Railway está detrás de proxy |
| `CORS_ORIGIN` | `https://<dominio-del-frontend>` | dominio exacto de Cloudflare Pages, sin barra final |
| `SWAGGER_ENABLED` | *(no definir)* | Swagger apagado en prod |
| `JWT_ACCESS_SECRET` | *(64 hex aleatorio)* | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | `1d` | |
| `DB_HOST` | `${{MySQL.MYSQLHOST}}` | referencia al plugin MySQL |
| `DB_PORT` | `${{MySQL.MYSQLPORT}}` | |
| `DB_USERNAME` | `${{MySQL.MYSQLUSER}}` | |
| `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` | |
| `DB_DATABASE` | `${{MySQL.MYSQLDATABASE}}` | |
| `DB_SYNCHRONIZE` | `false` | producción usa migraciones |
| `DB_LOGGING` | `false` | |
| `EMPRESA_NOMBRE` / `EMPRESA_NIT` / `EMPRESA_SLOGAN` | *(datos reales de la empresa)* | solo se usan en el primer seed |
| `HORIZONTE_MESES_CANON` | `3` | |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | *(email real + contraseña fuerte)* | **quitar tras el primer `npm run seed`** |
| `SEED_RECEPCION_EMAIL` / `SEED_RECEPCION_PASSWORD` | *(idem)* | idem |

### Primer despliegue

1. Conectar el repo a Railway, seleccionar `Dockerfile` como builder.
2. Añadir el plugin MySQL. Confirmar que es **MySQL 8** (ver plan 016 sobre compatibilidad).
3. Cargar las variables de arriba.
4. Primer deploy. En el shell del servicio (Railway → el servicio → "Deploy" → shell), correr:
   `npm run deploy:migrate` y luego `node dist/... ` — o mejor, correr el seed una sola vez:
   `node -e "require('./dist/src/database/seeds/seed.js')"` (verificar que `seed.js` se compila;
   si no, correr el seed desde una máquina con el repo apuntando `DB_*` a la BD de Railway).
5. Quitar las variables `SEED_*_PASSWORD`.
6. Verificar `GET https://<servicio>.up.railway.app/api/v1/health` → 200 (requiere plan 018).

### Migraciones en cada deploy

Railway no corre migraciones solo. Opciones:
- Añadir `npm run deploy:migrate && node dist/main` como `startCommand` (simple, pero corre en
  cada arranque — es idempotente, TypeORM salta las ya aplicadas).
- O un "pre-deploy command" en Railway: `npm run deploy:migrate`.
Elegir uno y dejarlo documentado aquí.
```

**Verify**: `grep -c "America/Bogota\|CORS_ORIGIN\|deploy:migrate" README.md` → ≥ 3.

### Step 7: Marcar el ítem en `PRODUCCION.md`

En `PRODUCCION.md`, en la sección `### DEPLOY-1`, marca los sub-ítems que este plan cubre
(`railway.json`, Nixpacks vs Dockerfile → Dockerfile, `engines`/`.nvmrc`, matriz de variables) con
`[x]` y añade "→ plan 015 (hecho)". No marques los del frontend ni el Nitro preset (son del plan
FE-017).

**Verify**: `grep -c "plan 015" PRODUCCION.md` → ≥ 1.

## Test plan

No hay lógica nueva, así que no hay tests unitarios nuevos. La "prueba" es:

- `npm run build` → exit 0, `dist/main.js` existe.
- `npm test` → sigue en 188 verde (este plan no toca `src/`).
- `docker build -t tamara-be .` → build exitoso.
- `docker run` de la imagen (ver "Commands you will need") arranca el proceso Node y llega hasta
  el intento de conexión a BD (falla ahí sin BD — es lo esperado; lo que se valida es que el
  contenedor no revienta antes, p. ej. por falta de un archivo).

## Done criteria

TODAS deben cumplirse:

- [ ] `docker build -t tamara-be .` termina exitoso
- [ ] `npm run build && ls dist/main.js dist/src/database/data-source.js` → los dos existen
- [ ] `node -e "const p=require('./package.json'); process.exit(p.engines?.node && p.scripts['deploy:migrate'] ? 0 : 1)"` → exit 0
- [ ] `node -e "JSON.parse(require('fs').readFileSync('railway.json','utf8'))"` → exit 0
- [ ] `cat .nvmrc` → `20`
- [ ] `npm test` → 188 tests verde (sin cambios respecto a antes)
- [ ] `git status` no muestra archivos modificados fuera de la lista "In scope"
- [ ] `plans/README.md` fila 015 actualizada

## STOP conditions

Detente y reporta si:

- `nest build` no emite `dist/src/database/data-source.js` ni `dist/src/database/migrations/*.js`
  tras un ajuste razonable de `tsconfig.build.json` — el executor de migraciones en prod depende de esto.
- `typeorm` (el CLI) NO está en `dependencies` de `package.json` — el script `deploy:migrate` no
  funcionará en la imagen sin devDependencies.
- `src/main.ts` línea de `app.listen` ya NO es `app.listen(port)` sino que fija un host distinto
  de `0.0.0.0`/`::` — reporta, porque Railway necesita que escuche en todas las interfaces.
- El drift check muestra cambios en `package.json` o `tsconfig.json` que contradicen los excerpts.

## Maintenance notes

- Para quien mantenga esto: si se añade una dependencia nativa (con build step), la imagen
  `node:20-slim` puede necesitar `build-essential` / `python3` en el stage de build.
- El `startCommand` con migración inline es lo más simple pero acopla arranque y migración; si el
  volumen de datos crece y una migración tarda, conviene moverlo a un pre-deploy command.
- Cuando el plan 018 añada `/health`, quitar el workaround del `healthcheckPath` si se aplicó.
- Cuando el plan 016 confirme el dialecto de BD, revisar que `data-source.ts` y `app.module.ts`
  coincidan (`type`).
- Follow-up deferido: build de la imagen en CI (hoy el CI solo testea). Se puede añadir un job que
  haga `docker build` para detectar Dockerfiles rotos antes del deploy.
