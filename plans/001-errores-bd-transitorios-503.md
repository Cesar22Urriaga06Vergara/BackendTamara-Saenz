# Plan 001: Los errores transitorios de base de datos devuelven 503, no 400

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de pasar al siguiente paso. Si
> ocurre algo de la sección "STOP conditions", detente y reporta — no improvises. Al
> terminar, actualiza la fila de estado de este plan en `plans/README.md`.
>
> **Drift check (ejecutar primero)**:
> `git diff --stat 0506b3d..HEAD -- src/common/filters/typeorm-exception.filter.ts src/common/filters`
> Si `typeorm-exception.filter.ts` cambió desde que se escribió este plan, compara los
> excerpts de "Current state" con el código real antes de continuar; si no coinciden, es
> una STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `0506b3d`, 2026-09-03

## Why this matters

`TypeOrmExceptionFilter` traduce cualquier `QueryFailedError` que no reconozca explícitamente
a **HTTP 400** ("Error al procesar la solicitud en base de datos"). Entre esos errores no
reconocidos están los **transitorios de concurrencia** de MariaDB: `ER_LOCK_DEADLOCK`
(deadlock, el motor mató una de las transacciones) y `ER_LOCK_WAIT_TIMEOUT` (espera de lock
agotada). El sistema usa bloqueos pesimistas (`SELECT ... FOR UPDATE`) de forma extensa en
recaudo, movimientos, obligaciones y contratos, así que estos errores **pueden ocurrir bajo
carga concurrente normal**.

Consecuencias de devolverlos como 400:
- El frontend trata el 400 como error del usuario: muestra el mensaje y **no reintenta**, aunque
  reintentar la misma operación casi siempre funciona (el deadlock es efímero).
- El monitoreo / logs de infraestructura no ven un 5xx, así que un problema real de contención
  de locks queda invisible.

Tras este cambio, los errores transitorios devuelven **503 Service Unavailable** con un mensaje
que invita a reintentar, y quedan distinguibles en logs.

## Current state

- `src/common/filters/typeorm-exception.filter.ts` — filtro global de excepciones registrado en
  `src/main.ts:17` (`app.useGlobalFilters(new TypeOrmExceptionFilter())`). Captura solo
  `QueryFailedError` (`@Catch(QueryFailedError)`). Estado actual completo:

```typescript
// src/common/filters/typeorm-exception.filter.ts
import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch(QueryFailedError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const driverError = (exception as any).driverError ?? {};
    const codigo: string | undefined = driverError.code;

    const mapeo: Record<string, () => HttpException> = {
      ER_DUP_ENTRY: () => new ConflictException('Ya existe un registro con ese valor único.'),
      ER_NO_REFERENCED_ROW_2: () => new HttpException('El registro referenciado no existe o ya fue eliminado.', 400),
      ER_ROW_IS_REFERENCED_2: () =>
        new HttpException(
          'No es posible completar la operación: hay registros relacionados que dependen de este.',
          409,
        ),
      ER_BAD_NULL_ERROR: () => new HttpException('Falta un valor obligatorio para completar el registro.', 400),
      ER_DATA_TOO_LONG: () => new HttpException('Uno de los valores enviados excede la longitud permitida.', 400),
    };

    const httpException =
      codigo && mapeo[codigo]
        ? mapeo[codigo]()
        : new HttpException('Error al procesar la solicitud en base de datos.', 400);
    const status = httpException.getStatus();
    const body = httpException.getResponse();

    response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}
```

### Repo conventions to follow

- **Excepciones tipadas de NestJS**: los services lanzan `NotFoundException` / `BadRequestException`
  / `ConflictException` / `ForbiddenException`. Para 503 usar `ServiceUnavailableException` de
  `@nestjs/common` (existe desde Nest 8).
- **Mensajes de error en español**, orientados al usuario final (ver los mensajes del `mapeo` actual).
- **Comentarios**: el repo comenta el "por qué" de cada decisión no obvia (ver el docstring del
  propio filtro). Añade un comentario explicando por qué estos códigos son transitorios.
- No hay logger estructurado en el proyecto; **no** añadas logging aquí (fuera de alcance).

## Commands you will need

| Purpose   | Command                                    | Expected on success |
|-----------|--------------------------------------------|---------------------|
| Lint      | `npm run lint`                             | exit 0, sin salida de error |
| Build     | `npm run build`                            | exit 0 |
| Tests     | `npm test`                                 | `Test Suites: N passed`, `Tests: M passed`, exit 0 |
| Test filtrado | `npx jest typeorm-exception --runInBand` | el nuevo spec pasa |

> `npm test` necesita una MariaDB accesible en `localhost:3306` (config en `.env.test`,
> `DB_DATABASE=tamara_saenz_db_test`, `DB_SYNCHRONIZE=true`). Si no arranca, es una STOP condition.

## Scope

**In scope** (únicos archivos a modificar/crear):
- `src/common/filters/typeorm-exception.filter.ts`
- `src/common/filters/typeorm-exception.filter.spec.ts` (crear)

**Out of scope** (NO tocar):
- `src/main.ts` — el filtro ya está registrado, no cambia el registro.
- Cualquier service — no se añade lógica de reintento en el servidor; el reintento es
  responsabilidad del cliente y queda para otro plan.
- No añadir un catch-all filter para excepciones no-`QueryFailedError` (fuera de alcance).

## Git workflow

- Rama: `advisor/001-errores-bd-transitorios-503` (créala desde la rama actual).
- Un commit. Estilo de mensaje del repo (ver `git log --oneline -5`): título en modo
  descriptivo, cuerpo explicando el porqué. Ejemplo real del repo:
  `JWT-01: usar getOrThrow para el secreto de acceso (fail-loud)`.
- NO hacer push ni abrir PR salvo que el operador lo pida.

## Steps

### Step 1: Mapear los códigos transitorios de MariaDB a 503

En `src/common/filters/typeorm-exception.filter.ts`:

1. Importar `ServiceUnavailableException` junto a los otros imports de `@nestjs/common`.
2. Añadir al objeto `mapeo` estas tres entradas (los tres códigos que MariaDB/mysql2 emite
   para contención de locks):

```typescript
      ER_LOCK_DEADLOCK: () =>
        new ServiceUnavailableException(
          'El sistema está procesando otra operación sobre los mismos datos. Vuelve a intentarlo.',
        ),
      ER_LOCK_WAIT_TIMEOUT: () =>
        new ServiceUnavailableException(
          'La operación tardó demasiado esperando a que se liberaran los datos. Vuelve a intentarlo.',
        ),
      ER_QUERY_INTERRUPTED: () =>
        new ServiceUnavailableException('La consulta fue interrumpida. Vuelve a intentarlo.'),
```

3. Añadir un comentario encima de esas tres entradas:

```typescript
      // Errores TRANSITORIOS de concurrencia: el motor abortó/expiró una transacción por
      // contención de locks (el sistema usa SELECT ... FOR UPDATE extensamente). Reintentar
      // la misma operación casi siempre funciona — por eso 503 (retryable) y no 400.
```

**Verify**: `npm run build` → exit 0. `npm run lint` → exit 0.

### Step 2: Escribir el spec del filtro

Crear `src/common/filters/typeorm-exception.filter.spec.ts`. Este es un **unit test puro** (no
necesita base de datos): se construye un `QueryFailedError` falso con el `driverError.code`
deseado y se verifica el status y el body que el filtro escribe en un `Response` simulado.

Estructura (no hay otro spec de filtro en el repo que copiar; sigue este patrón):

```typescript
import { QueryFailedError } from 'typeorm';
import { TypeOrmExceptionFilter } from './typeorm-exception.filter';

function ejecutarFiltro(code: string | undefined) {
  const filtro = new TypeOrmExceptionFilter();
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host: any = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  };
  const error = new QueryFailedError('SELECT 1', [], new Error('x') as any);
  (error as any).driverError = code ? { code } : {};
  filtro.catch(error, host);
  return { statusCode: status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
}

describe('TypeOrmExceptionFilter', () => {
  it('mapea ER_LOCK_DEADLOCK a 503 (transitorio, reintentable)', () => {
    const { statusCode, body } = ejecutarFiltro('ER_LOCK_DEADLOCK');
    expect(statusCode).toBe(503);
    expect(JSON.stringify(body)).toMatch(/intentarlo/i);
  });

  it('mapea ER_LOCK_WAIT_TIMEOUT a 503', () => {
    expect(ejecutarFiltro('ER_LOCK_WAIT_TIMEOUT').statusCode).toBe(503);
  });

  it('mapea ER_DUP_ENTRY a 409 (sin cambio)', () => {
    expect(ejecutarFiltro('ER_DUP_ENTRY').statusCode).toBe(409);
  });

  it('un código de BD desconocido sigue devolviendo 400', () => {
    expect(ejecutarFiltro('ER_ALGO_RARO').statusCode).toBe(400);
  });

  it('sin código de driver devuelve 400', () => {
    expect(ejecutarFiltro(undefined).statusCode).toBe(400);
  });
});
```

**Verify**: `npx jest typeorm-exception --runInBand` → 5 tests pasan.

### Step 3: Suite completa

**Verify**: `npm test` → todas las suites en verde, exit 0. El total de tests debe subir en 5.

## Test plan

- **Nuevo archivo**: `src/common/filters/typeorm-exception.filter.spec.ts` (unit test, sin BD).
- **Casos cubiertos**: `ER_LOCK_DEADLOCK` → 503, `ER_LOCK_WAIT_TIMEOUT` → 503, regresión de
  `ER_DUP_ENTRY` → 409, código desconocido → 400, sin código → 400.
- **Patrón estructural**: no hay otro spec de filtro; usa el helper `ejecutarFiltro` de arriba.
- **Verificación**: `npm test` → todas pasan, incluyendo las 5 nuevas.

## Done criteria

Todos deben cumplirse:

- [ ] `npm run build` exit 0
- [ ] `npm run lint` exit 0
- [ ] `npm test` exit 0; existe `typeorm-exception.filter.spec.ts` con 5 tests que pasan
- [ ] `grep -n "ER_LOCK_DEADLOCK\|ER_LOCK_WAIT_TIMEOUT" src/common/filters/typeorm-exception.filter.ts` → 2+ coincidencias
- [ ] `grep -n "ServiceUnavailableException" src/common/filters/typeorm-exception.filter.ts` → 1+ coincidencia
- [ ] `git status --porcelain` no lista archivos fuera del scope
- [ ] Fila de este plan actualizada en `plans/README.md`

## STOP conditions

Detente y reporta (no improvises) si:

- `typeorm-exception.filter.ts` no coincide con el excerpt de "Current state" (el código cambió
  desde que se escribió este plan).
- `npm test` no puede arrancar por falta de MariaDB en `localhost:3306`.
- Descubres que el proyecto ya migró a otro driver de BD (no `mysql2`/MariaDB) — los códigos
  de error cambiarían.
- Un paso de verificación falla dos veces tras un intento razonable de arreglo.

## Maintenance notes

- **Para quien revise el PR**: confirmar que los tres códigos añadidos son efectivamente los de
  MariaDB/mysql2 para contención de locks (no inventados), y que ningún código existente cambió
  de status.
- **Interacción futura**: si algún día se añade retry automático del lado servidor (p. ej. un
  interceptor que reintenta transacciones abortadas), este filtro seguirá siendo la última red
  para las que agoten los reintentos.
- **Diferido explícitamente**: el reintento del lado del cliente (frontend) ante un 503 —
  es un cambio de frontend y va en su propio plan.
