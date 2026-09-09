# Plan 002: La protección del "último Administrador" es a prueba de concurrencia

> **Executor instructions**: Sigue este plan paso a paso. Ejecuta cada comando de
> verificación y confirma el resultado esperado antes de continuar. Si ocurre algo de
> "STOP conditions", detente y reporta. Al terminar, actualiza la fila de este plan en
> `plans/README.md`.
>
> **Drift check (ejecutar primero)**:
> `git diff --stat 0506b3d..HEAD -- src/modules/usuarios`
> Si `usuarios.service.ts` cambió, compara los excerpts de "Current state" contra el
> código real antes de continuar; si no coinciden, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (security-adjacent)
- **Planned at**: commit `0506b3d`, 2026-09-03

## Why this matters

`UsuariosService.actualizar()` protege contra dejar el sistema sin ningún Administrador activo:
antes de desactivar un admin (o quitarle el rol), cuenta cuántos admins activos quedan y rechaza
si es el último (`administradoresActivos <= 1`). Pero el `count()` y el `save()` **no están dentro
de una transacción ni toman ningún lock**. Es un TOCTOU (time-of-check-to-time-of-use) clásico:

> Hay exactamente 2 administradores activos. Dos requests concurrentes desactivan cada uno a
> **uno distinto** de los dos. Ambos ejecutan `count()` → obtienen `2` → ambos pasan la
> verificación (`2 > 1`) → ambos hacen `save()`. Resultado: **0 administradores activos**, y
> nadie puede volver a entrar a administrar usuarios.

Recuperarse de eso requiere tocar la base de datos a mano. La ventana es pequeña pero el impacto
es total (bloqueo administrativo del sistema). El resto del código financiero del repo ya usa
`dataSource.transaction(...)` + `setLock('pessimistic_write')` justo para este tipo de invariante;
este método quedó fuera.

## Current state

- `src/modules/usuarios/usuarios.service.ts` — servicio de usuarios (RBAC). El constructor
  **solo inyecta el repositorio**, no el `DataSource`:

```typescript
// src/modules/usuarios/usuarios.service.ts:12-13
@Injectable()
export class UsuariosService {
  constructor(@InjectRepository(Usuario) private readonly repo: Repository<Usuario>) {}
```

- Método `actualizar()` — estado actual completo:

```typescript
// src/modules/usuarios/usuarios.service.ts (~línea 52)
  async actualizar(id: string, dto: UpdateUsuarioDto, usuarioActualId?: string): Promise<Usuario> {
    const usuario = await this.obtener(id);

    const vaADesactivarse = dto.activo === false && usuario.activo;
    const vaAPerderRolAdmin =
      dto.rol !== undefined && dto.rol !== Rol.ADMINISTRADOR && usuario.rol === Rol.ADMINISTRADOR;

    if (usuarioActualId && id === usuarioActualId && (vaADesactivarse || vaAPerderRolAdmin)) {
      throw new ForbiddenException('No puedes desactivarte a ti mismo ni quitarte tu propio rol de Administrador.');
    }

    if (usuario.rol === Rol.ADMINISTRADOR && (vaADesactivarse || vaAPerderRolAdmin)) {
      const administradoresActivos = await this.repo.count({ where: { rol: Rol.ADMINISTRADOR, activo: true } });
      if (administradoresActivos <= 1) {
        throw new ConflictException(
          'No es posible desactivar o cambiar el rol del último Administrador activo del sistema.',
        );
      }
    }

    Object.assign(usuario, dto);
    return this.repo.save(usuario);
  }
```

- `obtener()` es un `findOne` simple (`usuarios.service.ts:37-41`).

### Repo conventions to follow

- **Patrón de transacción con lock pesimista** — ejemplo canónico en
  `src/modules/contratos/contratos.service.ts:238-276` (`reactivar`):

```typescript
  async reactivar(id: string, dto: ReactivarContratoDto, usuarioEmail: string): Promise<Contrato> {
    return this.dataSource.transaction(async (manager) => {
      const contrato = await manager
        .createQueryBuilder(Contrato, 'c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id })
        .getOne();
      // ... validaciones ...
      await manager.save(contrato);
    });
  }
```

  y `movimientos.service.ts:143-175` (`reversarManual`) — mismo patrón, con un comentario que
  explica exactamente por qué el lock evita la carrera (hallazgo CONC-02).
- `DataSource` se inyecta directamente en el constructor: `private readonly dataSource: DataSource`
  (ver `contratos.service.ts:24`, `movimientos.service.ts:35`). No hace falta tocar el módulo:
  `DataSource` es un provider global de `@nestjs/typeorm`.
- Excepciones tipadas de Nest, mensajes en español.
- Comentarios que explican el porqué de la no-obviedad (aquí: por qué el lock).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |
| Tests | `npm test` | todas verdes, exit 0 |
| Test filtrado | `npx jest usuarios.integration --runInBand` | el spec pasa |

> `npm test` necesita MariaDB en `localhost:3306` (`.env.test`). Si no arranca, STOP.

## Suggested executor toolkit

- Skill `nestjs-best-practices` disponible en `.claude/skills/nestjs-best-practices/` — lee
  `rules/db-use-transactions.md` antes del Step 2.

## Scope

**In scope**:
- `src/modules/usuarios/usuarios.service.ts`
- `src/modules/usuarios/usuarios.integration.spec.ts` (existe — añadir tests)

**Out of scope**:
- `src/modules/usuarios/usuarios.module.ts` — no necesita cambios (`DataSource` es global).
- `src/modules/usuarios/usuarios.controller.ts` — la firma pública de `actualizar` no cambia.
- Cualquier otro método de `UsuariosService` (`crear`, `cambiarPassword`, etc.) — no tienen
  este problema.
- No cambiar el mensaje ni el tipo de las excepciones existentes.

## Git workflow

- Rama: `advisor/002-toctou-ultimo-administrador`.
- Un commit. Mensaje estilo repo, ej: `BE-2: proteger el "último Administrador" contra carreras`.
- No push / no PR salvo instrucción.

## Steps

### Step 1: Inyectar DataSource

En `src/modules/usuarios/usuarios.service.ts`:

1. Importar `DataSource` de `typeorm` (junto a `Repository`).
2. Añadir al constructor: `private readonly dataSource: DataSource`.

```typescript
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
// ...
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
    private readonly dataSource: DataSource,
  ) {}
```

**Verify**: `npm run build` → exit 0 (Nest resuelve `DataSource` sin config extra).

### Step 2: Envolver `actualizar` en una transacción con lock

Reescribir el cuerpo de `actualizar()` para que:

1. Todo ocurra dentro de `this.dataSource.transaction(async (manager) => { ... })`.
2. La lectura del usuario objetivo tome lock: `manager.createQueryBuilder(Usuario, 'u').setLock('pessimistic_write').where('u.id = :id', { id }).getOne()` (lanzar `NotFoundException` si no existe — mismo mensaje que `obtener`).
3. **La verificación del "último admin" bloquee todas las filas de admin activo** para
   serializar dos desactivaciones concurrentes. En vez de `repo.count(...)`, hacer:

```typescript
      const adminsActivos = await manager
        .createQueryBuilder(Usuario, 'u')
        .setLock('pessimistic_write')
        .where('u.rol = :rol', { rol: Rol.ADMINISTRADOR })
        .andWhere('u.activo = true')
        .getMany();
      if (adminsActivos.length <= 1) {
        throw new ConflictException(
          'No es posible desactivar o cambiar el rol del último Administrador activo del sistema.',
        );
      }
```

   Como ambas transacciones intentan tomar `FOR UPDATE` sobre el mismo conjunto de filas de
   admin, la segunda espera a que la primera haga commit; entonces re-lee y ve `adminsActivos.length === 1` → rechaza. Invariante preservado.
4. El `save` final usa `manager.save(usuario)`.
5. La verificación de auto-desactivación (`usuarioActualId && id === usuarioActualId && ...`) se
   mantiene igual, dentro de la transacción, antes de la del último-admin.

Añadir un comentario encima del bloque del lock:

```typescript
      // Lock pesimista sobre TODAS las filas de admin activo: sin esto, dos requests que
      // desactivan cada una a un admin distinto de los dos últimos pasan ambas la verificación
      // "queda > 1" antes de que cualquiera guarde, y el sistema queda sin administradores
      // (mismo tipo de carrera que CONC-02 en movimientos).
```

**Verify**: `npm run build` → exit 0. `npm run lint` → exit 0.

### Step 3: Tests de integración

En `src/modules/usuarios/usuarios.integration.spec.ts`, añadir dos tests dentro del `describe`
existente:

1. **Regresión secuencial** (probablemente ya exista algo parecido — si ya hay un test que
   verifica que no se puede desactivar al último admin, NO lo dupliques, solo asegúrate de que
   sigue verde): crear 1 admin, intentar desactivarlo → `ConflictException`.
2. **Carrera**: crear 2 admins activos (A y B) + el que ejecuta la acción. Lanzar en paralelo
   `Promise.allSettled([ service.actualizar(A.id, { activo: false }, ejecutor.id), service.actualizar(B.id, { activo: false }, ejecutor.id) ])`.
   Afirmar que **al menos una** rechaza con `ConflictException` y que al final
   `repo.count({ where: { rol: ADMINISTRADOR, activo: true } })` es `>= 1`.

Usa como patrón estructural el test de carrera que ya existe en
`src/modules/movimientos/movimientos.integration.spec.ts` (busca `Promise.all` / "simultáne" /
"concurren" — hay un test CONC-02 de doble reverso concurrente que hace exactamente esto).

**Verify**: `npx jest usuarios.integration --runInBand` → todos los tests del archivo pasan,
incluidos los 1-2 nuevos.

### Step 4: Suite completa

**Verify**: `npm test` → exit 0, todo verde.

## Test plan

- **Archivo**: `src/modules/usuarios/usuarios.integration.spec.ts` (añadir, no crear).
- **Casos**: (a) no se puede desactivar al último admin (regresión secuencial, mantener si ya
  existe); (b) dos desactivaciones concurrentes de admins distintos → al menos una falla, y
  siempre queda ≥ 1 admin activo.
- **Patrón**: test de carrera de `movimientos.integration.spec.ts` (CONC-02).
- **Verificación**: `npm test` → todas pasan.

## Done criteria

- [ ] `npm run build` exit 0
- [ ] `npm run lint` exit 0
- [ ] `npm test` exit 0; el spec de usuarios tiene un test de carrera que pasa
- [ ] `grep -n "dataSource.transaction" src/modules/usuarios/usuarios.service.ts` → 1+ coincidencia
- [ ] `grep -n "\.count(" src/modules/usuarios/usuarios.service.ts` → **0** coincidencias en `actualizar` (se reemplazó por el `getMany` con lock; puede quedar en otros métodos si los hubiera)
- [ ] `git status --porcelain` no lista archivos fuera del scope
- [ ] Fila en `plans/README.md` actualizada

## STOP conditions

Detente y reporta si:

- `usuarios.service.ts` no coincide con "Current state".
- `npm test` no arranca por falta de MariaDB.
- El test de carrera pasa de forma inconsistente (flaky) tras dos ejecuciones — reportar, puede
  indicar que el nivel de aislamiento de la BD de test no soporta bien `SELECT ... FOR UPDATE`
  con `DB_SYNCHRONIZE=true` en tablas recién creadas.
- Descubres que `actualizar` es llamado desde algún seed o script fuera del controller con una
  firma distinta.

## Maintenance notes

- **Reviewer**: verificar que la transacción envuelve TODA la lógica (lectura con lock →
  validaciones → save), no solo el count; y que las excepciones se lanzan desde dentro de la
  transacción (Nest hace rollback automático al propagar).
- **Interacción futura**: si se añade un rol nuevo con privilegios administrativos, la
  protección de "último admin" debería revisarse para cubrirlo.
- **Nota de perf**: el lock sobre las filas de admin activo se mantiene solo durante la
  transacción de `actualizar` (milisegundos); el volumen de usuarios administradores es
  minúsculo, no hay impacto.
