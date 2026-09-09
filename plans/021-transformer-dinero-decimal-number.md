# Plan 021: Transformer `decimal ↔ number` en todas las columnas de dinero (D-1 / D-4)

> **Executor instructions**: Sigue los pasos EN ORDEN. Este plan cambia cómo se hidrata cada
> columna de dinero — la suite de 188 tests es la red de seguridad, córrela tras cada paso.
> Respeta las STOP conditions. Actualiza `plans/README.md` al terminar.
>
> **Drift check**: `git diff --stat 0436315..HEAD -- src/modules/*/entities/ src/common/`
> Si cambió alguna entidad, revisa que la lista de columnas `decimal` de "Estado actual" siga vigente.

## Status

- **Priority**: P1 (integridad financiera — el fix keystone de consistencia de datos)
- **Effort**: M
- **Risk**: MED (toca la hidratación de 27 columnas en 13 entidades; mitigado por 188 tests)
- **Depends on**: none. **Bloquea al plan FE-019** (limpieza del dinero-como-string en el frontend).
- **Category**: bug
- **Planned at**: commit `0436315`, 2026-09-08

## Why this matters

El driver `mysql2` devuelve las columnas `DECIMAL` como **string** ("500000.00"). TypeORM no las
convierte, así que:
1. Cada respuesta JSON del API manda montos como string (`"canonValor": "500000.00"`), y el
   frontend los absorbe con `Number()` disperso y tipos `number | string` (hallazgo D-1 del lado FE).
2. En el propio backend, **cada** lectura de un monto en los services va envuelta en `Number(...)`
   — hay ~15 solo en `src/modules/recaudo/recaudo.service.ts` (`Number(c.montoDisponible)`,
   `Number(obligacion.valorOriginal)`, etc.). Olvidar uno = concatenación de strings en vez de
   suma, o `NaN`.

Un **transformer de columna** de TypeORM (`{ to, from }`) resuelve la raíz: la columna se hidrata
como `number` y se persiste como número. El JSON sale con números, el frontend deja de parchear, y
los `Number(...)` del backend pasan a ser no-ops seguros que se pueden limpiar.

## Estado actual

- `src/common/utils/dinero.util.ts`: `redondearMoneda(v)` = `Math.round(v*100)/100`,
  `esCeroMoneda(v)` = `Math.abs(v) < 0.005`. **No hay ningún transformer.**
- **27 columnas `@Column({ type: 'decimal', precision: 12, scale: 2, ... })`** en 13 entidades:
  - `caja/entities/arqueo-caja.entity.ts` — 7 columnas (líneas 18, 21, 24, 27, 30, 34, 38)
  - `contratos/entities/contrato.entity.ts` — 3 (62, 65, 68)
  - `empresa/entities/empresa.entity.ts` — 1 (45)
  - `inmuebles/entities/inmueble.entity.ts` — 2 (35, 38 nullable)
  - `movimientos/entities/movimiento.entity.ts` — 1 (45)
  - `novedades/entities/novedad.entity.ts` — 1 (66 nullable)
  - `obligaciones/entities/obligacion.entity.ts` — 3 (44, 47, 60)
  - `recaudo/entities/aplicacion-pago.entity.ts` — 2 (34, 46 nullable)
  - `recaudo/entities/descuento-deposito.entity.ts` — 1 (35)
  - `recaudo/entities/detalle-pago.entity.ts` — 1 (20)
  - `recaudo/entities/recibo-caja.entity.ts` — 3 (29, 37, 50)
  - `recaudo/entities/saldo-favor-credito.entity.ts` — 2 (29, 32)
  - (confirma con `grep -rn "type: 'decimal'" src/modules/*/entities/*.ts` — deben ser 27)
- Los TS de esas columnas ya están declarados como `number` en las entidades (el tipo TS miente
  hoy: en runtime es string).
- `src/modules/recaudo/recaudo.service.ts`: ~15 `Number(campo)` sobre esas columnas (líneas 72,
  122, 123, 267, 305, 446, 484, 490, 514, 519, 662, 748...). Otros services (`obligaciones`,
  `caja`, `movimientos`, `dashboard`, `contratos`) también tienen algunos — busca con
  `grep -rn "Number(" src/modules --include=*.ts | grep -v spec`.
- 188 tests. `.env.test` con `DB_SYNCHRONIZE=true` (esquema desde entidades).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Lint / build | `npm run lint && npm run build` | exit 0 |
| Tests | `npm test` | 188 verde (requiere BD local) |
| Contar columnas decimal | `grep -rcn "type: 'decimal'" src/modules/*/entities/*.ts \| awk -F: '{s+=$2} END{print s}'` | 27 |

## Scope

**In scope**:
- `src/common/utils/columna-numerica.transformer.ts` (crear)
- Las 13 entidades con columnas `decimal` listadas arriba (añadir `transformer:` a cada `@Column`)
- `src/modules/**/*.service.ts` — quitar los `Number(...)` que envuelven lecturas de esas columnas
  (Paso 3, con tests como gate)
- `src/common/utils/columna-numerica.transformer.spec.ts` (crear)
- `PRODUCCION.md`, `plans/README.md`

**Out of scope**:
- Cambiar `type: 'decimal'` a otra cosa (bigint de centavos, etc.) — es un rediseño mayor.
- Los DTOs de entrada (`@IsInt()` ya se aplicó en la ronda 2, plan 003) — este plan es solo la
  **salida** / hidratación.
- Columnas `date`/`datetime` — esas las trata el plan 022 (TZ).
- El frontend — es el plan FE-019, que depende de este.

## Git workflow

- Branch: `fix/021-transformer-dinero`
- Un commit por paso lógico (transformer + entidades en uno; limpieza de `Number()` en otro).

## Steps

### Step 1: Crear el transformer

`src/common/utils/columna-numerica.transformer.ts`:
```ts
import { ValueTransformer } from 'typeorm';

/**
 * El driver mysql2 devuelve las columnas DECIMAL como string ("500000.00"). Este transformer
 * las hidrata como `number` (y las persiste tal cual) para que:
 *  - las respuestas JSON del API manden montos como número, no string (hallazgo D-1);
 *  - los services no tengan que envolver cada lectura en `Number(...)`.
 * Un `null` (columna nullable sin valor) se mantiene como `null`.
 */
export const columnaNumerica: ValueTransformer = {
  to: (valor: number | null): number | null => valor,
  from: (valor: string | number | null): number | null =>
    valor === null || valor === undefined ? null : Number(valor),
};
```

**Verify**: `npm run build` → exit 0.

### Step 2: Aplicar el transformer a las 27 columnas

En cada entidad de la lista, a cada `@Column({ type: 'decimal', precision: 12, scale: 2, ... })`
añade `transformer: columnaNumerica` dentro del objeto de opciones, e importa
`import { columnaNumerica } from '<ruta relativa a>/common/utils/columna-numerica.transformer';`.

Ejemplo (`contrato.entity.ts:62`):
```ts
// antes
@Column({ type: 'decimal', precision: 12, scale: 2 })
canonValor: number;
// después
@Column({ type: 'decimal', precision: 12, scale: 2, transformer: columnaNumerica })
canonValor: number;
```

Hazlo entidad por entidad. Tras CADA entidad: `npm run build` → exit 0.
Tras las 13: `npm test`.

**Verify**:
- `grep -rn "type: 'decimal'" src/modules/*/entities/*.ts | grep -v "transformer: columnaNumerica"` → **sin resultados** (todas tienen el transformer).
- `npm test` → 188 verde.
  - Si fallan tests, **casi siempre** es porque un assert esperaba un string (`expect(x).toBe('500000.00')`) y ahora recibe `500000`. Corrige el assert al número. Si un test falla por **lógica** (un cálculo da distinto), **STOP y reporta** — el transformer no debería cambiar ningún resultado numérico.

### Step 3: Limpiar los `Number(...)` redundantes en los services

Ahora que las columnas ya son `number`, los `Number(campo)` sobre ellas son no-ops. Quítalos
**de a un archivo**, con `npm test` como gate tras cada archivo.

Empieza por `src/modules/recaudo/recaudo.service.ts` (el que más tiene). Para cada `Number(x)`:
- Si `x` es un campo de una entidad con columna decimal (de la lista) → quita el `Number(...)`,
  dejando solo `x`.
- Si `x` viene de un `getRawOne()` / `.select('SUM(...)')` (agregados SQL crudos) → **DÉJALO**.
  Los agregados de `getRawOne` SÍ vuelven como string y necesitan `Number()`. Ejemplos a NO tocar:
  `recaudo.service.ts:305` (`Number(saldoFavorDisponibleRaw)` de un `getRawOne`),
  `:446` (`Number(total)` de un `.select('COALESCE(SUM...)')`).
- Si `x` puede ser `?? 0` sobre un campo nullable (`Number(recibo.saldoFavorConsumido ?? 0)`) →
  el `?? 0` sigue siendo necesario (el campo puede ser `null`); puedes dejar `recibo.saldoFavorConsumido ?? 0`.

Repite para: `obligaciones.service.ts`, `caja.service.ts`, `movimientos.service.ts`,
`dashboard.service.ts`, `contratos.service.ts` — solo los `Number()` sobre campos de entidad.

**Verify tras cada archivo**: `npm test` → 188 verde.

### Step 4: Documentar

- `PRODUCCION.md`, `### DATA-1`: marca `[x]` los sub-ítems del backend ("transformer" y "tests")
  con "→ plan 021 (hecho)". Deja el del frontend para FE-019.

## Test plan

Crea `src/common/utils/columna-numerica.transformer.spec.ts` (unit puro, patrón =
`src/common/utils/validar-secreto-jwt.util.spec.ts`):
- `from('500000.00')` → `500000` (typeof number)
- `from('0.00')` → `0`
- `from(null)` → `null`
- `from(undefined)` → `null`
- `from(1234.56)` → `1234.56` (idempotente si ya es number)
- `to(500000)` → `500000`
- `to(null)` → `null`

Además, añade a un `*.integration.spec.ts` de recaudo un assert de que un endpoint que devuelve
montos los devuelve como `number`:
- p. ej. tras `registrarPago`, `typeof recibo.total === 'number'` y `typeof recibo.total !== 'string'`.

**Verify**: `npm test` → 188 + los nuevos, todo verde.

## Done criteria

- [ ] `grep -rn "type: 'decimal'" src/modules/*/entities/*.ts | grep -vc "transformer: columnaNumerica"` → `0`
- [ ] `npm run lint && npm run build && npm test` → exit 0, tests verde (con los nuevos)
- [ ] En `recaudo.service.ts`, los `Number(...)` restantes son SOLO sobre resultados de `getRawOne`/agregados SQL (revisar el diff)
- [ ] Un test de integración afirma `typeof <monto de una respuesta> === 'number'`
- [ ] `git status` sin archivos fuera de "In scope"
- [ ] `plans/README.md` fila 021 y `PRODUCCION.md` DATA-1 actualizados

## STOP conditions

- Un test falla porque un **cálculo** da un resultado numérico distinto (no un assert de tipo
  string→number) — el transformer no debe cambiar ningún número; investiga antes de seguir.
- Aplicar el transformer rompe una migración o el `synchronize:true` de los tests (TypeORM genera
  DDL distinto por el transformer — no debería, el transformer es solo runtime).
- Descubres columnas `decimal` con `precision`/`scale` distintos de `(12,2)` que quizás no son
  dinero (porcentajes, tasas) — NO les pongas el transformer sin confirmar que representan pesos.
  (`porcentajeMoraMensual` está huérfano tras el retiro de mora — verifica su tipo.)
- Hay más de 27 columnas `decimal` o menos — reconcilia la lista antes de seguir.

## Maintenance notes

- Revisor del PR: el diff de entidades debe ser mecánico (solo `transformer: columnaNumerica`
  añadido). El diff de services (Paso 3) merece lectura línea por línea: cada `Number()` quitado
  debe ser sobre un campo de entidad, nunca sobre un `getRawOne`.
- Cualquier `@Column` de dinero NUEVA debe llevar `transformer: columnaNumerica` — considera un
  lint rule o un comentario en `dinero.util.ts` que lo recuerde.
- El plan FE-019 depende de que este esté mergeado: después, el frontend puede quitar sus
  `Number()` y las uniones `number | string`.
- Los agregados de `getRawOne`/`query builder .select('SUM(...)')` seguirán devolviendo string —
  eso es de TypeORM, no lo arregla el transformer. Está bien; están contenidos.
