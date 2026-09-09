# Plan 017: Mover el logo de empresa a almacenamiento persistente (Railway Volume)

> **Executor instructions**: Sigue los pasos, verifica cada uno, respeta las STOP conditions.
> Al terminar actualiza `plans/README.md`.
>
> **Drift check**: `git diff --stat 0436315..HEAD -- src/main.ts src/modules/empresa/ src/modules/documentos/pdf-recibo.service.ts`

## Status

- **Priority**: P1 (el logo desaparece de la UI y de TODOS los PDF en cada redeploy de Railway)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (pero se despliega junto con el plan 015)
- **Category**: bug / migration
- **Planned at**: commit `0436315`, 2026-09-08

## Why this matters

`src/modules/empresa/empresa.controller.ts:15` guarda el logo subido en `./uploads/empresa` con
`diskStorage` de Multer, y `src/main.ts:58` lo sirve como estático desde
`join(process.cwd(), 'uploads')`. Railway usa un **filesystem efímero**: ese directorio se borra
en cada deploy. El logo aparece en la UI (login, layout) y se incrusta en **todos los PDF de
recibo** (`src/modules/documentos/pdf-recibo.service.ts:58` lee el archivo físico desde
`uploads/`). Tras el primer redeploy, la UI muestra un logo roto y los recibos salen sin logo.

La solución más simple para **un solo archivo** (el logo) es un **Railway Volume** montado en la
ruta de `uploads/`. No hace falta S3/R2 para esto.

## Estado actual

- `src/modules/empresa/empresa.controller.ts`:
  - `:15` → `const CARPETA_LOGOS = './uploads/empresa';`
  - `:63-79` → `FileInterceptor('archivo', { storage: diskStorage({ destination: ... mkdirSync(CARPETA_LOGOS, {recursive:true}) ..., filename: (_,file,cb) => cb(null, \`${randomUUID()}${extname(file.originalname)}\`) }), fileFilter: <mime check>, limits: { fileSize: 2*1024*1024 } })`
- `src/modules/empresa/empresa.service.ts`:
  - `:9` → `const PREFIJO_LOGO_PUBLICO = '/uploads/empresa/';`
  - `:63-72` → `actualizarLogo(archivo)`: setea `empresa.logoUrl = \`${PREFIJO_LOGO_PUBLICO}${archivo.filename}\``, guarda, y borra el anterior con `fs.unlink(join(process.cwd(), logoAnterior))`.
  - `:44-46` → `obtenerBranding()` devuelve `{ nombre, slogan, logoUrl }`.
- `src/main.ts:54` → `app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });`
- `src/modules/documentos/pdf-recibo.service.ts:58` → resuelve `empresa.logoUrl` (`"/uploads/empresa/<archivo>"`) a una ruta física relativa a `process.cwd()`.
- `.env.example`: no hay variable para la ruta de uploads.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Lint / build | `npm run lint && npm run build` | exit 0 |
| Tests | `npm test` | 188 verde |
| Grep de rutas de uploads | `grep -rn "uploads\|process.cwd()" src/ --include=*.ts \| grep -v spec` | ubica todos los usos |

## Scope

**In scope**:
- `src/config/rutas.ts` (crear — o `src/common/config/`, ver Paso 1)
- `src/modules/empresa/empresa.controller.ts`
- `src/modules/empresa/empresa.service.ts`
- `src/main.ts` (solo la línea `useStaticAssets`)
- `src/modules/documentos/pdf-recibo.service.ts` (solo la resolución de ruta del logo)
- `.env.example`
- `README.md` (nota del volumen), `PRODUCCION.md`, `plans/README.md`
- tests: `src/modules/empresa/empresa-autoseed.integration.spec.ts` o un spec nuevo pequeño

**Out of scope**:
- Migrar a S3/R2 — es una alternativa más pesada, no necesaria para 1 archivo.
- Cambiar el flujo de subida, validación de MIME, magic bytes — solo cambia **dónde** se guarda.
- El logo por defecto / seed.

## Git workflow

- Branch: `fix/017-logo-volumen`
- Conventional commits.

## Steps

### Step 1: Centralizar la ruta base de uploads en una variable de entorno

Crea `src/common/config/rutas.util.ts`:

```ts
import { join } from 'path';

/**
 * Raíz del almacenamiento de archivos subidos (hoy solo el logo de empresa). En local es
 * `<repo>/uploads`; en Railway se monta un Volume y se pasa su mountPath por `UPLOADS_DIR`
 * (p. ej. `/data/uploads`). El filesystem del contenedor es efímero — sin el Volume, el logo
 * se pierde en cada deploy.
 */
export function directorioUploads(): string {
  return process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
}

export function directorioLogos(): string {
  return join(directorioUploads(), 'empresa');
}

/** Prefijo público bajo el que `main.ts` sirve `directorioUploads()`. */
export const PREFIJO_PUBLICO_UPLOADS = '/uploads/';
export const PREFIJO_PUBLICO_LOGO = '/uploads/empresa/';
```

**Verify**: `npm run build` → exit 0.

### Step 2: Usar `directorioLogos()` en el controller

En `empresa.controller.ts`:
- Elimina `const CARPETA_LOGOS = './uploads/empresa';`.
- Importa `directorioLogos` de `../../common/config/rutas.util`.
- En `diskStorage.destination`: `mkdirSync(directorioLogos(), { recursive: true }); cb(null, directorioLogos());`

**Verify**: `grep -n "CARPETA_LOGOS\|directorioLogos" src/modules/empresa/empresa.controller.ts` → solo `directorioLogos`.

### Step 3: Usar la ruta centralizada en el service

En `empresa.service.ts`:
- Reemplaza `const PREFIJO_LOGO_PUBLICO = '/uploads/empresa/';` por un import de
  `PREFIJO_PUBLICO_LOGO` desde `../../common/config/rutas.util` (mantén el nombre local si
  prefieres: `const PREFIJO_LOGO_PUBLICO = PREFIJO_PUBLICO_LOGO`).
- En `actualizarLogo`, el borrado del anterior:
  `fs.unlink(join(directorioUploads(), logoAnterior.replace('/uploads/', ''))).catch(() => undefined)`
  — o más simple: `fs.unlink(join(directorioLogos(), path.basename(logoAnterior))).catch(...)`.
  Importa `directorioLogos` y `basename`.

**Verify**: `grep -n "process.cwd()" src/modules/empresa/empresa.service.ts` → sin resultados.

### Step 4: Servir el directorio correcto en `main.ts`

`src/main.ts:54`, cambia:
```ts
app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
```
por:
```ts
app.useStaticAssets(directorioUploads(), { prefix: PREFIJO_PUBLICO_UPLOADS });
```
Importa de `./common/config/rutas.util`.

**Verify**: `grep -n "useStaticAssets" src/main.ts` → usa `directorioUploads()`.

### Step 5: Resolver la ruta del logo en el PDF

En `src/modules/documentos/pdf-recibo.service.ts` (alrededor de :58), donde resuelve
`empresa.logoUrl` a una ruta física: reemplaza el `join(process.cwd(), ...)` por
`join(directorioUploads(), empresa.logoUrl.replace('/uploads/', ''))`
(o `join(directorioLogos(), basename(empresa.logoUrl))`). Importa de `../../common/config/rutas.util`.
Mantén el manejo de "logo ausente" que ya exista (si `logoUrl` es null o el archivo no está, el
PDF debe seguir generándose sin logo — **no debe reventar**).

**Verify**: `grep -n "process.cwd()" src/modules/documentos/pdf-recibo.service.ts` → sin resultados.

### Step 6: Documentar la variable y el volumen

- `.env.example`, en la sección APP: añade
  `# UPLOADS_DIR: raíz de archivos subidos. Vacío = <repo>/uploads (dev). En Railway: el mountPath del Volume.`
  y `UPLOADS_DIR=` (vacío).
- `README.md`, sección Despliegue (creada por el plan 015): añade
  "### Volumen de uploads — Railway → el servicio → Volumes → New Volume, mountPath `/data`, y
  setear `UPLOADS_DIR=/data/uploads`. Sin esto, el logo de empresa se pierde en cada deploy."
- `PRODUCCION.md`, `### DB-2`: marca `[x]` la opción A (Railway Volume) con "→ plan 017 (hecho)".

**Verify**: `grep -c "UPLOADS_DIR" .env.example README.md` → ≥ 2.

## Test plan

Añade a `src/modules/empresa/empresa-autoseed.integration.spec.ts` (o crea
`src/common/config/rutas.util.spec.ts` — unit puro, sin BD):

- `directorioUploads()` con `process.env.UPLOADS_DIR` sin definir → termina en `/uploads`.
- `directorioUploads()` con `process.env.UPLOADS_DIR = '/data/uploads'` → devuelve exactamente eso.
- `directorioLogos()` → `directorioUploads()` + `/empresa`.

Patrón: mira `src/common/utils/validar-secreto-jwt.util.spec.ts` (unit puro con `describe`/`it`,
sin Nest). Guarda y restaura `process.env.UPLOADS_DIR` en `beforeEach`/`afterEach`.

**Verify**: `npm test` → 188 + los nuevos, todo verde.

## Done criteria

- [ ] `grep -rn "process.cwd()" src/modules/empresa/ src/modules/documentos/pdf-recibo.service.ts src/main.ts` → sin resultados
- [ ] `grep -rn "'./uploads" src/ --include=*.ts | grep -v spec` → sin resultados (todo pasa por `rutas.util`)
- [ ] `npm run lint && npm run build && npm test` → exit 0, tests verde
- [ ] `.env.example` tiene `UPLOADS_DIR`
- [ ] `git status` sin archivos fuera de "In scope"
- [ ] `plans/README.md` y `PRODUCCION.md` actualizados

## STOP conditions

- El PDF de recibo hace algo más complejo con el logo que un `readFileSync` de una ruta (p. ej.
  lo descarga por HTTP, o cachea) — reporta antes de tocarlo.
- Hay otros `FileInterceptor` / `diskStorage` en el repo además del logo
  (`grep -rn "diskStorage\|FileInterceptor" src/`) — este plan asume que solo está el del logo.
- El drift check muestra que `empresa.controller.ts` o `pdf-recibo.service.ts` cambiaron de forma
  incompatible con los excerpts.

## Maintenance notes

- Revisor: confirmar que un PDF de recibo se sigue generando cuando el archivo del logo NO existe
  (caso primer deploy antes de subir logo) — no debe lanzar.
- Si en el futuro se suben más tipos de archivo (adjuntos de novedad, etc.), `directorioUploads()`
  ya es el punto único; considerar S3/R2 en ese momento por volumen.
- El Railway Volume tiene un tamaño fijo; el logo son KB, no es problema, pero anótalo si crece el uso.
