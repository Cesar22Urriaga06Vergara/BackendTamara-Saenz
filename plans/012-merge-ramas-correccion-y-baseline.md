# Plan 012: Merge de las ramas de corrección a `main` + verificación baseline (PASO 0)

> **ESTADO: TODO.** Generado por la skill `improve` (auditoría ronda 3, 2026-09-05) como
> **paso 0** de la primera tanda de correcciones de seguridad. Todos los planes 013+ de este
> repo y 014+ del frontend asumen que `main` ya contiene el trabajo de las rondas 1 y 2.
>
> **Este plan lo ejecuta el operador humano** (o un agente con permiso EXPLÍCITO de `git
> push`), no un ejecutor automático: incluye un merge de ~30 commits por repo hacia `main` y
> un `push`. No hay cambios de código fuente en este plan.

## Status

- **Priority**: P0 (bloquea la ejecución limpia del resto de la tanda)
- **Effort**: S (~1 h, casi todo verificación)
- **Risk**: MED — merge grande a `main`; mitigado porque las ramas están 0 commits *detrás* de `main`.
- **Depends on**: none
- **Category**: dx / baseline
- **Planned at**: BE commit `a9c242c` (rama `correccion-hallazgos-auditoria`), FE commit `4d429b8` (rama `correccion-hallazgos-auditoria`), 2026-09-05

## Por qué importa

Las correcciones de las rondas 1 y 2 (12 bugs confirmados + 11 planes BE + 12 planes FE) viven
solo en la rama `correccion-hallazgos-auditoria` de cada repo:

- Backend: `correccion-hallazgos-auditoria` está **33 commits adelante** de `main`, **0 detrás**.
- Frontend: `correccion-hallazgos-auditoria` está **29 commits adelante** de `main`, **0 detrás**.

Consecuencias hoy:

1. **`main` está obsoleto** — no contiene ninguna de las correcciones (JWT-01, N1, D2, REACT-01,
   DEP-REV-01, Helmet, sesión de 1 día, resiliencia de sesión, borradores de formulario, etc.).
2. **El CI no verifica nada de eso.** `.github/workflows/ci.yml` (backend) solo se dispara en
   `push`/`pull_request` a `main` (`ci.yml:4-7`). Las ~62 commits de arreglos nunca pasaron por CI.
3. **El frontend no tiene CI en absoluto** — no existe `.github/` en el repo del frontend.
4. Cada plan nuevo que se ejecute sobre `correccion-hallazgos-auditoria` alarga una rama que ya
   debería estar cerrada, y aumenta el riesgo del merge final.

Mergear ahora deja `main` como la línea base real, hace que el Cit del backend valide el estado
actual, y permite que los planes 013+ se ramifiquen desde `main` limpio.

## Estado actual

- **Backend** rama `correccion-hallazgos-auditoria` @ `a9c242c`, árbol de trabajo limpio
  (`git status --porcelain` → vacío).
- **Frontend** rama `correccion-hallazgos-auditoria` @ `4d429b8`, con **1 archivo sin trackear**:
  `"POSIBLES VISTAS.png"` en la raíz. Hay que decidir qué hacer con él ANTES del merge (ver Paso 2).
- **Migración pendiente de aplicar en la BD real** (heredado de la ronda 1, DEP-REV-01):
  `src/database/migrations/1786930000000-AnulacionDescuentoDeposito.ts` agrega
  `descuento_deposito.anuladoEn` y `.motivoAnulacion`. Sin ella, el backend arranca pero
  **cualquier consulta a `DescuentoDeposito` falla** (`recaudo.service.ts:815` filtra por
  `d.anuladoEn IS NULL`; `movimientos.service.ts:208` por `anuladoEn: IsNull()`). Ver Paso 5.
- CI backend: `.github/workflows/ci.yml` — `npm ci` → `npm run lint` → `npm run build` →
  `npm test` (integración contra un servicio `mariadb:10.11`, usando `.env.test` ya commiteado).

## Comandos que vas a necesitar

| Propósito | Backend | Frontend |
|---|---|---|
| Instalar | `npm ci` | `npm ci` |
| Lint | `npm run lint` | `npm run lint` |
| Typecheck | (incluido en `build`) | `npm run typecheck` |
| Build | `npm run build` | `npm run build` |
| Tests | `npm test` (requiere MariaDB en `localhost:3306`, base `tamara_saenz_db_test`) | `npm run test` |

> El backend necesita MariaDB local para `npm test`. En Windows: `C:\xampp\mysql\bin\mysqld.exe`
> (según la bitácora de la ronda 1). La suite usa `.env.test` (`DB_DATABASE=tamara_saenz_db_test`,
> `DB_SYNCHRONIZE=true`) — no toca la base de desarrollo ni la real.

## Alcance

**En alcance:**
- Verificación de que ambas ramas compilan / pasan lint / pasan tests.
- `git merge` de `correccion-hallazgos-auditoria` → `main` en **ambos** repos.
- `git push origin main` en ambos repos.
- (Opcional, recomendado) crear `.github/workflows/ci.yml` mínimo en el frontend.
- Actualizar `plans/README.md` de ambos repos (marcar este plan como DONE).

**Fuera de alcance (NO tocar):**
- Cualquier cambio de código fuente. Si algún comando de verificación falla, es un **STOP** —
  no "arreglar de paso".
- El endurecimiento de secretos / dependencias / login — son los planes 013, 014 (BE) y
  014, 015, 016 (FE), que se ejecutan DESPUÉS de este.
- Borrar la rama `correccion-hallazgos-auditoria` tras el merge (déjala; se puede borrar más
  tarde una vez confirmado que `main` desplegó bien).

## Pasos

### Paso 1: Verificar la rama del backend

```bash
cd <ruta>/BackendTamara-Saenz
git checkout correccion-hallazgos-auditoria
git pull --ff-only        # asegura estar al día con origin
npm ci
npm run lint
npm run build
npm test
```

**Verify**: los 4 comandos salen con exit 0. `npm test` reporta ~152+ tests, todos en verde.
Si algún test falla, **STOP** y reporta cuál (con su salida) — no continúes al merge.

### Paso 2: Resolver el archivo sin trackear del frontend

```bash
cd <ruta>/FrontendTamara-Saenz
git status --porcelain
```

Vas a ver `?? "POSIBLES VISTAS.png"`. Decide con el dueño:
- Si es un material de diseño que debe conservarse en el repo → `git add "POSIBLES VISTAS.png"`
  y commitéalo aparte en la rama antes del merge, con mensaje `chore: agrega mockup POSIBLES VISTAS.png`.
- Si es un archivo local que no debe versionarse → agrégalo a `.gitignore`
  (línea nueva: `POSIBLES VISTAS.png`) y commitea ese cambio de `.gitignore`, o simplemente
  muévelo fuera del repo.

**Verify**: `git status --porcelain` en el frontend sale vacío (sin archivos sin trackear ni
cambios sin commitear).

### Paso 3: Verificar la rama del frontend

```bash
cd <ruta>/FrontendTamara-Saenz
git checkout correccion-hallazgos-auditoria
git pull --ff-only
npm ci
npm run lint
npm run typecheck
npm run build
npm run test
```

**Verify**: `lint`, `build`, `test` salen con exit 0. `typecheck` (`vue-tsc --noEmit`) puede
emitir **un** warning preexistente conocido (documentado en la bitácora de la ronda 1) — si es
ese, continúa; si aparecen errores nuevos, **STOP** y repórtalos.

### Paso 4: Merge del backend a `main`

```bash
cd <ruta>/BackendTamara-Saenz
git checkout main
git pull --ff-only
git merge --no-ff correccion-hallazgos-auditoria -m "merge: correcciones de auditoría rondas 1 y 2"
```

**Verify**: el merge se completa sin conflictos (las ramas están 0 commits detrás de `main`, así
que debe ser trivial). Si hay conflicto, **STOP** — significa que `main` avanzó por otro lado y
alguien tiene que resolverlo a mano con contexto.

Vuelve a compilar sobre `main` ya mergeado:

```bash
npm ci && npm run lint && npm run build && npm test
```

**Verify**: exit 0 en los 4. Luego:

```bash
git push origin main
```

### Paso 5: Aplicar la migración pendiente en la BD real (coordinar con el dueño)

Antes de que el backend recién mergeado se despliegue a la base de datos real:

```bash
# apuntando el .env a la BD REAL (tamara_saenz_db), NO la de pruebas
npm run migration:run
```

**Verify**: la salida lista la ejecución de `AnulacionDescuentoDeposito1786930000000`. Después:

```bash
npm run migration:run   # segunda corrida
```

**Verify**: "No migrations are pending". Si la primera corrida ya decía eso, la migración ya
estaba aplicada — está bien, continúa.

> Si no tienes acceso a la BD real, **STOP aquí** y entrega este paso al dueño con esta
> instrucción exacta. El resto del plan (Paso 6, Paso 7) puede seguir.

### Paso 6: Merge del frontend a `main`

```bash
cd <ruta>/FrontendTamara-Saenz
git checkout main
git pull --ff-only
git merge --no-ff correccion-hallazgos-auditoria -m "merge: correcciones de auditoría rondas 1 y 2 (frontend)"
npm ci && npm run lint && npm run typecheck && npm run build && npm run test
git push origin main
```

**Verify**: merge sin conflictos; los comandos de verificación en verde (mismo criterio de
warning de `typecheck` que el Paso 3); `push` acepta.

### Paso 7 (OPCIONAL, recomendado): CI mínimo para el frontend

Crea `<ruta>/FrontendTamara-Saenz/.github/workflows/ci.yml`:

```yaml
name: CI Frontend

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm run test
```

Commitéalo en `main` directamente (`chore(ci): añade workflow de CI para el frontend`) y
`git push`. Confirma en la pestaña Actions de GitHub que la corrida pasa.

> Si `npm run typecheck` rompe el CI por el warning preexistente de `vue-tsc`, cámbialo por
> `run: npm run typecheck || true` **con un comentario** explicando que es temporal hasta que
> se resuelva el warning, y abre un issue para quitarlo.

### Paso 8: Verificar CI del backend en `main`

Ve a la pestaña Actions del repo del backend en GitHub. Confirma que la corrida disparada por el
`push` del Paso 4 (`CI Backend`) terminó en verde (lint + build + tests de integración contra
MariaDB).

**Verify**: check verde en el commit de merge del backend en `main`.

### Paso 9: Actualizar los índices de planes

- En `BackendTamara-Saenz/plans/README.md`: marca la fila del plan 012 como **DONE** con el hash
  del commit de merge.
- En `FrontendTamara-Saenz/plans/README.md`: agrega/actualiza la fila que apunta a este plan
  (el merge del frontend se coordina aquí) como **DONE**.

## Plan de pruebas

Este plan no agrega código de producción, así que no hay tests nuevos. La "prueba" es que **toda
la suite existente de ambos repos pasa sobre `main` después del merge** (Pasos 4 y 6) y que el
**CI del backend pasa en `main`** (Paso 8).

Humo manual mínimo tras el merge y la migración (Paso 5), con el backend y el frontend corriendo:

1. Login como Administrador → dashboard carga.
2. `/depositos` → la pantalla de depósitos liquidados carga sin error 500 (esto ejercita
   `recaudo.service.ts:815`, la consulta que depende de la columna `anuladoEn` de la migración).
3. `/recaudo` → seleccionar un contrato → la ficha de recaudo carga.

## Criterios de cierre

TODOS deben cumplirse:

- [ ] `git log --oneline origin/main -1` (backend) es un commit de merge de
      `correccion-hallazgos-auditoria`.
- [ ] `git log --oneline origin/main -1` (frontend) es un commit de merge de
      `correccion-hallazgos-auditoria`.
- [ ] `git rev-list --count origin/main..origin/correccion-hallazgos-auditoria` = 0 en ambos repos.
- [ ] CI del backend en verde en el commit de merge de `main`.
- [ ] `npm run lint && npm run build && npm test` (BE) y
      `npm run lint && npm run typecheck && npm run build && npm run test` (FE) pasan sobre `main`.
- [ ] La migración `1786930000000-AnulacionDescuentoDeposito` está aplicada en la BD real
      (o el paso quedó formalmente entregado al dueño con instrucción escrita).
- [ ] Ambos `plans/README.md` actualizados.

## STOP conditions

Detente y reporta (no improvises) si:

- Cualquier comando de lint / build / test / typecheck falla en cualquier paso.
- El `git merge` produce conflictos (indica que `main` divergió — necesita resolución con contexto).
- La rama `correccion-hallazgos-auditoria` resulta estar N commits *detrás* de `main` (este plan
  asume 0 detrás; si no, hay que rebasear/mergear en la otra dirección primero, con el dueño).
- No tienes permiso de `git push` a `origin/main` — entrega el plan al operador con permiso.
- No tienes acceso a la BD real para el Paso 5 — entrégalo al dueño y sigue con el Paso 6.

## Notas de mantenimiento

- Tras confirmar que `main` desplegó bien en producción, se puede borrar la rama
  `correccion-hallazgos-auditoria` en ambos repos (`git branch -d` local + `git push origin
  --delete`). No lo hagas dentro de este plan.
- Los planes 013 y 014 del backend, y 014/015/016 del frontend, deben ramificarse **desde `main`**
  después de este merge. Si por alguna razón el merge se pospone, cada plan indica que puede
  ejecutarse sobre `correccion-hallazgos-auditoria` como alternativa.
- El frontend queda con CI solo si se hizo el Paso 7. Si se saltó, el hallazgo S-11 de la
  auditoría (FE sin CI) sigue abierto y merece su propio plan.
- Revisor del PR/merge: no hay diff de código que revisar (es un merge de trabajo ya revisado);
  el foco de la revisión es que el CI de `main` quede verde y que la migración real se aplicó.
