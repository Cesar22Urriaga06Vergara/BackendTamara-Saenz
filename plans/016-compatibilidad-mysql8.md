# Plan 016: Verificar y asegurar la compatibilidad con MySQL 8 (Railway)

> **Executor instructions**: Sigue el plan paso a paso. Corre cada verificación. Si ocurre algo
> de "STOP conditions", detente y reporta. Este plan tiene un Paso 1 de investigación cuyo
> resultado decide el resto — léelo entero antes de empezar. Al terminar, actualiza `plans/README.md`.
>
> **Drift check**: `git diff --stat 0436315..HEAD -- src/app.module.ts src/database/`
> Si cambió algo, compara contra los excerpts de "Estado actual".

## Status

- **Priority**: P1 (bloquea todo el despliegue — si la BD no funciona, nada funciona)
- **Effort**: M
- **Risk**: MED (toca la config de conexión y potencialmente 2 migraciones con columnas generadas)
- **Depends on**: none. Bloquea al plan 015 (deploy real) en la práctica.
- **Category**: migration
- **Planned at**: commit `0436315`, 2026-09-08

## Why this matters

El código declara la base de datos como **MariaDB** (`type: 'mariadb'`) y hay **2 migraciones con
columnas `GENERATED ALWAYS AS (...) STORED`** más 1 columna generada en una entidad. El propio
código (`app.module.ts:34-39`) documenta que MariaDB y MySQL generan SQL distinto para columnas
generadas y que mezclar el dialecto rompe `synchronize`/migraciones. Railway solo ofrece
**MySQL 8**. Si el dialecto y la sintaxis de las columnas generadas no son compatibles, las
migraciones fallarán en el primer deploy y el sistema no arranca. Este plan **verifica** contra un
MySQL 8 real y **corrige** lo mínimo necesario.

## Estado actual

- `src/app.module.ts:40` → `type: 'mariadb'` en la config de `TypeOrmModule.forRootAsync`.
- `src/database/data-source.ts:13` → `type: 'mariadb'` (el data-source que usan las migraciones).
  Comentario en :12: "el servidor real es MariaDB, no MySQL".
- `.env.test`: `DB_*` apuntan a `tamara_saenz_db_test`, `DB_SYNCHRONIZE=true`.
- `.github/workflows/ci.yml`: servicio `mariadb:10.11`.
- **Columnas generadas STORED**:
  - `src/modules/contratos/entities/contrato.entity.ts:107-108` — `asExpression: "CASE WHEN \`estado\` = 'ACTIVO' THEN \`inmuebleId\` ELSE NULL END"`, `generatedType: 'STORED'`.
  - `src/database/migrations/1786800000000-IndiceUnicoCanonPorPeriodo.ts:28-30` — SQL crudo
    `... GENERATED ALWAYS AS ( ... ) STORED` (clave única de canon por período).
  - `src/database/migrations/1786860000000-IndiceUnicoContratoActivoPorInmueble.ts:23-25` — idem
    (contrato activo único por inmueble).
  - `src/modules/obligaciones/entities/obligacion.entity.ts:94` — comentario: "MySQL prohíbe
    DATE_FORMAT() dentro de GENERATED ALWAYS AS (lo considera no determinista)".
- Las 25 migraciones se corren con `npm run migration:run`.
- 188 tests, corren con `npm test` contra la BD de `.env.test`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Levantar MySQL 8 local | `docker run --name mysql8-tamara -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -e MYSQL_DATABASE=tamara_saenz_db_test -p 3307:3306 -d mysql:8.4` | contenedor `Up` |
| Correr migraciones contra MySQL 8 | (ver Paso 2) | "has been executed successfully" x25, sin errores de sintaxis |
| Tests contra MySQL 8 | (ver Paso 3) | 188 verde |
| Lint / build | `npm run lint && npm run build` | exit 0 |
| Limpiar | `docker rm -f mysql8-tamara` | |

## Scope

**In scope**:
- `src/app.module.ts` (solo la línea `type:`)
- `src/database/data-source.ts` (solo la línea `type:`)
- `src/database/migrations/1786800000000-IndiceUnicoCanonPorPeriodo.ts` (solo si Paso 2 falla ahí)
- `src/database/migrations/1786860000000-IndiceUnicoContratoActivoPorInmueble.ts` (idem)
- `src/modules/contratos/entities/contrato.entity.ts` (solo la columna generada, si rompe)
- `.github/workflows/ci.yml` (cambiar el servicio a `mysql:8.4` si se decide migrar de dialecto)
- `.env.example` (actualizar el comentario de la cabecera DB)
- `PRODUCCION.md`, `plans/README.md`

**Out of scope**:
- Cualquier lógica de negocio, servicios, DTOs.
- Reescribir migraciones que ya funcionan — solo se tocan las 2 de columnas generadas y **solo si
  fallan** contra MySQL 8.
- El `docker-compose` de desarrollo (si existe) — no está en este alcance.

## Git workflow

- Branch: `migration/016-mysql8-compat`
- Un commit por cambio lógico. Estilo conventional commits.

## Steps

### Step 1: Levantar MySQL 8 y correr las migraciones tal cual (dialecto `mariadb`)

```bash
docker run --name mysql8-tamara -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -e MYSQL_DATABASE=tamara_saenz_db_test -p 3307:3306 -d mysql:8.4
# esperar ~20s a que arranque
```

Crea un archivo temporal `.env.mysql8` (NO lo commitees; añádelo a `.gitignore` local o bórralo
después) copiando `.env.test` y cambiando:
```
DB_PORT=3307
DB_SYNCHRONIZE=false
```

Corre las migraciones apuntando a ese entorno:
```bash
node -r dotenv/config ./node_modules/typeorm/cli.js migration:run -d src/database/data-source.ts dotenv_config_path=.env.mysql8 2>&1 | tee /tmp/mig-mysql8.log
```
> Si ese invoker no funciona en este repo, usa: copia `.env.mysql8` a `.env` temporalmente
> (respaldando el `.env` real si existe), corre `npm run migration:run`, y restaura el `.env`.

**Verify**: las 25 migraciones reportan "has been executed successfully" y NO hay
`ER_PARSE_ERROR` / `You have an error in your SQL syntax` / `ER_NOT_SUPPORTED_YET`.

- **Si todas pasan** → las migraciones ya son compatibles con MySQL 8. Salta al Paso 4 (solo hay
  que alinear el `type:` del dialecto). Registra en el commit message que las 25 corrieron limpio.
- **Si alguna falla con error de sintaxis en una columna generada** (migración `1786800000000` o
  `1786860000000`) → ve al Paso 2.
- **Si falla por otra razón** (FK, charset, `sql_mode`) → **STOP y reporta** el error exacto y la
  migración; puede necesitar decisión de diseño.

### Step 2: (solo si el Paso 1 falló en una columna generada) Ajustar la sintaxis

Abre la migración que falló. El patrón MariaDB vs MySQL 8 para columnas generadas STORED:
- MySQL 8 **exige** que la expresión sea determinista y acepta el modificador `NOT NULL`/`NULL`
  después de `STORED`.
- MariaDB rechaza ese modificador.

Ajusta el SQL de la columna generada para que sea válido en **MySQL 8** (el objetivo de deploy).
Ejemplo de forma esperada (adáptalo a la expresión real de la migración):
```sql
ALTER TABLE `obligacion`
  ADD COLUMN `claveUnicaCanon` VARCHAR(64)
  GENERATED ALWAYS AS (
    CASE WHEN `tipo` = 'CANON'
      THEN CONCAT(`contratoId`, ':', DATE_FORMAT(`periodo`, '%Y-%m'))
    END
  ) STORED,
  ADD UNIQUE INDEX `UQ_obligacion_clave_canon` (`claveUnicaCanon`);
```
> Si la expresión usa `DATE_FORMAT` y MySQL 8 la rechaza por "no determinista" (`ERROR 3763`),
> reemplázala por `CONCAT(YEAR(\`periodo\`), '-', LPAD(MONTH(\`periodo\`), 2, '0'))` que sí es
> determinista. Mantén el `down()` de la migración simétrico.

Vuelve a correr el Paso 1 completo (recrea el contenedor: `docker rm -f mysql8-tamara` y de nuevo).

**Verify**: las 25 migraciones corren limpio contra MySQL 8.

### Step 3: Correr la suite de tests contra MySQL 8

Los tests usan `.env.test` con `DB_SYNCHRONIZE=true` (esquema desde entidades, no migraciones).
Levanta un MySQL 8 en el puerto que espera `.env.test` (3306) o ajusta temporalmente `DB_PORT`:

```bash
docker rm -f mysql8-tamara
docker run --name mysql8-tamara -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -e MYSQL_DATABASE=tamara_saenz_db_test -p 3306:3306 -d mysql:8.4
# esperar ~20s
npm test 2>&1 | tail -20
```

**Verify**: `Test Suites: 25 passed`, `Tests: 188 passed`. Presta atención a:
- Tests de `contratos` (columna generada de contrato activo).
- Tests de `obligaciones-canon` (clave única de canon).
- Cualquier fallo nuevo con `ER_` = incompatibilidad real → analízalo antes de seguir.

Si `synchronize:true` de TypeORM contra MySQL 8 con `type:'mariadb'` genera SQL inválido para la
columna generada de `contrato.entity.ts:107`, cambia primero el `type:` (Paso 4) y re-corre.

### Step 4: Alinear el dialecto

Decide según los Pasos 1-3:

- **Si todo pasó con `type: 'mariadb'` contra MySQL 8** (TypeORM/mysql2 a veces son tolerantes):
  puedes dejar `type: 'mariadb'`, pero es frágil. **Recomendado igual**: cambiar a `type: 'mysql'`
  ya que el destino real es MySQL 8, y re-verificar Pasos 1 y 3.
- **Si hubo que ajustar sintaxis / el dialecto importó**: cambia a `type: 'mysql'`.

Cambios (si se decide `mysql`):
- `src/app.module.ts:40` → `type: 'mysql',` y actualiza el comentario de :34-39 para reflejar
  "el servidor real es MySQL 8 (Railway)".
- `src/database/data-source.ts:13` → `type: 'mysql',` y su comentario :12.
- `.github/workflows/ci.yml` → cambia el servicio `mariadb:10.11` por `mysql:8.4` y su
  `MARIADB_*` env por `MYSQL_ALLOW_EMPTY_PASSWORD: "yes"` + `MYSQL_DATABASE: tamara_saenz_db_test`.
  El `--health-cmd` de mariadb (`healthcheck.sh --connect`) hay que cambiarlo por
  `mysqladmin ping -h 127.0.0.1` o `mysql -h 127.0.0.1 -e 'SELECT 1'`.
- `.env.example` → cambia el comentario `# DATABASE (MariaDB 10.4 ...)` por `# DATABASE (MySQL 8 — Railway)`.

**Verify tras el cambio**:
- `npm run lint && npm run build` → exit 0
- Paso 1 (migraciones contra MySQL 8) → 25 limpio
- Paso 3 (tests contra MySQL 8) → 188 verde

### Step 5: Limpieza y documentación

- `docker rm -f mysql8-tamara`
- Borra `.env.mysql8` y restaura cualquier `.env` que hayas movido.
- En `PRODUCCION.md`, sección `### DB-1`: marca los 3 sub-ítems `[x]` con "→ plan 016 (hecho)" y
  añade una línea con el resultado: "MySQL 8 verificado con 25 migraciones + 188 tests el <fecha>;
  dialecto = `<mysql|mariadb>`".
- Actualiza `plans/README.md`.

## Test plan

No hay tests nuevos que escribir — la suite existente (188) **es** la prueba de compatibilidad,
corrida contra un MySQL 8 real (Paso 3). El valor de este plan es esa corrida.

Opcional (recomendado): añade al `README.md` una nota de que el CI ahora corre contra MySQL 8
(si se cambió el servicio en `ci.yml`), para que nadie asuma MariaDB.

## Done criteria

TODAS:

- [ ] Las 25 migraciones corren sin error de sintaxis contra `mysql:8.4` (log guardado o pegado en el PR)
- [ ] `npm test` → 25 suites / 188 tests verde contra `mysql:8.4`
- [ ] `npm run lint && npm run build` → exit 0
- [ ] `src/app.module.ts` y `src/database/data-source.ts` tienen el **mismo** valor de `type:`
- [ ] Si se cambió el dialecto: `ci.yml` usa `mysql:8.4` y su healthcheck; el CI de `main` queda verde
- [ ] `git status` sin archivos fuera de "In scope"; `.env.mysql8` NO commiteado
- [ ] `PRODUCCION.md` DB-1 marcado; `plans/README.md` fila 016 actualizada

## STOP conditions

Detente y reporta si:

- Una migración distinta de `1786800000000` / `1786860000000` falla contra MySQL 8 (FK, charset,
  `ONLY_FULL_GROUP_BY`, `sql_mode` estricto) — puede requerir decisión de diseño.
- Ajustar una columna generada para MySQL 8 obliga a cambiar su semántica (no solo sintaxis) —
  p. ej. la expresión de unicidad tendría que calcular algo distinto.
- Tras cambiar a `type: 'mysql'`, fallan tests que antes pasaban y el motivo NO es trivial de
  arreglar (más de 2 tests, o toca lógica).
- El drift check muestra que `app.module.ts` o `data-source.ts` ya no tienen `type: 'mariadb'`
  (alguien ya lo tocó) — reconcilia antes de seguir.

## Maintenance notes

- Para el revisor del PR: el foco es (a) el log de las 25 migraciones contra MySQL 8, (b) que
  `app.module.ts` y `data-source.ts` coincidan, (c) que el CI quede verde con el servicio nuevo.
- Si en el futuro se vuelve a MariaDB (otro proveedor), hay que revisar las columnas generadas otra vez.
- `obligacion.entity.ts:94` ya tiene un comentario sobre `DATE_FORMAT` no determinista en MySQL —
  si la migración de clave de canon lo usaba, el fix del Paso 2 debe dejar consistente el comentario.
- Follow-up deferido: un `docker-compose.yml` de desarrollo con `mysql:8.4` para que dev y prod
  usen el mismo motor (hoy dev/CI usan MariaDB).
