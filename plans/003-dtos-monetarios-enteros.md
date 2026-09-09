# Plan 003: Los montos de dinero se validan como enteros en toda la API

> **Executor instructions**: Sigue el plan paso a paso, verifica cada paso, respeta las
> STOP conditions, actualiza `plans/README.md` al terminar.
>
> **Drift check (primero)**:
> `git diff --stat 0506b3d..HEAD -- src/modules/inmuebles/dto src/modules/caja src/modules/empresa/dto`
> Si algún DTO citado cambió, compara contra "Current state"; si no coincide, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt (dinero)
- **Planned at**: commit `0506b3d`, 2026-09-03

## Why this matters

El negocio opera en **pesos colombianos enteros, sin centavos** — es una decisión explícita
(hallazgo B2/B3 de la auditoría contable 2026-09-01: "COP no maneja centavos"). El motor de pago
ya migró todos sus DTOs a `@IsInt()` (`registrar-pago.dto.ts`, `liquidar-deposito.dto.ts`,
`create-contrato.dto.ts`, `aprobar-*.dto.ts`, etc.). Pero **cuatro campos de dinero quedaron como
`@IsNumber()`**, que acepta decimales:

- `canonValor` y `depositoValor` de un inmueble — se copian tal cual a `Contrato.canonValor` y de
  ahí a `Obligacion.valorOriginal` de cada canon generado.
- `saldoContado` de un arqueo de caja — alimenta el cálculo de `diferencia` (cuadre de caja).
- `saldoInicialCaja` de la empresa — punto de partida de todo el saldo esperado de caja.

Enviar por API un `canonValor: 500000.37` hoy pasa la validación. La columna `decimal(12,2)` lo
trunca y `esCeroMoneda` (umbral < 0.005) evita obligaciones fantasma en PARCIAL, así que **no hay
un bug reproducido en producción** — pero es una grieta de validación de entrada en los datos
más sensibles del sistema, y una inconsistencia con el resto de la API. Coste bajo, cierre limpio.

Además, `CajaService.registrarArqueo` calcula `diferencia` con `Math.round(x*100)/100` inline en
vez de usar `redondearMoneda` del util central — el mismo tipo de inconsistencia que B2 corrigió
en el motor de pago. Se alinea aquí de paso (mismo archivo, mismo tema).

## Current state

### `src/modules/inmuebles/dto/create-inmueble.dto.ts` (completo)

```typescript
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { EstadoInmueble } from '../entities/inmueble.entity';

export class CreateInmuebleDto {
  @IsOptional() @IsUUID() propietarioId?: string;

  @IsString() direccion: string;
  @IsString() barrio: string;

  @IsNumber() @Min(0) canonValor: number;
  @IsOptional() @IsNumber() @Min(0) depositoValor?: number;

  @IsOptional() @IsString() codigoEnergia?: string;
  @IsOptional() @IsString() codigoAgua?: string;
  @IsOptional() @IsString() codigoGas?: string;

  @IsOptional() @IsEnum(EstadoInmueble) estado?: EstadoInmueble;
  @IsOptional() @IsString() observaciones?: string;
}
```

`src/modules/inmuebles/dto/update-inmueble.dto.ts` hace `extends PartialType(CreateInmuebleDto)` —
hereda automáticamente el cambio.

### `src/modules/caja/dto/registrar-arqueo.dto.ts` (completo)

```typescript
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** Conteo físico real de caja, ingresado por el Administrador al cerrar un arqueo (§15). */
export class RegistrarArqueoDto {
  @IsNumber() @Min(0) saldoContado: number;
  @IsOptional() @IsString() observaciones?: string;
}
```

### `src/modules/empresa/dto/update-empresa.dto.ts` (fragmento)

```typescript
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
// ...
  @IsOptional()
  @IsNumber()
  @Min(0)
  saldoInicialCaja?: number;
```

### `src/modules/caja/caja.service.ts:70` (dentro de `registrarArqueo`)

```typescript
      diferencia: Math.round((dto.saldoContado - saldoEsperado) * 100) / 100,
```

`src/common/utils/dinero.util.ts` exporta `redondearMoneda(n: number): number` (redondeo a 2
decimales) — se usa en `obligaciones.service.ts` y `recaudo.service.ts`.

### Cómo lo hace el resto de la API (patrón a seguir)

`src/modules/contratos/dto/create-contrato.dto.ts:37`:

```typescript
  /** COP no maneja centavos (hallazgo B3 de la auditoría contable 2026-09-01). */
  @IsOptional() @IsInt() @Min(0) depositoGarantia?: number;
```

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |
| Tests | `npm test` | verde, exit 0 |
| Test filtrado | `npx jest inmuebles.integration caja.integration --runInBand` | pasan |

> `npm test` necesita MariaDB en `localhost:3306`. Si no arranca, STOP.

## Scope

**In scope**:
- `src/modules/inmuebles/dto/create-inmueble.dto.ts`
- `src/modules/caja/dto/registrar-arqueo.dto.ts`
- `src/modules/empresa/dto/update-empresa.dto.ts`
- `src/modules/caja/caja.service.ts` (solo la línea de `diferencia`)
- `src/modules/inmuebles/inmuebles.integration.spec.ts` (añadir 1 test)
- `src/modules/caja/caja.integration.spec.ts` (añadir 1 test, si el archivo existe; si no, crear)

**Out of scope**:
- `src/modules/inmuebles/dto/update-inmueble.dto.ts` — hereda vía `PartialType`, no se toca.
- Las **entidades** y **migraciones** — las columnas ya son `decimal(12,2)`; no se cambian
  (un `@IsInt` en el DTO no requiere cambio de columna).
- Cualquier otro DTO — el resto del sistema ya está en `@IsInt`.
- El frontend — `UiMoneyInput` ya envía enteros (`replace(/\D/g,'')`); no hay que tocarlo.

## Git workflow

- Rama: `advisor/003-dtos-monetarios-enteros`.
- Un commit, mensaje estilo repo: `BE-9: montos de dinero como @IsInt en toda la API`.

## Steps

### Step 1: `create-inmueble.dto.ts` → `@IsInt`

- Cambiar el import: `IsNumber` → `IsInt` (revisar si `IsNumber` se usa en otro campo del
  archivo; según el excerpt, no — entonces se elimina del import).
- `canonValor`: `@IsInt() @Min(0) canonValor: number;`
- `depositoValor`: `@IsOptional() @IsInt() @Min(0) depositoValor?: number;`
- Añadir el comentario del patrón: `/** COP no maneja centavos (hallazgo B3 de la auditoría contable 2026-09-01). */` encima de `canonValor`.

**Verify**: `npm run build` → exit 0. `npm run lint` → exit 0.

### Step 2: `registrar-arqueo.dto.ts` → `@IsInt`

- `IsNumber` → `IsInt` en import y decorador de `saldoContado`.

### Step 3: `update-empresa.dto.ts` → `@IsInt`

- `saldoInicialCaja`: `@IsNumber()` → `@IsInt()`. `IsInt` ya está importado (lo usa
  `horizonteMesesCanon`). Verificar si `IsNumber` queda sin uso tras el cambio; si sí, quitarlo
  del import.

**Verify**: `npm run build` → exit 0. `npm run lint` → exit 0.

### Step 4: `caja.service.ts` — usar `redondearMoneda`

- Importar `redondearMoneda` de `../../common/utils/dinero.util` (ver cómo lo importa
  `recaudo.service.ts`).
- Cambiar la línea de `diferencia`:

```typescript
      diferencia: redondearMoneda(dto.saldoContado - saldoEsperado),
```

**Verify**: `npm run build` → exit 0.

### Step 5: Tests

**`inmuebles.integration.spec.ts`** — añadir un test: crear un inmueble vía
`InmueblesService.crear` (o el método que use el spec) con `canonValor` entero → OK; el spec
actual probablemente ya cubre el happy path, así que basta con **añadir**: que la entidad
guardada tiene `Number(inmueble.canonValor) === <valor entero enviado>`. (La validación `@IsInt`
solo se dispara vía HTTP/`ValidationPipe`, no llamando al service directo — así que aquí no se
puede probar el rechazo de decimales; ese comportamiento se cubre en el siguiente punto.)

**Test de DTO** — crear `src/modules/inmuebles/dto/create-inmueble.dto.spec.ts` siguiendo el
patrón de `src/modules/personas/dto/create-persona.dto.spec.ts` (ese archivo existe y usa
`plainToInstance` + `validate`):

```typescript
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInmuebleDto } from './create-inmueble.dto';

describe('CreateInmuebleDto — montos enteros', () => {
  const base = { direccion: 'Calle 1', barrio: 'Centro' };

  it('rechaza canonValor con decimales', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...base, canonValor: 500000.5 });
    const errores = await validate(dto);
    expect(errores.some((e) => e.property === 'canonValor')).toBe(true);
  });

  it('acepta canonValor entero', async () => {
    const dto = plainToInstance(CreateInmuebleDto, { ...base, canonValor: 500000 });
    expect(await validate(dto)).toHaveLength(0);
  });
});
```

**`caja.integration.spec.ts`** — si existe, añadir/ajustar un test que verifique que
`diferencia` de un arqueo con `saldoContado` y `saldoEsperado` enteros da un entero exacto
(sin `.00000001`). Si el archivo NO existe, **no lo crees** — anótalo en las Maintenance notes y
sáltate este sub-paso (el cambio de `redondearMoneda` es equivalente numérico al `Math.round`
para enteros, riesgo nulo).

**Verify**: `npx jest inmuebles.integration create-inmueble.dto caja.integration --runInBand` →
todos pasan.

### Step 6: Suite completa

**Verify**: `npm test` → exit 0.

## Test plan

- **Nuevo**: `src/modules/inmuebles/dto/create-inmueble.dto.spec.ts` — rechaza decimales, acepta
  enteros. Patrón: `personas/dto/create-persona.dto.spec.ts`.
- **Ajuste**: `inmuebles.integration.spec.ts` — la entidad guardada conserva el entero.
- **Opcional** (solo si el archivo existe): `caja.integration.spec.ts` — `diferencia` exacta.
- **Verificación**: `npm test` → todas pasan.

## Done criteria

- [ ] `npm run build` exit 0
- [ ] `npm run lint` exit 0
- [ ] `npm test` exit 0
- [ ] `grep -rn "@IsNumber" src/modules/inmuebles/dto src/modules/caja/dto src/modules/empresa/dto` → **0** coincidencias sobre campos de dinero (`canonValor`, `depositoValor`, `saldoContado`, `saldoInicialCaja`)
- [ ] `grep -n "redondearMoneda" src/modules/caja/caja.service.ts` → 1+ coincidencia
- [ ] `grep -n "Math.round" src/modules/caja/caja.service.ts` → 0 coincidencias
- [ ] `create-inmueble.dto.spec.ts` existe y pasa
- [ ] `git status --porcelain` sin archivos fuera del scope
- [ ] Fila en `plans/README.md` actualizada

## STOP conditions

- Algún DTO no coincide con "Current state".
- `IsNumber` resulta estar en uso por un campo **no monetario** en alguno de los archivos — en
  ese caso NO lo quites del import, solo cambia el decorador del campo de dinero.
- `npm test` no arranca por falta de MariaDB.
- Al cambiar `saldoInicialCaja` a `@IsInt`, algún test de empresa/config falla porque envía un
  decimal a propósito — reportar (podría haber una razón).

## Maintenance notes

- **Reviewer**: confirmar que ninguna **entidad** ni **migración** se tocó (solo DTOs + una línea
  de service). Las columnas `decimal(12,2)` se quedan como están a propósito (tolerancia a datos
  históricos).
- **Interacción futura**: si algún día el negocio empieza a manejar centavos (poco probable en
  COP), revertir estos `@IsInt` a `@IsNumber` y revisar `dinero.util.ts`.
- **Diferido**: si `caja.integration.spec.ts` no existe, la cobertura de `registrarArqueo` sigue
  siendo baja — se aborda en el plan de cobertura de tests (no en este).
