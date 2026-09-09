# Plan 014: Remediación de dependencias vulnerables del backend

> **ESTADO: TODO.** Generado por la skill `improve` (auditoría ronda 3, 2026-09-05). Primer
> `npm audit` que se corre sobre este repo — las auditorías previas lo declararon "NO
> DETERMINADO". Empareja con el plan **014 del frontend** (misma higiene de dependencias);
> conviene desplegar los dos juntos.

## Status

- **Priority**: P1 (1 vulnerabilidad crítica en la ruta de instalación)
- **Effort**: S-M (`npm audit fix` es trivial; la migración `bcrypt`→`bcryptjs` es M, con tests)
- **Risk**: LOW-MED — cambiar la librería de hashing de contraseñas toca autenticación; mitigado
  porque `bcryptjs` produce/verifica hashes bcrypt idénticos (los hashes ya guardados en BD
  siguen siendo válidos).
- **Depends on**: plan 012 (ejecutar sobre `main`). Independiente de los planes 013.
- **Category**: security / dependencies
- **Planned at**: commit `a9c242c` (rama `correccion-hallazgos-auditoria`), 2026-09-05

## Por qué importa

`npm audit` (2026-09-05) reporta **6 vulnerabilidades** (1 crítica, 2 altas, 3 moderadas):

| Paquete | Sev | Vía | Ruta | Fix |
|---|---|---|---|---|
| `tar` ≤7.5.20 | **crítica** | `bcrypt@5.1.1` → `@mapbox/node-pre-gyp@1.0.11` → `tar@6.2.1` | instalación / build | migrar `bcrypt`→`bcryptjs` (Paso 2) |
| `@mapbox/node-pre-gyp` ≤1.0.11 | alta | `bcrypt@5.1.1` | instalación / build | ídem |
| `fast-uri` 3.0.0-3.1.5 | alta (ReDoS) | `@nestjs/cli` → `@angular-devkit/core` → `ajv@8.18.0` → `fast-uri@3.1.5` | **devDependency** (build) | `npm audit fix` |
| `qs` 2.2.5-6.15.3 | moderada (DoS) | `@nestjs/platform-express` → `express@5.2.1` → `qs@6.15.3` | runtime | `npm audit fix` |
| `exceljs` ≥3.5.0 | moderada | dependencia directa | genera reportes .xlsx (`excel-reportes.service.ts`) | `overrides` sobre su `uuid` nested (Paso 3) |
| `uuid` <11.1.1 | moderada | dependencia directa **no usada** + nested en `exceljs` | — | quitar la directa (Paso 3) |

**Ruta crítica (`tar`):** `bcrypt` compila un binario nativo y usa `@mapbox/node-pre-gyp` +
`tar` en tiempo de `npm install` para descargar/extraer el prebuilt. `tar ≤7.5.20` tiene varias
CVE de path traversal / escritura arbitraria de archivos vía symlink/hardlink durante la
extracción. No es alcanzable desde el runtime de la API, pero **sí** es una superficie de
supply-chain durante `npm ci` (en tu máquina y en el runner de CI).

**`uuid` directo no se usa:** `grep -rn "uuid" src/` → el único uso de UUID en el código es
`randomUUID` de `node:crypto` (`empresa.controller.ts:7`). El `"uuid": "^9.0.1"` de
`package.json` es una dependencia muerta que además arrastra un advisory.

`npm ci` corre hoy con el warning `npm warn using --force` porque el `~/.npmrc` del usuario tiene
`force=true` — eso desactiva protecciones de `npm audit`/instalación. Fuera del alcance de este
plan (es config de máquina), pero anótalo: idealmente `force=true` no debería estar en el
`.npmrc` global.

## Estado actual

- `package.json` dependencias relevantes:
  - `"bcrypt": "^5.1.1"` → instalado `bcrypt@5.1.1`.
  - `"exceljs": "^4.4.0"`, `"uuid": "^9.0.1"` (directas).
  - `"@nestjs/cli": "^11.0.0"` (devDependency).
- **No hay campo `overrides`** en `package.json` (`grep -n overrides package.json` → vacío).
- Uso de `bcrypt` (verificado): `auth.service.ts:6,26` (`bcrypt.compare`), `usuarios.service.ts:4,23,95`
  (`bcrypt.hash`), `seed.ts:2,59,75` (`bcrypt.hash`). Solo `hash` y `compare` async. Sin
  `genSaltSync`/`hashSync`/`compareSync`.
- `@types/bcrypt` en devDependencies.
- Tests que ejercitan el hashing: `auth-login.integration.spec.ts`, `usuarios.integration.spec.ts`.

## Comandos que vas a necesitar

| Propósito | Comando | Éxito esperado |
|---|---|---|
| Auditar | `npm audit` | ver la lista de vulnerabilidades |
| Auditar (JSON) | `npm audit --json` | para comparar antes/después |
| Fix no destructivo | `npm audit fix` | actualiza dentro de rangos semver |
| Instalar | `npm ci` | exit 0 |
| Lint / build / test | `npm run lint && npm run build && npm test` | exit 0 (tests requieren MariaDB local) |
| Ver árbol de un paquete | `npm ls <paquete>` | confirma la ruta de dependencia |

## Alcance

**En alcance:**
- `package.json` + `package-lock.json`: `npm audit fix` (qs, fast-uri); quitar `uuid` directo;
  `overrides` para el `uuid` de `exceljs` si sigue apareciendo; reemplazar `bcrypt` por `bcryptjs`.
- `src/modules/auth/auth.service.ts`, `src/modules/usuarios/usuarios.service.ts`,
  `src/database/seeds/seed.ts`: cambiar el import de `bcrypt` a `bcryptjs`.
- `@types/bcrypt` → `@types/bcryptjs` (o ninguno si `bcryptjs` trae tipos).
- (Opcional) paso de `npm audit` en el CI del backend (`.github/workflows/ci.yml`).

**Fuera de alcance (NO tocar):**
- `exceljs` en sí (se usa para los reportes; no se degrada ni se quita).
- El `~/.npmrc` global del usuario (`force=true`) — es config de máquina, no del repo.
- La lógica de `excel-reportes.service.ts`, `auth.service.ts` o `usuarios.service.ts` más allá
  de la línea de `import`.
- Subir de major NestJS/Express/TypeORM — no hay hallazgo que lo pida.

## Pasos

### Paso 1: `npm audit fix` para `qs` y `fast-uri`

```bash
npm audit fix
git diff package-lock.json | head -50
npm ci
npm run lint && npm run build && npm test
```

**Verify**: `npm audit` ya no lista `qs` ni `fast-uri`. `npm run build && npm test` → exit 0.
Si `npm audit fix` intenta un cambio de major (lo diría como "SEMVER WARNING" o requeriría
`--force`), **NO uses `--force`** — anota qué paquete y sigue; se resuelve en los pasos siguientes
o se acepta.

### Paso 2: Migrar `bcrypt` → `bcryptjs` (elimina `tar` y `@mapbox/node-pre-gyp`)

`bcryptjs` es una implementación en JS puro, sin binario nativo, sin `node-pre-gyp`, sin `tar`.
API compatible para lo que usa este repo (`hash(data, saltRounds)` y `compare(data, hash)`,
ambos con Promise). Los hashes que produce son bcrypt estándar (`$2a$`/`$2b$`), así que **los
hashes ya guardados en la BD siguen validando** sin cambios.

```bash
npm uninstall bcrypt @types/bcrypt
npm install bcryptjs
npm install -D @types/bcryptjs   # solo si bcryptjs no trae sus propios tipos; verifica primero
```

Luego, en los 3 archivos, cambia el import:

```ts
// ANTES
import * as bcrypt from 'bcrypt';
// DESPUÉS
import * as bcrypt from 'bcryptjs';
```

Archivos exactos (el resto de cada línea NO cambia):
- `src/modules/auth/auth.service.ts:6`
- `src/modules/usuarios/usuarios.service.ts:4`
- `src/database/seeds/seed.ts:2`

**Verify**:
```bash
grep -rn "from 'bcrypt'" src/          # → sin resultados
grep -rn "from 'bcryptjs'" src/        # → 3 resultados
npm run lint && npm run build && npm test
npm ls tar @mapbox/node-pre-gyp        # → "(empty)" o error "not found"
```
`auth-login.integration.spec.ts` y `usuarios.integration.spec.ts` deben pasar (ejercitan hash y
compare reales). Prueba manual: login con un usuario existente de la BD de desarrollo → funciona
(confirma que un hash generado por el `bcrypt` viejo valida con `bcryptjs`).

### Paso 3: Quitar `uuid` directo y contener el `uuid` de `exceljs`

```bash
npm uninstall uuid
grep -rn "from 'uuid'\|require('uuid')" src/   # confirma que NO hay ninguno (ya verificado en recon)
```

Re-audita:

```bash
npm audit
```

Si `uuid` sigue apareciendo (vía `exceljs`), evalúa el riesgo real: el advisory
(GHSA-w5hq-g745-h8pq) es "missing buffer bounds check **when `buf` is provided** en v3/v5/v6".
`exceljs` genera UUIDs sin pasar `buf`, así que **no es alcanzable**. Dos opciones:

1. **Aceptarlo** y documentarlo (recomendado): añade a `package.json` un comentario en el README
   o en un `SECURITY.md` corto explicando por qué se acepta.
2. **Forzarlo** con `overrides` en `package.json`:
   ```jsonc
   "overrides": {
     "exceljs": { "uuid": "^11.1.1" }
   }
   ```
   Luego `npm install`, `npm run build && npm test`, y **prueba manual de los 4 reportes .xlsx**
   (`GET /documentos/reportes/{contratos,inmuebles-por-barrio,recaudo,cartera}.xlsx`) para
   confirmar que `exceljs` sigue funcionando con el `uuid` forzado. Si algún reporte se rompe,
   revierte el override y vuelve a la opción 1.

**Verify**: `npm ls uuid` no muestra una dependencia directa de la raíz. `npm audit` no lista
`uuid` como directa. Si queda la nested de `exceljs`, está documentada como aceptada o forzada
con los reportes probados.

### Paso 4: (Recomendado) `npm audit` en el CI del backend

En `.github/workflows/ci.yml`, tras el paso "Instalar dependencias" (`npm ci`), añade:

```yaml
      - name: Auditoría de dependencias
        run: npm audit --audit-level=high
```

Esto hace que el CI falle si aparece una vulnerabilidad **alta o crítica** nueva. Nivel `high`
(no `moderate`) para no bloquear por ruido de bajo impacto.

> Si tras los Pasos 1-3 queda alguna `high`/`critical` que no se puede resolver sin un major
> disruptivo, usa `--audit-level=critical` temporalmente **con un comentario** que enlace a un
> issue de seguimiento, en vez de dejar el gate desactivado.

**Verify**: corre `npm audit --audit-level=high` localmente → exit 0. Empuja y confirma que el CI
de `main` sigue verde.

### Paso 5: Actualizar `plans/README.md`

Marca la fila del plan 014 como **DONE** con el hash del commit y una nota de cuántas
vulnerabilidades quedaron (idealmente 0 high/critical).

## Plan de pruebas

No hay lógica nueva que testear; la cobertura existente cubre el riesgo:

- `auth-login.integration.spec.ts` — login con hash/compare reales → valida la migración a `bcryptjs`.
- `usuarios.integration.spec.ts` — creación de usuario y cambio de contraseña → valida `bcrypt.hash`.
- `excel-reportes.service.spec.ts` / `pdf.service.spec.ts` — validan que `exceljs` sigue generando.

**Test nuevo opcional:** un spec corto que hashee una contraseña con `bcryptjs` y confirme que
`bcryptjs.compare` la valida, y que un hash `$2b$` "fijo" (pega uno generado antes de la
migración) sigue validando con `bcryptjs.compare` — deja evidencia de la compatibilidad
hacia atrás.

**Comando:** `npm test` → todos pasan.

## Criterios de cierre

TODOS deben cumplirse:

- [ ] `npm audit --audit-level=high` → exit 0 (0 vulnerabilidades altas o críticas).
- [ ] `npm ls tar` → vacío / not found (ya no está en el árbol).
- [ ] `grep -rn "from 'bcrypt'" src/` → sin resultados; `from 'bcryptjs'` → 3.
- [ ] `grep -n '"bcrypt"\|"uuid"\|"@types/bcrypt"' package.json` → sin resultados
      (`"bcryptjs"` sí presente).
- [ ] `npm run lint && npm run build && npm test` → exit 0.
- [ ] Login manual con un usuario existente de la BD de desarrollo → funciona.
- [ ] Los 4 reportes .xlsx se generan sin error (si se aplicó el override de `exceljs`).
- [ ] Paso de `npm audit` presente en `.github/workflows/ci.yml` (si se hizo el Paso 4).
- [ ] `plans/README.md` actualizado.

## STOP conditions

Detente y reporta si:

- Algún test de `auth`/`usuarios` falla tras cambiar a `bcryptjs` (indicaría un problema de
  compatibilidad de hashes — no debería pasar, pero si pasa es serio: **no** hagas rehash masivo
  sin decisión del dueño).
- `npm audit fix` (sin `--force`) quiere hacer un cambio de major en `@nestjs/*`, `express` o
  `typeorm` — no lo apliques; reporta qué paquete y por qué.
- El override de `exceljs`/`uuid` rompe la generación de algún reporte .xlsx — revierte y
  documenta la vulnerabilidad como aceptada (no alcanzable).
- Queda una vulnerabilidad **crítica** que no se resuelve con ninguno de los pasos — reporta
  cuál, su ruta (`npm ls <paquete>`) y para consulta con el dueño.

## Notas de mantenimiento

- **Revisor:** el diff clave es (a) 3 líneas de `import`, (b) `package.json`/`package-lock.json`.
  Confirmar que `bcryptjs` está en `dependencies` (no `devDependencies`) y que
  `@types/bcrypt`/`bcrypt`/`uuid` desaparecieron.
- `bcryptjs` es ~30% más lento que `bcrypt` nativo por operación. Para el volumen de este ERP
  (logins esporádicos de 2 roles) es irrelevante. Si algún día el volumen crece mucho, se puede
  reconsiderar `@node-rs/bcrypt` (nativo en Rust, sin `node-pre-gyp`).
- Volver a correr `npm audit` en cada PR de dependencias; el paso de CI del Paso 4 lo automatiza.
- El `~/.npmrc` con `force=true` del usuario: recomendar quitarlo (`npm config delete force`) para
  que `npm ci` respete las protecciones normales. No es parte de este repo.
