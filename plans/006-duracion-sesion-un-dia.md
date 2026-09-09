# Plan 006: La sesión dura ~1 día (login diario), no 7

> **Executor instructions**: Sigue el plan paso a paso, verifica cada paso, respeta las
> STOP conditions, actualiza `plans/README.md` al terminar.
>
> **Drift check (primero)**:
> `git diff --stat 0506b3d..HEAD -- src/modules/auth/auth.service.ts .env.example .env.test`
> Si `auth.service.ts` cambió, compara con "Current state"; si no coincide, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security / config
- **Planned at**: commit `0506b3d`, 2026-09-03

## Why this matters

Hoy el refresh token dura **7 días** (`JWT_REFRESH_EXPIRES_IN=7d`), y se renueva en cada uso
(ventana deslizante): en la práctica el usuario se mantiene logueado una semana entera de
inactividad. El dueño quiere que la sesión dure **~1 día** — "iniciar sesión día a día": entras
en la mañana, dura toda la jornada, y si no tocas la app por ~1 día completo, vuelve a pedir
login. Es una herramienta interna que puede quedar abierta en un equipo compartido; una sesión
de 7 días es más superficie de la necesaria.

Cambio: bajar el default a `1d` y hacer que el parser de la expresión de expiración acepte
**horas** (`12h`) además de días, para poder afinar a 12h si se prefiere.

## Current state

### `src/modules/auth/auth.service.ts` (fragmento — `emitirTokens` y el parser)

```typescript
  private async emitirTokens(userId: string, email: string, rol: string) {
    // ... accessToken ...
    const refreshTokenPlano = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hash(refreshTokenPlano);
    const expiresInDias = this.parseDiasDesdeExpr(this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'));
    const expiraEn = new Date(Date.now() + expiresInDias * 24 * 60 * 60 * 1000);

    await this.refreshRepo.save(this.refreshRepo.create({ usuarioId: userId, tokenHash, expiraEn }));
    // ... return ...
  }

  private parseDiasDesdeExpr(expr: string): number {
    const match = /^(\d+)d$/.exec(expr);
    return match ? Number(match[1]) : 7;
  }
```

### Uso del `expiraEn` (validación — `auth.service.ts:36`)

```typescript
    if (!registro || registro.revocado || registro.expiraEn < new Date()) {
```

### `.env.example:20` y `.env.test:18`

```
JWT_REFRESH_EXPIRES_IN=7d
```

### El `.env` real del servidor

También tiene esa clave (o depende del default). El executor debe revisar si existe y
actualizarla; si no puede ver el `.env` (gitignored, o no está en la máquina), lo anota para el
dueño (ver Maintenance notes).

### Repo conventions

- Config vía `this.config.get('CLAVE', 'default')`.
- Métodos privados con nombre descriptivo en español.
- Comentarios que explican el porqué.
- Tests de integración con `@nestjs/testing` (`bootstrapTestApp()`), archivo
  `src/modules/auth/auth-login.integration.spec.ts`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |
| Tests | `npm test` | verde, exit 0 |
| Test filtrado | `npx jest auth --runInBand` | pasan |

> `npm test` necesita MariaDB en `localhost:3306` (`.env.test`). Si no arranca, STOP.

## Scope

**In scope**:
- `src/modules/auth/auth.service.ts` (el parser + su uso en `emitirTokens`)
- `.env.example`
- `.env.test`
- `src/modules/auth/auth-login.integration.spec.ts` (añadir 1 test)

**Out of scope**:
- El **access token** (`JWT_ACCESS_EXPIRES_IN=15m`) — no se toca; su renovación transparente es lo
  que hace que la sesión "de 1 día" sea fluida.
- La **entidad** `RefreshToken` y su migración — la columna `expiraEn` no cambia de tipo.
- Implementar un límite de vida ABSOLUTO de sesión (re-login forzado cada N horas sin importar la
  actividad) — es un cambio de lógica mayor (rastrear `sessionStartedAt` aparte del deslizante);
  se anota como follow-up, NO se hace aquí.
- El frontend — no necesita cambios (el plan FE-004 maneja el "reconectando" y no depende de la
  duración).

## Git workflow

- Rama: `advisor/006-duracion-sesion`.
- Un commit: `BE-6: sesión de ~1 día (JWT_REFRESH_EXPIRES_IN=1d) + parser de horas`.

## Steps

### Step 1: Generalizar el parser a días y horas

En `src/modules/auth/auth.service.ts`, reemplazar `parseDiasDesdeExpr` por un parser que
devuelva **milisegundos** y acepte `Nd` (días) y `Nh` (horas):

```typescript
  /**
   * Parsea una expresión de expiración ("7d", "1d", "12h") a milisegundos. Solo días y horas —
   * suficiente para la vida del refresh token. Cualquier formato desconocido cae a 1 día
   * (comportamiento seguro: sesión corta antes que sesión eterna).
   */
  private parseExpiracionAMs(expr: string): number {
    const match = /^(\d+)\s*([dh])$/.exec(expr.trim());
    if (!match) return 24 * 60 * 60 * 1000; // 1 día
    const valor = Number(match[1]);
    const unidadMs = match[2] === 'h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    return valor * unidadMs;
  }
```

Y en `emitirTokens`, reemplazar las dos líneas del cálculo por:

```typescript
    const expiraEn = new Date(
      Date.now() + this.parseExpiracionAMs(this.config.get('JWT_REFRESH_EXPIRES_IN', '1d')),
    );
```

(Nótese: el default del `.get` pasa de `'7d'` a `'1d'`.)

**Verify**: `npm run build` → exit 0. `npm run lint` → exit 0.
`grep -n "parseDiasDesdeExpr" src/` → **0** coincidencias (renombrado).

### Step 2: `.env.example` y `.env.test`

- `.env.example:20`: `JWT_REFRESH_EXPIRES_IN=7d` → `JWT_REFRESH_EXPIRES_IN=1d`
  Añadir un comentario encima:
  `# Vida del refresh token (sesión). "1d" = login diario. Acepta "Nd" (días) o "Nh" (horas).`
- `.env.test:18`: `JWT_REFRESH_EXPIRES_IN=7d` → `JWT_REFRESH_EXPIRES_IN=1d`

### Step 3: El `.env` real

- `ls -la .env` — si existe y contiene `JWT_REFRESH_EXPIRES_IN`, cambiar su valor a `1d`.
- Si `.env` **no existe** en la máquina, o no contiene esa clave (usa el default), no hacer nada
  aquí — anotarlo en las Maintenance notes para que el dueño lo ponga en el `.env` de producción.

**Verify**: `grep -rn "JWT_REFRESH_EXPIRES_IN" .env.example .env.test` → ambos muestran `1d`.

### Step 4: Test de integración

En `src/modules/auth/auth-login.integration.spec.ts`, añadir un test que verifique que un login
crea un `RefreshToken` cuya `expiraEn` está a ~1 día (con el `.env.test` ya en `1d`):

```typescript
  it('el refresh token de un login expira a ~1 día', async () => {
    const { refreshToken } = await service.login({ email: '<usuario de test>', password: '<pass>' });
    // buscar el registro de RefreshToken recién creado por su hash o por el usuario
    const registro = await testApp.dataSource
      .getRepository(RefreshToken)
      .findOne({ where: { /* usuarioId del test */ }, order: { creadoEn: 'DESC' } });
    const horas = (registro!.expiraEn.getTime() - Date.now()) / (60 * 60 * 1000);
    expect(horas).toBeGreaterThan(23);
    expect(horas).toBeLessThan(25);
  });
```

Adapta los detalles (cómo se hace login en ese spec, cómo se identifica el usuario) al patrón
que ya use el archivo. Si el archivo ya tiene un helper de login, úsalo.

**Verify**: `npx jest auth-login.integration --runInBand` → todos pasan, incl. el nuevo.

### Step 5: Suite completa

**Verify**: `npm test` → exit 0, sin regresiones.

## Test plan

- **Ajuste** a `auth-login.integration.spec.ts`: el refresh token de un login expira a ~24h.
- Verificar que ningún test existente asume 7 días (si alguno rompe, es señal de que dependía del
  valor viejo — reportar).
- **Verificación**: `npm test` → todo verde.

## Done criteria

- [ ] `npm run build` exit 0
- [ ] `npm run lint` exit 0
- [ ] `npm test` exit 0
- [ ] `grep -rn "parseDiasDesdeExpr" src/` → 0 coincidencias
- [ ] `grep -rn "JWT_REFRESH_EXPIRES_IN=7d" .env.example .env.test` → 0 coincidencias
- [ ] `grep -n "'1d'" src/modules/auth/auth.service.ts` → 1+ coincidencia (el default)
- [ ] El nuevo test de "expira a ~1 día" pasa
- [ ] `git status --porcelain` sin archivos fuera del scope (`.env` puede aparecer si existe y se editó)
- [ ] Fila en `plans/README.md` actualizada

## STOP conditions

- `auth.service.ts` no coincide con "Current state".
- Un test existente falla porque asumía 7 días — reportar.
- `npm test` no arranca por falta de MariaDB.
- Descubres que `JWT_REFRESH_EXPIRES_IN` se lee en algún otro lugar además de `emitirTokens`.

## Maintenance notes

- **ACCIÓN DEL DUEÑO tras el merge**: poner `JWT_REFRESH_EXPIRES_IN=1d` (o `12h`) en el `.env` de
  **producción**. Sin eso, el default del código (`1d`) aplica igual, pero conviene que el `.env`
  lo diga explícito.
- **Efecto en usuarios activos al desplegar**: los refresh tokens ya emitidos con 7 días siguen
  válidos hasta su `expiraEn` original; los nuevos (tras el próximo refresh) ya son de 1 día. La
  transición es suave, nadie se desloguea de golpe.
- **Reviewer**: confirmar que el parser cae a "1 día" (no "0" ni "infinito") ante un formato raro.
- **Follow-up NO hecho aquí**: si el dueño quiere un re-login forzado cada X horas
  *independiente de la actividad* (no deslizante), hace falta rastrear el inicio de sesión
  original (`sessionStartedAt`) y validarlo aparte del `expiraEn` deslizante. Es un plan propio.
