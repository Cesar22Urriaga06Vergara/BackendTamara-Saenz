# Plan 005: Limpieza de documentación del backend (contaminación de contexto)

> **Executor instructions**: Sigue el plan paso a paso. Este plan **solo toca archivos de
> documentación** (`.md`), nunca código. Verifica cada paso. Respeta las STOP conditions.
> Actualiza `plans/README.md` al terminar.
>
> **Drift check (primero)**:
> `git status --porcelain documentacion/ README.md ARCHITECTURE_AND_AUDIT.md`
> Nota: `ARCHITECTURE_AND_AUDIT.md` y `PREGUNTAS_NEGOCIO.md` **están fuera de git** (el
> `.gitignore` los excluye con `**/*.md`), así que `git status` no los mostrará — es esperado.
> Si `README.md` o `documentacion/backendocu/ESPECIFICACION_MAESTRA_NEGOCIO.md` tienen cambios
> sin commitear que no son tuyos, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `0506b3d`, 2026-09-03

## Why this matters

El "Objetivo A" de la propia auditoría del sistema es **limpiar el contexto documental** para que
los agentes que trabajen el repo no se confundan con información obsoleta. Hoy hay varias fuentes
que **contradicen activamente el código real**:

- El `README.md` del backend (bitácora viva) dice "MySQL 8" (es MariaDB 10.4), describe un
  endpoint `PATCH /contratos/:id/suspender` y un estado `SUSPENDIDO` que **fueron eliminados**
  (migración `1786780000000-EliminarSuspendidoYHistorialContrato`), lista medios de pago
  `CONSIGNACION, OTRO` **retirados** (migración `1786740000000-RetirarConsignacionYOtroMedioPago`),
  y referencia un archivo `AUDITORIA_FUNCIONAL_COMPLETA.md` que **no existe** en el repo.
- `ESPECIFICACION_MAESTRA_NEGOCIO.md` §11 declara que **la mora fue retirada por decisión de
  negocio el 2026-09-01** y que "el orden de aplicación (§10) pasa a ser Canon → Novedad" — pero
  §10, §13, §20 y §22 (invariante 7) **siguen diciendo "Canon → Novedad → Mora"**.
- Hay archivos huérfanos y duplicados en `documentacion/backendocu/frontendocu/`.
- Dos auditorías previas ya consolidadas en `ARCHITECTURE_AND_AUDIT.md` siguen como archivos
  sueltos, interpretables como vigentes.

Cada una de esas contradicciones es una trampa para el siguiente agente (o desarrollador) que
lea la doc y actúe sobre ella.

## Current state

### Archivos de documentación del backend

| Ruta | Estado |
|---|---|
| `README.md` (raíz) | bitácora viva — **contiene afirmaciones falsas**, ver Step 3 |
| `AGENTS.md` | reglas de agente — **vigente, no tocar** |
| `ARCHITECTURE_AND_AUDIT.md` (raíz, **fuera de git**) | fuente de verdad de auditoría — errata menor en §8, ver Step 4 |
| `PREGUNTAS_NEGOCIO.md` (raíz, **fuera de git**) | preguntas de negocio — refs a mora obsoletas, ver Step 5 |
| `documentacion/backendocu/ESPECIFICACION_MAESTRA_NEGOCIO.md` | fuente de verdad de negocio — contradicción interna mora, ver Step 6 |
| `documentacion/backendocu/AUDITORIA_QUIRURGICA_SEGUNDA_GENERACION.md` (2026-08-20) | histórico, ya consolidado — archivar, ver Step 2 |
| `documentacion/backendocu/AUDITORIA_ROLES_Y_PERMISOS.md` (2026-08-20) | histórico, ya consolidado — archivar, ver Step 2 |
| `documentacion/backendocu/PROMPT_AUDITORIA_QUIRURGICA_CLAUDE_CODE.md` | prompt de trabajo histórico — archivar, ver Step 2 |
| `documentacion/backendocu/frontendocu/ESPECIFICACION_UI_UX_PAGINA_POR_PAGINA.md` | **duplicado exacto** de la copia del repo frontend — borrar, ver Step 1 |
| `documentacion/backendocu/frontendocu/PROMPT MAESTRO — ....md` | prompt de trabajo del frontend, mal ubicado — archivar, ver Step 2 |
| `documentacion/backendocu/frontendocu/PROMPT — Auditoría Frontend ....md` | ídem |
| `documentacion/backendocu/frontendocu/story.md` | **huérfano, no relacionado** (guion de video "Cat_Lily") — borrar, ver Step 1 |
| `documentacion/backendocu/frontendocu/POSIBLES VISTAS.png` | mockup de diseño del frontend, mal ubicado — mover, ver Step 2 |
| `src/database/migrations/README.md` | instrucciones de migración — **vigente, no tocar** |

### `README.md` — líneas con afirmaciones falsas (verificar antes de editar)

- Línea 3: `NestJS 11 + TypeORM + MySQL 8 + JWT + Swagger.`
- Línea 39 y 88: `16 tablas` (hay 25 migraciones; el nº exacto de tablas requiere contar — usar "el esquema completo" sin número).
- Línea 93: `Si vas a usar MySQL 8 "de verdad" en vez de MariaDB ...`
- Líneas 111, 119, 134-135, 141: mención de `suspender` / `/suspender` como funcionalidad vigente.
- Línea 126, 165: referencia a `AUDITORIA_FUNCIONAL_COMPLETA.md` (archivo inexistente).
- Línea 154: `CONSIGNACION, OTRO` como medios de pago.

### `ESPECIFICACION_MAESTRA_NEGOCIO.md` — líneas con mora (referencia)

- §11 (línea 281+): banner "RETIRADO POR DECISIÓN DE NEGOCIO — 2026-09-01" — **este es el estado correcto**.
- §10 (líneas 254-277): "El orden oficial es: 1. Canon / 2. Novedad / **3. Mora**" + ejemplo con mora.
- §6.1 (líneas 102, 111): "condiciones de mora" / "cálculo de mora".
- §13 (línea ~360): flujo "→ canon → novedad → **mora** →".
- §20 (línea 539): recibo "mora separada".
- §22 (líneas 580-582): invariantes 7-9 sobre mora / "Canon → Novedad → Mora".
- §11.1-11.3 (líneas 290-328): fórmula y reglas de mora — **se conservan como referencia
  histórica** (el propio §11 lo dice).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Comparar duplicado | `git hash-object documentacion/backendocu/frontendocu/ESPECIFICACION_UI_UX_PAGINA_POR_PAGINA.md ../FrontendTamara-Saenz/ESPECIFICACION_UI_UX_PAGINA_POR_PAGINA.md` | los dos hashes coinciden (confirma que es duplicado exacto) |
| Confirmar que no hay refs al archivo a borrar | `grep -rn "story.md" --include="*.md" --include="*.ts" .` | 0 coincidencias (nada lo referencia) |
| Ver estado | `git status` | solo los `.md` in-scope y bajo git aparecen |

> **No hay build/test/lint que corra sobre documentación.** La verificación de este plan es por
> `grep` y revisión de contenido.

## Scope

**In scope** (solo documentación):
- Borrar: `documentacion/backendocu/frontendocu/story.md`, `documentacion/backendocu/frontendocu/ESPECIFICACION_UI_UX_PAGINA_POR_PAGINA.md`
- Mover a `documentacion/backendocu/archivo/`: `AUDITORIA_QUIRURGICA_SEGUNDA_GENERACION.md`,
  `AUDITORIA_ROLES_Y_PERMISOS.md`, `PROMPT_AUDITORIA_QUIRURGICA_CLAUDE_CODE.md`, y los 2 PROMPT
  del frontend + `POSIBLES VISTAS.png` de `frontendocu/`
- Editar: `README.md` (correcciones factuales), `ARCHITECTURE_AND_AUDIT.md` (errata §8),
  `PREGUNTAS_NEGOCIO.md` (nota de mora), `documentacion/backendocu/ESPECIFICACION_MAESTRA_NEGOCIO.md`
  (banners HISTÓRICO + fix de referencias cruzadas)

**Out of scope** (NO tocar):
- **Cualquier archivo de código** (`.ts`, `.json`, migraciones).
- `AGENTS.md`, `src/database/migrations/README.md` — vigentes.
- **NO borrar** `ESPECIFICACION_MAESTRA_NEGOCIO.md` §11.1-11.3 (la fórmula de mora) — solo
  marcarla como histórica.
- **NO inventar reglas de negocio nuevas.** Si al fijar una referencia cruzada de mora te
  encuentras con que no sabes qué debería decir, es una STOP condition — lo decide el dueño.
- El repo del frontend (su README y su copia de `ESPECIFICACION_UI_UX` van en un plan aparte).
- Los árboles obsoletos `C:\Users\urria\BackendTamara-Saenz\` — fuera de este repo, el dueño los
  borra a mano.

## Git workflow

- Rama: `advisor/005-limpieza-documentacion-backend`.
- Commits separados por tipo: uno para borrados/movimientos, uno para el README, uno para la
  ESPECIFICACION. Mensajes estilo repo.
- Nota: `ARCHITECTURE_AND_AUDIT.md` y `PREGUNTAS_NEGOCIO.md` no entran a git (gitignored) — se
  editan igual pero no aparecen en `git add`.

## Steps

### Step 1: Borrar huérfanos y duplicados

1. Confirmar el duplicado:
   `git hash-object documentacion/backendocu/frontendocu/ESPECIFICACION_UI_UX_PAGINA_POR_PAGINA.md`
   y el mismo comando sobre `../FrontendTamara-Saenz/ESPECIFICACION_UI_UX_PAGINA_POR_PAGINA.md`.
   Si los hashes **coinciden**, borrar la copia del backend. Si **no coinciden**, STOP (hay que
   reconciliar contenido, no es borrado ciego).
2. Confirmar que nada referencia `story.md`:
   `grep -rn "story.md" --include="*.md" --include="*.ts" .` → 0 coincidencias. Borrar
   `documentacion/backendocu/frontendocu/story.md`.

**Verify**: `ls documentacion/backendocu/frontendocu/` no lista `story.md` ni
`ESPECIFICACION_UI_UX_PAGINA_POR_PAGINA.md`.

### Step 2: Archivar históricos

1. Crear `documentacion/backendocu/archivo/`.
2. Mover ahí (con `git mv` para los que están en git; `mv` normal para los que no):
   - `documentacion/backendocu/AUDITORIA_QUIRURGICA_SEGUNDA_GENERACION.md`
   - `documentacion/backendocu/AUDITORIA_ROLES_Y_PERMISOS.md`
   - `documentacion/backendocu/PROMPT_AUDITORIA_QUIRURGICA_CLAUDE_CODE.md`
   - `documentacion/backendocu/frontendocu/PROMPT MAESTRO — Auditoría Integral, Mejora UI-UX y Plan de Acción del Frontend _ Inversiones Tamara & Saenz.md`
   - `documentacion/backendocu/frontendocu/PROMPT — Auditoría Frontend UI-UX + Plan de Acción _ Inversiones Tamara & Saenz.md`
3. Mover `documentacion/backendocu/frontendocu/POSIBLES VISTAS.png` → `documentacion/backendocu/archivo/POSIBLES VISTAS.png`.
4. Crear `documentacion/backendocu/archivo/README.md` con una línea:
   `Documentos históricos ya consolidados en /ARCHITECTURE_AND_AUDIT.md. Se conservan por trazabilidad; NO son fuente de verdad vigente.`
5. Si `documentacion/backendocu/frontendocu/` queda vacío, borrar la carpeta.

**Verify**: `ls documentacion/backendocu/archivo/` lista los 5 `.md` + el `.png` + el README;
`documentacion/backendocu/` ya no tiene `AUDITORIA_*.md` sueltos.

### Step 3: Corregir el `README.md` del backend

Ediciones puntuales (buscar la cadena exacta y reemplazar). **No reescribas secciones enteras**,
solo corrige lo falso:

| Buscar | Reemplazar por |
|---|---|
| `NestJS 11 + TypeORM + MySQL 8 + JWT + Swagger.` | `NestJS 11 + TypeORM + MariaDB 10.4 + JWT + Swagger.` |
| `del esquema completo (16 tablas, todas las foreign keys)` | `del esquema completo (todas las tablas y foreign keys)` |
| `(16 tablas, no hace falta migration:generate)` | `(no hace falta migration:generate)` |
| `Si vas a usar MySQL 8 "de verdad" en vez de MariaDB (con el que se probó esto), el mismo flujo aplica sin cambios` | `El proyecto se prueba y ejecuta contra MariaDB 10.4 (driver mysql2)` |
| `terminar y\n  suspender Contratos` (línea 110-111) | `terminar Contratos` (quitar "y suspender") |
| `al terminar/suspender un contrato` (línea 119) | `al terminar un contrato` |
| `Terminar/suspender/reactivar contrato por Recepcionista: ✅ ya implementado — `PATCH\n  /contratos/:id/terminar`, `/suspender` y `/reactivar` aceptan ambos roles` | `Terminar/reactivar contrato: `PATCH /contratos/:id/terminar` acepta ambos roles; `PATCH /contratos/:id/reactivar` es **exclusivo Administrador**. No existe `/suspender` (estado SUSPENDIDO eliminado — migración EliminarSuspendidoYHistorialContrato)` |
| `terminar()`/`suspender()` no modifican las obligaciones` | `terminar() no modifica las obligaciones` |
| `EFECTIVO, TRANSFERENCIA,\n  CONSIGNACION, OTRO) en un solo recibo` | `EFECTIVO, TRANSFERENCIA) en un solo recibo` |
| `AUDITORIA_FUNCIONAL_COMPLETA.md` (todas las apariciones) | `ARCHITECTURE_AND_AUDIT.md` |

Al final del `README.md`, añadir una entrada de bitácora:

```
## Limpieza de documentación (2026-XX-XX)

Corregidas afirmaciones obsoletas en esta bitácora (MySQL 8 → MariaDB; feature "suspender"
y medios CONSIGNACION/OTRO retirados; refs a AUDITORIA_FUNCIONAL_COMPLETA.md → ARCHITECTURE_AND_AUDIT.md).
Auditorías previas movidas a `documentacion/backendocu/archivo/`.
```

**Verify**:
- `grep -n "MySQL 8\|suspender\|CONSIGNACION\|AUDITORIA_FUNCIONAL_COMPLETA" README.md` → 0 coincidencias
- `grep -c "MariaDB" README.md` → ≥ 2

### Step 4: Errata en `ARCHITECTURE_AND_AUDIT.md` (§8, §7, §17, §2, §21)

Este archivo está fuera de git — se edita igual. En la **§8 (tabla de endpoints)**:

| Buscar | Reemplazar por |
|---|---|
| `POST /auth/refrescar` | `POST /auth/refresh` |
| en la fila de `auth`, tras `POST /auth/logout` | añadir `, POST /auth/me` |
| `PATCH /novedades/:id/aprobar` | `PATCH /novedades/:id/aprobar-cargo-arrendatario`, `PATCH /novedades/:id/aprobar-gasto-inmobiliaria` |
| `PATCH /novedades/:id/pagar-gasto` | `PATCH /novedades/:id/pagar-gasto-inmobiliaria` |
| `PATCH /novedades/:id/revertir-aprobacion` | (dejar — es correcto) |

En **§7 y §17**: `23 archivos` / `23 migraciones` → `25 migraciones`.

En **§2**: la frase "no se encontró `.github/workflows` ni pipeline — **NO DETERMINADO**" es
**falsa** — existe `.github/workflows/ci.yml` (lint + build + tests de integración contra
MariaDB, se dispara en push/PR a `main`). Corregir a: "CI en `.github/workflows/ci.yml` — lint,
build y tests de integración contra MariaDB; se dispara solo en `main` (no en ramas de feature)."

En **§21 / §18**, el hallazgo "Alto 9 — `observaciones` de contrato": está clasificado como
**FALSO POSITIVO**, pero era **real** — el campo existía en `CreateContratoDto` y se descartaba
en silencio. **Ya fue corregido** (ronda 1, plan N7: se eliminó el campo muerto del DTO).
Reclasificar a: "**CORREGIDO** (ronda 1) — el campo `observaciones` existía en el DTO y se
descartaba; se eliminó del DTO."

Añadir al principio del documento, tras el encabezado, una línea:
`> Fe de erratas 2026-XX-XX: §8 (rutas de auth y novedades), §7/§17 (25 migraciones), §2 (sí hay CI), §21 Alto 9 (era real, ya corregido).`

**Verify**: `grep -n "auth/refrescar\|23 migraciones\|23 archivos" ARCHITECTURE_AND_AUDIT.md` → 0 coincidencias.

### Step 5: Nota de mora en `PREGUNTAS_NEGOCIO.md`

Este archivo ya tiene el bloque "RESUELTO (2026-09-01)" en la sección B. El problema son las
referencias residuales en **§C** (recuadro "Hoy el sistema asume" + pregunta 14), **§L**
(pregunta 48: "el sistema calcula la mora pero no avisa") y la **tabla "Resumen de prioridad"**
(lista B en 🔴 "Ahora").

- §C recuadro: donde diga que el orden es "1° arriendo, 2° cargos, 3° mora" → cambiar a
  "1° arriendo (canon), 2° cargos por novedades. (El recargo por mora fue retirado — ver B.)"
- §C pregunta 14: añadir al final "(La mora ya no aplica; se conserva la pregunta por si el
  orden canon/novedad debe invertirse.)"
- §L pregunta 48: `Hoy el sistema calcula la mora pero no avisa a nadie.` → `Hoy el sistema no
  cobra mora (retirada 2026-09-01) y no envía avisos de atraso.`
- Tabla resumen: quitar `B` de la fila 🔴 "Ahora" y de la explicación; añadir "(B resuelta)".

**Verify**: `grep -n "calcula la mora" PREGUNTAS_NEGOCIO.md` → 0 coincidencias.

### Step 6: Banners HISTÓRICO + referencias cruzadas en `ESPECIFICACION_MAESTRA_NEGOCIO.md`

Este es el paso de **más cuidado**. El §11 ya dice claramente que la mora fue retirada y que el
orden pasa a "Canon → Novedad". Tu trabajo es **propagar esa decisión ya tomada** a las
secciones que quedaron desactualizadas — NO tomar decisiones nuevas.

1. **§10 (Orden de aplicación del dinero)**: donde dice `**1. Canon** / **2. Novedad** / **3. Mora**`
   → dejar `**1. Canon** / **2. Novedad**` y añadir tras la lista:
   `> El punto 3 (Mora) fue retirado — ver §11. El ejemplo de abajo se conserva como
   > ilustración histórica del cálculo cuando la mora existía.`
   El ejemplo trabajado (Canon $400.000 / Novedad $150.000 / Mora $50.000 ...) se **deja tal
   cual** bajo ese banner.

2. **§6.1** líneas "condiciones de mora" / "La fecha de pago del canon es la referencia para
   vencimiento y cálculo de mora" → cambiar "y cálculo de mora" por "(la mora fue retirada — §11)".

3. **§11.1, §11.2, §11.3** (fórmula y reglas de mora): añadir al inicio de §11.1 el banner:
   `> **HISTÓRICO.** Esta subsección describe el cálculo de mora tal como existía antes del
   > 2026-09-01. Se conserva solo para poder auditar recibos antiguos que sí cobraron mora. NO
   > describe ningún comportamiento vigente.`

4. **§13** (flujo de Recaudo "→ canon → novedad → mora →"): quitar "→ mora" y añadir nota
   `(mora retirada — §11)`.

5. **§20** ("El recibo debe mostrar ... mora separada"): cambiar "mora separada;" por
   "~~mora separada~~ (retirada — §11);".

6. **§22** (invariantes): la invariante 7 "La aplicación del dinero debe respetar Canon →
   Novedad → Mora" → "Canon → Novedad (la mora fue retirada — §11)". Las invariantes 8 y 9
   ("La mora nunca genera nueva mora", "El porcentaje 0 debe producir mora 0") → marcarlas
   `(histórico — mora retirada)`.

**STOP si**: en cualquiera de estos puntos el texto de la ESPECIFICACION dice algo que
**contradice** lo que hace el código (más allá de la mora ya conocida), o si no está claro qué
debería decir. En ese caso, deja el archivo como estaba en ese punto y anótalo para el dueño.

**Verify**: `grep -n "3. Mora\|Canon → Novedad → Mora" documentacion/backendocu/ESPECIFICACION_MAESTRA_NEGOCIO.md`
→ 0 coincidencias (o solo dentro de bloques marcados HISTÓRICO).

### Step 7: Actualizar el encabezado de `ARCHITECTURE_AND_AUDIT.md`

En la lista de documentos que consolida, confirmar que menciona que las auditorías previas
ahora viven en `documentacion/backendocu/archivo/`.

## Test plan

No aplica (documentación). Verificación = los `grep` de cada step + una lectura final:

- `grep -rn "MySQL 8\|/suspender\|CONSIGNACION\|AUDITORIA_FUNCIONAL_COMPLETA" README.md documentacion/` → 0
- `grep -rn "Canon → Novedad → Mora" documentacion/backendocu/ESPECIFICACION_MAESTRA_NEGOCIO.md` → 0 fuera de bloques HISTÓRICO
- Abrir `ESPECIFICACION_MAESTRA_NEGOCIO.md` y confirmar que §11.1-11.3 siguen presentes (no borradas), solo con banner.

## Done criteria

- [ ] `documentacion/backendocu/frontendocu/story.md` no existe
- [ ] `documentacion/backendocu/frontendocu/ESPECIFICACION_UI_UX_PAGINA_POR_PAGINA.md` no existe (duplicado confirmado y borrado)
- [ ] `documentacion/backendocu/archivo/` existe con los 5 `.md` históricos + su README
- [ ] `grep -n "MySQL 8\|CONSIGNACION\|AUDITORIA_FUNCIONAL_COMPLETA" README.md` → 0
- [ ] `grep -n "auth/refrescar\|23 migraciones" ARCHITECTURE_AND_AUDIT.md` → 0
- [ ] `grep -n "calcula la mora" PREGUNTAS_NEGOCIO.md` → 0
- [ ] `ESPECIFICACION_MAESTRA_NEGOCIO.md` §11.1-11.3 siguen presentes, con banner HISTÓRICO
- [ ] Ningún archivo `.ts` / `.json` modificado (`git status --porcelain | grep -vE '\.md$'` vacío, salvo renombres de `git mv`)
- [ ] Fila en `plans/README.md` actualizada

## STOP conditions

- El hash de `ESPECIFICACION_UI_UX_PAGINA_POR_PAGINA.md` **no** coincide con la copia del
  frontend → no es un duplicado, no borrar, reportar.
- `grep "story.md"` devuelve alguna referencia → algo lo usa, no borrar, reportar.
- En el Step 6, el texto de la ESPECIFICACION contradice el código en algo que **no** sea la
  mora ya conocida → parar ese punto, dejar el archivo como estaba, anotar para el dueño.
- Cualquier archivo de código aparece modificado.

## Maintenance notes

- **Reviewer**: leer el diff completo de `ESPECIFICACION_MAESTRA_NEGOCIO.md` con lupa — es la
  fuente de verdad de negocio. Confirmar que **nada se borró** (solo banners y notas) y que
  ninguna regla nueva se inventó.
- **Decisión pendiente del dueño** (no la resuelve este plan): confirmar formalmente que la
  ESPECIFICACION debe reflejar el retiro de mora en todas sus secciones (este plan asume que sí,
  apoyándose en el §11 ya escrito). Y decidir si `ARCHITECTURE_AND_AUDIT.md` / `PREGUNTAS_NEGOCIO.md`
  deberían **entrar a git** (hoy los excluye `**/*.md` en `.gitignore`) — una "fuente de verdad"
  sin control de versiones es frágil.
- **Diferido**: el `README.md` del frontend tiene el mismo tipo de claims obsoletos ("Suspender",
  "no hay UI que invoque PATCH /novedades/:id/estado") — va en el plan de limpieza del repo frontend.
