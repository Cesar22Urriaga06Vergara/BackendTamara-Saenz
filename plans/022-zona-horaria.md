# Plan 022: Fijar la zona horaria (app + conexión BD) y blindar el manejo de fechas

> **Executor instructions**: Sigue los pasos, verifica cada uno, respeta las STOP conditions.
> Este plan añade tests que corren con `TZ` forzada — préstales atención. Actualiza `plans/README.md`.
>
> **Drift check**: `git diff --stat 0436315..HEAD -- src/app.module.ts src/database/data-source.ts src/modules/obligaciones/ src/modules/dashboard/`

## Status

- **Priority**: P1 (afecta cartera vencida, mora y generación de canon — cálculos que van a producción con dinero real)
- **Effort**: M
- **Risk**: MED (toca comparaciones de fecha en el motor financiero; mitigado con tests de TZ)
- **Depends on**: none (independiente del 021)
- **Category**: bug
- **Planned at**: commit `0436315`, 2026-09-08

## Why this matters

El backend mezcla dos relojes:
- **JS**: `esVencida()` (`obligaciones.service.ts:238-242`) usa `new Date()` → la zona horaria del
  **proceso** (contenedor de la app).
- **SQL**: `condicionCarteraVencida()` (`:228`) usa `CURDATE()` → la zona horaria de la **sesión
  MySQL** (por defecto, el TZ del **servidor de BD**, otro contenedor).

En Railway, la app y la BD son contenedores separados, ambos probablemente en **UTC**. Colombia es
UTC-5. Entre las 19:00 y las 23:59 hora de Bogotá, en UTC ya es "mañana" → `CURDATE()` y el "hoy"
de JS pueden diferir un día. Consecuencia: una obligación puede aparecer como **vencida en la
cartera SQL pero no vencida según `esVencida()`** (o al revés), y `generarCanonesMensuales`
(`:87`, `:147`) puede generar el canon del mes equivocado en la franja nocturna.

El equipo ya mitigó parte del problema con `fechaLocalDesdeColumnaDate` (`:255`), pero eso solo
arregla la hidratación de columnas `type: 'date'`, no el desajuste entre los dos relojes.

## Estado actual

- `src/app.module.ts:30-49`: `TypeOrmModule.forRootAsync` — la config **no** setea `timezone`.
- `src/database/data-source.ts`: idem, sin `timezone`.
- `src/modules/obligaciones/obligaciones.service.ts`:
  - `:87` y `:147` → `const hoy = new Date();` (generación de canon)
  - `:228` → `AND ${alias}.fechaVencimiento <= CURDATE()` (cartera vencida, SQL)
  - `:238-242` → `esVencida(fechaVencimiento)`: `new Date()` + `getFullYear/Month/Date`
  - `:255-263` → `fechaLocalDesdeColumnaDate(valor)`: parsea "YYYY-MM-DD" por componentes
- `src/modules/dashboard/dashboard.service.ts:44` → `const inicioMes = new Date();` (recaudo del mes)
- Columnas de fecha: `type: 'date'` en `contrato` (52, 56), `novedad` (50), `obligacion` (38, 41);
  `type: 'datetime'` en `contrato` (79), `novedad` (91), `descuento-deposito` (52).
- `.env.example`: no tiene `TZ`.
- 188 tests. Un comentario en `obligaciones-canon.integration.spec.ts:85` ya menciona el
  "parseo ISO-UTC que corre el día en zona negativa".

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Lint / build | `npm run lint && npm run build` | exit 0 |
| Tests (TZ local) | `npm test` | 188 verde |
| Tests con TZ UTC | `TZ=UTC npm test` | 188 verde (hoy puede fallar alguno — ese es el punto) |
| Tests con TZ Bogotá | `TZ=America/Bogota npm test` | 188 verde |

## Scope

**In scope**:
- `src/app.module.ts` (añadir `timezone` a la config de TypeORM)
- `src/database/data-source.ts` (idem)
- `src/modules/obligaciones/obligaciones.service.ts` (unificar el "hoy" — ver Paso 2)
- `src/common/utils/fecha.util.ts` (ya existe — añadir un helper `hoyEnBogota()` si aplica)
- `.env.example` (`TZ`)
- Tests: `src/modules/obligaciones/obligaciones-canon.integration.spec.ts` (añadir casos con TZ),
  y/o un spec unit nuevo para `esVencida`
- `README.md` (variable `TZ` en la tabla de Railway — puede que el plan 015 ya la puso), `PRODUCCION.md`, `plans/README.md`

**Out of scope**:
- Migrar todas las columnas `datetime` a `timestamp` con TZ — es un rediseño; este plan **fija** el
  TZ para que `datetime` (naive) sea consistente.
- Los PDF (`formatoFechaCO(new Date())`) — solo formatean la fecha de emisión, no hacen aritmética.
- La expiración de refresh tokens (`auth.service.ts:36`) — compara dos `Date` absolutos, no
  depende del TZ.

## Git workflow

- Branch: `fix/022-zona-horaria`
- Conventional commits.

## Steps

### Step 1: Fijar `timezone` en la conexión TypeORM

En `src/app.module.ts`, dentro del objeto que devuelve `useFactory`, añade:
```ts
timezone: 'Z', // fuerza la sesión MySQL a UTC de forma explícita y determinista
```
Y lo mismo en `src/database/data-source.ts`.

> **Por qué `'Z'` (UTC) y no `'-05:00'`**: fijar la sesión MySQL a UTC hace que `CURDATE()` /
> `NOW()` sean UTC de forma predecible en cualquier host. Luego, en el Paso 2, el "hoy" de JS
> también se calcula en la **zona de negocio** (Bogotá) de forma explícita, y las comparaciones se
> hacen todas en el mismo marco. Fijar la BD a `-05:00` parece más directo pero se rompe si el
> proveedor no tiene la tabla de zonas cargada, y no maneja bien el histórico. UTC en la BD +
> conversión explícita en la app es el patrón robusto.

**Verify**: `grep -n "timezone" src/app.module.ts src/database/data-source.ts` → 2 resultados. `npm run build` → exit 0.

### Step 2: Unificar el "hoy" de negocio en `obligaciones.service.ts`

El problema real es que `CURDATE()` (ahora UTC, tras el Paso 1) y el "hoy" de `esVencida` deben
representar **el mismo día calendario de Bogotá**.

Cambia `condicionCarteraVencida` para no usar `CURDATE()` sino un parámetro con la fecha de hoy en
Bogotá calculada en JS, y pásalo desde el caller:
```ts
// antes
condicionCarteraVencida(alias = 'o'): string {
  return `(${this.condicionSaldoPendiente(alias)} AND ${alias}.fechaVencimiento <= CURDATE())`;
}
// después
condicionCarteraVencida(alias = 'o'): string {
  return `(${this.condicionSaldoPendiente(alias)} AND ${alias}.fechaVencimiento <= :hoyNegocio)`;
}
// y en parametrosCondicionSaldoPendiente() (o un método nuevo), añadir:
//   hoyNegocio: this.hoyNegocioISO()  // "YYYY-MM-DD" del día actual en America/Bogota
```

Añade el helper (en `src/common/utils/fecha.util.ts` — ya existe ese archivo):
```ts
/** "YYYY-MM-DD" del día calendario ACTUAL en la zona de negocio (America/Bogota), sea cual sea el TZ del proceso. */
export function hoyNegocioISO(zona = 'America/Bogota'): string {
  // en-CA da formato YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(new Date());
}
```

Y `esVencida` pasa a comparar contra ese mismo día:
```ts
esVencida(fechaVencimiento: Date | string): boolean {
  const venc = this.fechaLocalDesdeColumnaDate(fechaVencimiento); // ya existe
  const hoy = this.fechaLocalDesdeColumnaDate(hoyNegocioISO());
  return venc.getTime() <= hoy.getTime();
}
```

Revisa `obligaciones.service.ts:87` y `:147` (`const hoy = new Date()` para generar canon): si se
usan para decidir "qué mes generar", cámbialos por una fecha derivada de `hoyNegocioISO()` para
que la generación nocturna no salte de mes. Si solo se usan para un timestamp de registro
(`creadoEn`), déjalos.

**Verify**: `grep -n "CURDATE()" src/modules/obligaciones/obligaciones.service.ts` → sin resultados.
`npm run build` → exit 0.

### Step 3: Revisar `dashboard.service.ts:44`

`const inicioMes = new Date();` para "recaudo del mes actual". Si el servidor está en UTC y es
1 de mes 00:30 Bogotá (= 05:30 UTC del día 1, ok) — normalmente no hay problema con el primer día,
pero el último día del mes a las 23:00 Bogotá es día 1 del mes siguiente en UTC. Cambia el cálculo
del rango del mes para usar `hoyNegocioISO()` como base.

**Verify**: `npm run build && npm test` → exit 0, 188 verde.

### Step 4: `.env.example` y documentación

- `.env.example`, sección APP: `TZ=America/Bogota   # zona de negocio; afecta cartera, mora y generación de canon`
- `README.md` tabla de Railway: confirma que `TZ=America/Bogota` está (el plan 015 debería haberla
  puesto; si no, añádela).
- `PRODUCCION.md`, `### DATA-2`: marca `[x]` los 2 sub-ítems con "→ plan 022 (hecho)".

## Test plan

En `src/modules/obligaciones/obligaciones-canon.integration.spec.ts` (o un spec nuevo
`src/modules/obligaciones/vencimiento-tz.integration.spec.ts`):

- **Caso frontera de medianoche**: crea una obligación con `fechaVencimiento` = hoy en Bogotá.
  Con `process.env.TZ` forzado a `'UTC'` dentro del test (`beforeAll`/`afterAll` guardan y
  restauran), verifica que `esVencida()` y la query de `condicionCarteraVencida` **coinciden**
  (ambas la ven vencida, o ninguna).
- **Caso `TZ=America/Bogota`**: mismo test, mismo resultado.
- Unit para el helper: `hoyNegocioISO('UTC')` vs `hoyNegocioISO('America/Bogota')` — en la franja
  nocturna colombiana difieren en un día; el test puede mockear `Date` con `vi`/`jest.useFakeTimers`
  fijando "2026-01-15T02:00:00Z" (= 2026-01-14 21:00 Bogotá) y esperar `'2026-01-14'` para Bogotá
  y `'2026-01-15'` para UTC.

Patrón de spec de integración: cualquier `*.integration.spec.ts` del repo (usan `bootstrapTestApp`).
Patrón de unit: `src/common/utils/validar-secreto-jwt.util.spec.ts`.

**Verify**:
- `npm test` → 188 + nuevos, verde
- `TZ=UTC npm test` → verde (este es el que hoy podría fallar sin el fix)
- `TZ=America/Bogota npm test` → verde

## Done criteria

- [ ] `grep -n "timezone" src/app.module.ts src/database/data-source.ts` → 2 resultados
- [ ] `grep -n "CURDATE()" src/modules/obligaciones/obligaciones.service.ts` → sin resultados
- [ ] `npm test` y `TZ=UTC npm test` y `TZ=America/Bogota npm test` → los 3 en 188+ verde
- [ ] `.env.example` tiene `TZ=America/Bogota`
- [ ] Existe al menos un test que fuerza `TZ` y verifica la coherencia JS↔SQL del vencimiento
- [ ] `git status` sin archivos fuera de "In scope"
- [ ] `plans/README.md` fila 022 y `PRODUCCION.md` DATA-2 actualizados

## STOP conditions

- Cambiar `condicionCarteraVencida` para usar `:hoyNegocio` rompe algún caller que llama al método
  sin pasar los parámetros (busca `condicionCarteraVencida` y `parametrosCondicion` en todo el
  repo) — todos los callers deben incluir el parámetro nuevo.
- Con `TZ=UTC`, más de 2 tests fallan y no es por el vencimiento de fecha (p. ej. algún test que
  hardcodea una hora) — repórtalo.
- El helper `hoyNegocioISO` con `Intl.DateTimeFormat` + `timeZone` no funciona en el Node del CI
  (falta `full-icu`) — Node 20 trae ICU completo por defecto, pero si el CI usa una imagen
  recortada, verifica y reporta.
- Fijar `timezone: 'Z'` en TypeORM hace que las columnas `datetime` existentes se lean corridas
  (si se escribieron con otra sesión TZ) — en una BD nueva (primer deploy) no hay problema; si ya
  hay datos, **STOP y coordina** una estrategia de conversión.

## Maintenance notes

- Revisor: el foco es que `esVencida()` (JS) y la query de cartera vencida (SQL) den **siempre** el
  mismo veredicto para la misma obligación, en cualquier TZ de proceso.
- `Intl.DateTimeFormat` es la forma sin dependencias de hacer conversión de zona; si el manejo de
  fechas se complica (recurrencias, DST — Colombia no tiene DST, ventaja), considerar `Temporal`
  (cuando sea estable) o `date-fns-tz`.
- Todo `new Date()` nuevo en el motor financiero debe pasar por `hoyNegocioISO()` si representa "el
  día de hoy para reglas de negocio". Deja un comentario en `fecha.util.ts`.
- Este plan asume **primer deploy sin datos**. Si se importa data histórica, revisar cómo se
  escribieron las columnas `datetime`.
