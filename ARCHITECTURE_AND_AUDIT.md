# ARCHITECTURE_AND_AUDIT.md — Backend (Inversiones Tamara & Saenz S. En C.)

**Documento oficial único de arquitectura y auditoría del backend.** Reemplaza y consolida:
`# AUDITORIA_SISTEMA.md`, `AUDITORIA_QUIRURGICA_SEGUNDA_GENERACION.md`, `AUDITORIA_ROLES_Y_PERMISOS.md`,
`ANALISIS_FUNCIONALIDADES.md` — los originales ya consolidados viven ahora, solo por trazabilidad,
en `documentacion/backendocu/archivo/`. No reemplaza `README.md` (bitácora
viva de cambios), `AGENTS.md` (reglas de trabajo para agentes), ni `PREGUNTAS_NEGOCIO.md` (documento de
negocio activo, no de auditoría) — esos tres siguen siendo documentos independientes y vigentes.

Metodología: todo lo afirmado aquí fue verificado leyendo el código fuente real (entidades, servicios,
controladores, guards, DTOs) el 2026-09-03, no copiado de auditorías previas. Donde una auditoría previa
decía algo que el código contradice, se indica explícitamente. Donde no se pudo verificar algo con certeza,
se marca **NO DETERMINADO / REQUIERE VALIDACIÓN** en vez de inventarlo.

> Fe de erratas 2026-09-04: §8 (rutas de auth y novedades), §7/§17 (25 migraciones), §2 (sí hay CI),
> §21 Alto 9 (era real, ya corregido), §18 (los 3 hallazgos ya corregidos en la ronda 1 de
> correcciones).
>
> ⚠️ **Snapshot del 2026-09-03/04.** La arquitectura, el modelo de datos, las reglas de negocio y
> la §20 (verificación de hallazgos) siguen vigentes. Lo que cambió después (ronda 4, ver
> `plans/README.md` y `PRODUCCION.md` para el detalle):
> - **BD: MariaDB 10.4 → MySQL 8** (`type: 'mysql'`, plan BE-016). Donde este doc diga "MariaDB",
>   léase "MySQL 8". Las columnas `GENERATED ALWAYS AS ... STORED` se conservan (compatibles).
> - Suite: 188 → **212 tests**.
> - Añadido: `GET /api/v1/health` (018), Sentry back+front (019/FE-018), logging `pino` +
>   `x-request-id` (020), transformer `decimal→number` en las 27 columnas de dinero (021),
>   `hoyNegocioISO()` para cartera/canon (022).
> - Frontend desplegable a Cloudflare Pages (SPA estática, FE-017) + Sentry (FE-018).

> **Línea base verificada el 2026-09-10:** `npm test` pasa con **214 tests en 32 suites**; `npm run
> lint` y `npm run build` pasan. Esta verificación no sustituye una auditoría funcional completa ni
> valida por sí sola las afirmaciones históricas de este documento.

> La línea base actualizada tras las guardias de producción y la migración P-4 es de **227 tests** y
> **26 migraciones TypeScript**. El CI ejecuta `migration:run` contra MySQL 8 efímero antes de la suite.

> La revisión financiera final del 2026-09-10 añadió guardias contra descuentos de depósito sobredimensionados,
> anulación directa de recibos internos y carreras entre estado/aprobación de novedades. La suite actual es
> de **229 tests**.

---

## 1. Resumen ejecutivo

Backend NestJS 11 + TypeORM + MariaDB para una herramienta interna de gestión de arrendamientos de
"Inversiones Tamara & Saenz". **No es un ERP inmobiliario completo**: por decisión de negocio explícita
(`ESPECIFICACION_MAESTRA_NEGOCIO.md` §2) excluye comisiones a propietarios, liquidación/pagos a
propietarios, integración tributaria (DIAN/IVA/facturación electrónica) y cualquier función de
intermediación no documentada.

El sistema pasó por una auditoría profunda y una reescritura amplia entre 2026-08-18 y 2026-09-01
(ver README, sección "Retiro del costo de mora + auditoría contable"). La inmensa mayoría de los
hallazgos CRÍTICOS y ALTOS de las cuatro auditorías previas están **confirmados como corregidos en el
código actual** (evidencia por archivo/línea en la §20). Quedan **dos hallazgos reales aún vigentes**
(uno de inmutabilidad en reversión de depósito, uno de UX/backend en reactivación de contratos — ver §17
y §20) y una **deuda técnica de tipado estricto Frontend↔Backend** que es real pero de riesgo bajo dado
que es una herramienta interna de un solo equipo.

Motor financiero: sólido, con bloqueos pesimistas (`pessimistic_write`) y columnas `GENERATED ALWAYS AS`
únicas en MariaDB para invariantes críticos (un solo contrato ACTIVO por inmueble, un solo canon por
periodo), corrección por reversos trazables (nunca edición in-place) en la inmensa mayoría de los flujos,
y una única función pura (`calcularPlanAplicacion`) compartida entre pago real y simulación — la garantía
más fuerte de todo el sistema, porque hace estructuralmente imposible que la previsualización mienta.

## 2. Estado actual

- Backend y frontend compilan y tienen suites de test que corren (13+ specs de integración backend con
  Jest; 1 spec de frontend con Vitest — ver §16).
- El costo de mora fue retirado del sistema el 2026-09-01 (decisión de negocio). Quedan restos deliberados
  y marcados `@deprecated` en el modelo de datos para poder revertir recibos históricos que sí tuvieron
  mora — esto es el diseño correcto para no perder capacidad de auditar el pasado, no un descuido.
- El sistema está operativo y en uso interno. CI en `.github/workflows/ci.yml` — lint, build y
  tests de integración contra MariaDB; se dispara solo en `main` (no en ramas de feature). No hay
  evidencia de una capa de staging.

## 3. Arquitectura real

Monolito modular NestJS, 15 módulos de dominio bajo `src/modules/`, más `src/common/` (guards, decorators,
interceptors, utils compartidos) y `src/database/` (configuración TypeORM/migraciones). Cada módulo sigue
el patrón estándar Nest: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `entities/`, `dto/`, y (en los
módulos financieros/críticos) `*.integration.spec.ts` co-ubicado en la misma carpeta.

Guards globales, en orden (`app.module.ts`): `JwtAuthGuard` → `RolesGuard` → `AuditInterceptor` (global,
vía `APP_INTERCEPTOR`). `RolesGuard` es **fail-closed**: cualquier método mutante (POST/PUT/PATCH/DELETE)
sin `@Roles(...)` explícito es denegado por defecto; los métodos GET sin `@Roles` quedan abiertos a
cualquier usuario autenticado (diseño intencional, no bug — la mayoría de endpoints de lectura son
compartidos entre ambos roles).

## 4. Stack tecnológico

| Capa | Tecnología | Nota |
|---|---|---|
| Framework | NestJS 11 | |
| ORM | TypeORM 0.3.20 | |
| Base de datos | MariaDB 10.4.x | `type: 'mariadb'` explícito en TypeORM (no `'mysql'`) — comentario en `app.module.ts` liga esta elección a la sintaxis `GENERATED ALWAYS AS (...) STORED` usada en columnas únicas críticas (§7) |
| Driver DB | `mysql2` | |
| Auth | JWT (access + refresh) + Passport | Refresh tokens hasheados con SHA-256 antes de persistir |
| Password hashing | bcrypt | |
| Validación | class-validator / class-transformer | |
| Documentos | PDFKit (recibos/novedades), ExcelJS (reportes) | |
| Testing | Jest + ts-jest + @nestjs/testing | `testRegex: ".*\\.spec\\.ts$"`, `rootDir: "src"` |
| Rate limiting | `@nestjs/throttler` | Solo en `POST /auth/login` (5 intentos/60s), registrado localmente en `AuthModule`, no global |

## 5. Módulos del sistema

`auth`, `usuarios`, `personas` (Cliente/Codeudor), `propietarios`, `inmuebles`, `contratos`, `obligaciones`,
`recaudo`, `novedades`, `movimientos`, `caja`, `empresa`, `documentos` (PDF/Excel), `auditoria`, `dashboard`.

Responsabilidad de cada uno, en una línea:

- **auth**: login, refresh, logout; emisión/rotación de tokens.
- **usuarios**: CRUD de usuarios del sistema (RBAC), con protecciones de auto-desactivación y último-admin.
- **personas**: Cliente y Codeudor como entidades separadas (no hay entidad `Persona` común — ver §19).
- **propietarios**: dueños de inmuebles, incluye propietario especial `INMOBILIARIA`.
- **inmuebles**: catálogo de propiedades, disponibilidad, valores sugeridos de canon/depósito.
- **contratos**: núcleo del negocio — ciclo de vida ACTIVO/TERMINADO, congela canon/depósito al crear.
- **obligaciones**: deuda causada (CANON, NOVEDAD), generación mensual, anulación.
- **recaudo**: motor de pagos — recibos, aplicación de dinero, saldo a favor, liquidación de depósitos.
- **novedades**: eventos operativos que pueden derivar en cobro al cliente o gasto de inmobiliaria.
- **movimientos**: libro de caja/banco interno, reversos.
- **caja**: arqueos, saldo esperado vs. contado.
- **empresa**: parámetros globales (horizonte de canon, saldo inicial de caja, datos corporativos, logo).
- **documentos**: emisión de PDF (recibo, novedad) y Excel (4 reportes).
- **auditoria**: registro de acciones vía interceptor global (best-effort — ver §9 y §17).
- **dashboard**: agregados para la pantalla de inicio (**NO DETERMINADO en detalle** — no se auditó su
  service en profundidad; no maneja dinero directamente, riesgo bajo).

## 6. Flujo de datos (ciclo de vida típico)

1. `POST /contratos` crea el contrato dentro de una transacción: valida cliente/codeudores/inmueble,
   congela `canonValor`/`diaPago` en el contrato, marca el inmueble OCUPADO, genera obligaciones CANON
   iniciales, y si hay depósito, registra un `Movimiento` de ingreso con `medioPago` explícito.
2. Un CRON diario (confirmado desde `pages/configuracion/index.vue`, que documenta "se genera
   automáticamente cada día (CRON)") genera obligaciones CANON futuras respetando
   `Empresa.horizonteMesesCanon`, con clave única `claveUnicaCanon` (`contratoId_periodo`) para evitar
   duplicados incluso bajo ejecución concurrente.
3. El cliente paga: `POST /recaudo/pagos` (o `.../simular` para previsualizar, sin efectos). Ambos pasan
   por la misma función pura `calcularPlanAplicacion()` — aplica Canon → Novedad (mora retirada), genera
   `ReciboCaja` + `DetallePago` (uno por medio de pago) + `AplicacionPago` (traza de qué obligación se
   pagó con qué) + `Movimiento` por cada medio.
4. Novedades: se registran, y solo una aprobación administrativa explícita las convierte en obligación
   (cobro al cliente) o gasto (`aprobarGastoInmobiliaria`); un segundo paso explícito, separado, mueve el
   dinero (`pagarGastoInmobiliaria`) — nunca la aprobación sola.
5. Terminación de contrato: cambia estado a TERMINADO, libera el inmueble, anula cánones futuros aún
   PENDIENTE (no toca los ya causados/pagados/parciales), deja el depósito pendiente de liquidación.
6. Liquidación de depósito: descuentos tipados (`GENERAL` no toca cartera; `DEUDA` sí abona a obligaciones
   reales vía el mismo `calcularPlanAplicacion`), genera egreso neto por el saldo a devolver.
7. Todo movimiento de dinero pasa por `movimientos.service.ts`, que mantiene saldo neto y saldo por medio
   de pago (Caja vs. Transferencia como conceptos separados — §14 del negocio).

## 7. Base de datos

Motor: MariaDB 10.4.x. Dos invariantes estructurales se garantizan a nivel de columna generada + índice
único, no solo en la capa de aplicación:

- `Contrato.claveUnicaInmuebleActivo`: `GENERATED ALWAYS AS (CASE WHEN estado='ACTIVO' THEN inmuebleId ELSE NULL END) STORED` + UNIQUE. Explota que MySQL/MariaDB permite múltiples NULL en un índice único: solo puede existir un contrato ACTIVO por inmueble, sin depender de que el código lo recuerde siempre.
- `Obligacion.claveUnicaCanon`: mismo patrón sobre `contratoId_periodo` cuando `tipo='CANON'`, evita duplicar la generación de canon incluso ante ejecuciones concurrentes del CRON.

Entidades principales: `Usuario`, `Cliente`, `Codeudor`, `Propietario`, `Inmueble`, `Contrato`,
`ContratoHistorialEstado`, `Obligacion`, `ReciboCaja`, `DetallePago`, `AplicacionPago`,
`SaldoFavorCredito`, `Novedad`, `Movimiento`, `ArqueoCaja`, `Empresa`, `Consecutivo`, `DescuentoDeposito`,
`RefreshToken`, y la tabla de auditoría (entidad no leída en detalle — **NO DETERMINADO**).

Patrón de inmutabilidad: los registros financieros (`Movimiento`, `ReciboCaja`, `ArqueoCaja`) son
append-only por diseño — las correcciones son siempre un nuevo registro de signo contrario con `motivo`
obligatorio, nunca un `UPDATE`/`DELETE` del original. **Excepción confirmada y aún vigente**: la reversión
de una liquidación de depósito sí hace `DescuentoDeposito.remove(descuentos)` (borrado físico) — ver
hallazgo DEP-REV-01 en §17 y §20.

Migraciones: 25 archivos en `src/database/migrations` (solo inventariadas por nombre de archivo, no leídas
en detalle una por una — **NO DETERMINADO** el contenido exacto de cada una; se infiere su propósito por
las entidades/columnas que describen los nombres).

## 8. APIs (superficie de endpoints por módulo)

| Módulo | Endpoints confirmados |
|---|---|
| auth | `POST /auth/login` (throttled), `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/me` |
| usuarios | `POST /usuarios`, `GET /usuarios`, `GET /usuarios/:id`, `PATCH /usuarios/:id`, `PATCH /usuarios/:id/password` |
| personas | `POST/GET /clientes`, `GET /clientes/buscar`, `GET/PATCH /clientes/:id`, mismo patrón para `/codeudores` |
| propietarios | `POST /propietarios`, `GET /propietarios`, `GET /propietarios/todos`, `GET/PATCH /propietarios/:id` |
| inmuebles | `POST /inmuebles`, `GET /inmuebles`, `GET /inmuebles/barrios`, `GET /inmuebles/disponibles`, `GET/PATCH /inmuebles/:id` |
| contratos | `POST /contratos`, `GET /contratos`, `GET /contratos/:id`, `GET /contratos/:id/ficha-recaudo`, `GET /contratos/:id/historial`, `PATCH /contratos/:id/terminar`, `PATCH /contratos/:id/reactivar` (solo Administrador) |
| obligaciones | `POST /obligaciones/generar-canones`, `GET /obligaciones`, `GET /obligaciones/contrato/:id/pendientes`, `PATCH /obligaciones/:id/anular` |
| recaudo | `GET /recaudo/deudores`, `POST /recaudo/pagos`, `POST /recaudo/pagos/simular`, `GET /recaudo/recibos`, `GET /recaudo/recibos/:id`, `GET /recaudo/contrato/:id/recibos`, `PATCH /recaudo/recibos/:id/anular`, `GET /recaudo/depositos/pendientes`, `GET /recaudo/depositos/liquidados`, `POST /recaudo/contrato/:id/liquidar-deposito` |
| novedades | `POST /novedades`, `GET /novedades`, `GET /novedades/:id`, `PATCH /novedades/:id/estado`, `PATCH /novedades/:id/aprobar-cargo-arrendatario`, `PATCH /novedades/:id/aprobar-gasto-inmobiliaria`, `PATCH /novedades/:id/revertir-aprobacion`, `PATCH /novedades/:id/pagar-gasto-inmobiliaria` |
| movimientos | `GET /movimientos`, `GET /movimientos/saldo-neto`, `GET /movimientos/saldo-por-medio`, `PATCH /movimientos/:id/reversar` |
| caja | `GET /caja/saldo-esperado`, `GET /caja/arqueos`, `GET /caja/arqueos/:id`, `POST /caja/arqueos` |
| empresa | `GET /empresa` (solo Administrador), `GET /empresa/publico` (público, solo marca), `PATCH /empresa`, `POST /empresa/logo` |
| documentos | `GET /documentos/novedades/:id/pdf` (Admin+Recepcionista), `GET /documentos/recibos/:id/pdf`, 4 endpoints de reporte Excel (todos exclusivos Administrador) |
| auditoria | `GET /auditoria` (**NO DETERMINADO** el detalle de filtros — controller no leído a fondo) |

Toda la API está documentada con Swagger (`@ApiTags`/`@ApiBearerAuth` presentes de forma consistente).

## 9. Seguridad

- JWT access + refresh; refresh tokens se persisten hasheados con SHA-256, nunca en texto plano.
- Passwords con bcrypt (`usuarios.service.ts`, costo 10).
- Rate limiting (5/60s) en login vía `ThrottlerModule`, registrado localmente en `AuthModule` porque el
  guard solo se usa ahí (comentario explícito en el código citando "AUD-019").
- **Inconsistencia real y menor confirmada**: `auth.module.ts` usa `cfg.get('JWT_ACCESS_SECRET')` (sin
  `getOrThrow`) para configurar `JwtModule`, mientras `strategies/jwt.strategy.ts` usa
  `config.getOrThrow<string>('JWT_ACCESS_SECRET')`. En la práctica el riesgo es bajo porque `JwtStrategy`
  se instancia en el arranque y sí truena si la variable falta, pero el sitio en `auth.module.ts` queda
  inconsistente con el patrón "fail loud" del resto del código. **CONFIRMADO, severidad BAJA** — se
  recomienda unificar a `getOrThrow` en ambos sitios por consistencia, no por un riesgo de explotación real.
- Subida de logo (`empresa.controller.ts`): rechaza SVG deliberadamente (comentario explícito: SVG puede
  embeber `<script>` y el archivo se sirve luego sin autenticación desde `/uploads/` — aceptar SVG abriría
  XSS almacenado). Además de filtrar por `Content-Type` declarado, valida los primeros bytes del archivo
  ya escrito en disco contra la firma real de PNG/JPEG (defensa en profundidad explícita contra un
  MIME-type falsificado). Este es uno de los controles de seguridad mejor documentados de todo el backend.
- `GET /empresa` (que expone `horizonteMesesCanon` y `saldoInicialCaja`, datos de negocio) está restringido
  a `@Roles(Rol.ADMINISTRADOR)`, con un comentario en el código citando explícitamente el hallazgo
  histórico "RBAC-03" que motivó la restricción — existe además `GET /empresa/publico`, endpoint
  `@Public()` separado que solo expone marca (nombre/slogan/logo), sin nada financiero, para login y
  layout de Recepcionista. **RBAC-03: CONFIRMADO CORREGIDO.**
- No se encontró (ni se buscó exhaustivamente) un mecanismo de rotación de secretos, gestión de CORS
  detallada, ni cabeceras de seguridad (Helmet, CSP) — **NO DETERMINADO**, no se leyó `main.ts` completo.

## 10. Autenticación y autorización (RBAC)

Dos roles: `ADMINISTRADOR` (control financiero y administrativo total) y `RECEPCIONISTA` (según
`ESPECIFICACION_MAESTRA_NEGOCIO.md` §3.2, puede: crear clientes, crear codeudores, crear inmuebles, crear
contratos, terminar contratos, registrar novedades — **no editar**).

`RolesGuard` (`src/common/guards/roles.guard.ts`) es fail-closed: un método mutante sin `@Roles(...)`
queda denegado a cualquiera por defecto; solo GET sin decorador queda abierto a cualquier usuario
autenticado. Esto se verificó leyendo el guard completo, no se infiere.

Puntos ya confirmados como corregidos frente a hallazgos históricos:
- Edición de Clientes/Codeudores restringida a Administrador (`clientes/index.vue` gatea `auth.esAdministrador`) — coincide con la especificación vigente §3.2, no con una versión más antigua que sí permitía editar a Recepcionista (ver contradicción documental en §26).
- Reactivación de contrato exclusiva a Administrador, vía `@Roles(Rol.ADMINISTRADOR)` en el controller.
- Edición de campos financieros de inmueble (canon/depósito) restringida a Administrador dentro del propio `inmuebles.service.ts` (chequeo de rol inline, no solo en el guard del controller).
- `usuarios.service.ts` impide que un Administrador se autodesactive o se quite su propio rol, y protege al último Administrador activo del sistema (no se puede desactivar/degradar si es el único activo).
- `novedades.service.ts cambiarEstado()` bloquea a Recepcionista de cerrar (ANULADA o CERRADA) una novedad con impacto financiero pendiente.

## 11. Lógica de negocio

- **Máquina de estados de contrato**: solo `ACTIVO`/`TERMINADO`. No existen (ni deben existir, por
  decisión de negocio) `SUSPENDIDO`, `INACTIVO`, `EN_TERMINACION`. Reactivación es exclusivamente
  TERMINADO→ACTIVO, exclusiva de Administrador, exige `motivo`, conserva `motivoTerminacion`/`fechaFin`
  históricos, revalida que el inmueble no esté ya ocupado por otro contrato.
- **Obligaciones**: solo `CANON` y `NOVEDAD` como tipos (nunca existió un tipo `MORA` — la mora siempre
  fue un concepto derivado/calculado, no una obligación almacenada).
- **Orden de aplicación de dinero**: Canon → Novedad (mora retirada el 2026-09-01). Implementado en una
  única función pura, `calcularPlanAplicacion()` en `recaudo.service.ts`, compartida sin diferencia de
  código entre `registrarPago()` (persiste) y `simularPago()` (preview puro, sin efectos secundarios) —
  la garantía estructural más fuerte del sistema para que la previsualización nunca pueda mentir.
- **Aprobado ≠ Pagado**: aprobar un gasto de inmobiliaria derivado de una novedad nunca mueve dinero por sí
  solo; solo un paso explícito y separado (`pagarGastoInmobiliaria`, con `medioPago` obligatorio) genera el
  `Movimiento` de egreso real. Confirmado en el split limpio de dos métodos en `novedades.service.ts`.
- **Caja vs. Recaudo vs. Transferencias**: conceptos explícitamente distintos (negocio §14) — Recaudo es
  todo el dinero recibido (efectivo + transferencia); Caja es solo efectivo físico; Transferencias es solo
  dinero por medio bancario. `Movimiento.medioPago` existe para esto, y se genera un `Movimiento` por cada
  medio de pago cuando un recibo mezcla efectivo y transferencia en un solo pago.
- **Concurrencia**: `dataSource.transaction(...)` + `.setLock('pessimistic_write')` es el patrón
  consistente en `ContratosService`, `RecaudoService`, `ObligacionesService`, `MovimientosService`,
  `NovedadesService` para cualquier mutación de estado financiero o de máquina de estados.

## 12. Manejo de errores

Patrón estándar de NestJS con excepciones tipadas (`NotFoundException`, `BadRequestException`,
`ConflictException`, `ForbiddenException`) lanzadas desde los services, no desde los controllers.
El interceptor de auditoría captura errores con `catchError` y registra `${accion}_FALLIDO` sin bloquear
la propagación del error original al cliente (`throwError(() => err)`) — el manejo de errores de negocio en
sí no depende de la auditoría.

**No se auditó** un exception filter global (`main.ts` no fue leído completo) — **NO DETERMINADO** si hay
un formato de error uniforme para toda la API o si cada módulo devuelve su propio shape de error.

## 13. Fechas

Bug histórico raíz (MORA-01, ya no reproducible porque el cálculo de mora fue retirado, pero el patrón que
lo causaba se corrigió de forma general): `new Date("YYYY-MM-DD")` se parsea como medianoche UTC según
ECMA-262; en Bogotá (UTC-5) leer componentes locales después de eso retrocede un día. Se generalizó en dos
helpers que parsean los componentes Y-M-D directamente sin pasar por el constructor `Date` con parseo ISO-UTC:
`fechaLocalDesdeString()` en `common/utils/fecha.util.ts` (uso general) y un privado
`fechaLocalDesdeColumnaDate` dentro de `ObligacionesService` (para columnas `date` ya hidratadas por
TypeORM). Verificado por lectura directa de ambos archivos.

## 14. Dinero y cálculos

`common/utils/dinero.util.ts` centraliza toda la aritmética monetaria: `redondearMoneda()` (redondeo a 2
decimales) y `esCeroMoneda()` (trata residuos de menos de medio centavo como cero, para evitar que el
drift de punto flotante deje obligaciones eternamente en estado PARCIAL). Se usa consistentemente en
`obligaciones.service.ts` y `recaudo.service.ts`.

**Hallazgo real y aún vigente, severidad BAJA**: varios DTOs (p. ej. `canonValor`/`depositoValor` de
Inmueble) aceptan `number` en vez de un tipo entero estricto — en teoría permitiría enviar centavos por API
aunque toda la UI y la lógica interna opera en COP como pesos enteros. No se encontró evidencia de que esto
haya causado un bug real; es una brecha de validación de entrada, no un error de cálculo confirmado.
**CONFIRMADO** (se verificó el tipo del DTO), impacto **NO REPRODUCIDO** en producción.

## 15. Integraciones externas

Ninguna integración externa de pago, tributaria o bancaria automatizada fue encontrada ni se esperaba
encontrarse (fuera de alcance explícito del negocio). El sistema registra transferencias como un medio de
pago declarado manualmente por el operador, no como una integración con un banco o pasarela real.

## 16. Rendimiento

No se ejecutaron pruebas de carga ni se auditó el plan de índices de la base de datos en detalle —
**NO DETERMINADO**. Observaciones de diseño relevantes:

- Varios listados auxiliares no están paginados: `GET /propietarios/todos`, `GET /inmuebles/disponibles`,
  `GET /inmuebles/barrios`. **CONFIRMADO por inspección de los endpoints listados en §8**; es aceptable hoy
  (listas para selects de formulario, volumen bajo) pero es un riesgo de escalabilidad a vigilar si el
  portafolio de inmuebles crece significativamente. Severidad **BAJA/INFORMACIONAL**.
- Los bloqueos pesimistas (`pessimistic_write`) usados extensamente para concurrencia son correctos para
  volumen bajo-medio de un solo equipo interno, pero no fueron sometidos a prueba de contención bajo carga.

## 17. Testing

- **Backend**: Jest + ts-jest + `@nestjs/testing`. 13+ archivos `*.integration.spec.ts` co-ubicados por
  módulo (auditoria, auth-login, caja, contratos, dashboard, empresa-autoseed, inmuebles, movimientos,
  novedades, obligaciones-canon, personas, propietarios, recaudo [41KB, el más grande], usuarios). La
  carpeta `/test` en la raíz solo contiene bootstrap (`jest.setup.ts`, `test-app.ts`), no specs. El
  hallazgo histórico "TEST-01: 0% cobertura" está **CONFIRMADO CORREGIDO** en el backend.
- **Gap real y vigente**: no se auditó backend para depósito-con-deuda ni para la reversión de liquidación
  de depósito específicamente (no se confirmó la existencia de un spec para ese flujo exacto) —
  **NO DETERMINADO**, recomendado como candidato de prueba dado que ahí vive el hallazgo DEP-REV-01 (§20).

## 18. Bugs encontrados (confirmados en esta pasada; los 3 ya fueron corregidos en la ronda 1
    de correcciones — ver `plans/README.md` — se conserva el análisis original por trazabilidad)

1. **DEP-REV-01 — ✅ CORREGIDO (ronda 1).** Inmutabilidad rota en reversión de liquidación de depósito. `movimientos.service.ts`,
   método privado `revertirEntidadDeOrigen()`: al revertir un movimiento de origen `DEPOSITO`, después de
   reconstruir `depositoGarantia`, anular el recibo interno de liquidación y revertir sus aplicaciones, la
   última línea hace `await descuentoRepo.remove(descuentos)` — **borrado físico** de los registros
   `DescuentoDeposito` de esa liquidación. Esto rompe el patrón de inmutabilidad append-only que el resto
   del sistema sigue estrictamente (Movimiento, ReciboCaja, ArqueoCaja nunca se editan/borran). El resto
   de la reversión (recibo, aplicaciones, saldo del depósito) sí es trazable; solo el detalle de los
   descuentos se pierde físicamente. **CONFIRMADO por lectura directa del código** (línea con `.remove(`).
   Severidad: **MEDIA** (operación infrecuente — reversión de una reversión de depósito ya liquidado — pero
   contradice el propio principio de auditoría que el sistema declara en otros lados).
2. **REACT-01 — ✅ CORREGIDO (ronda 1).** Reactivación de contrato no regenera obligaciones de canon inmediatamente.
   `contratos.service.ts reactivar()`: cambia `estado` a ACTIVO, libera/ocupa el inmueble, registra el
   historial de transición — pero no invoca `ObligacionesService` para generar los cánones correspondientes
   al periodo reactivado. Un contrato recién reactivado queda sin obligación de canon pendiente hasta la
   siguiente corrida del CRON diario (o hasta que el Administrador dispare la generación manual desde
   `/configuracion`). **CONFIRMADO por lectura directa** del método completo. Severidad: **MEDIA** — no es
   pérdida de dinero (el CRON eventualmente genera lo que falta, de forma idempotente vía la clave única de
   canon), pero puede generar confusión operativa a corto plazo ("reactivé el contrato y no aparece cobro
   pendiente").
3. **UX-NOV-01 — ✅ CORREGIDO (ronda 1, repo frontend).** La UI no expone reversión de aprobación de novedad. El backend tiene
   `PATCH /novedades/:id/revertir-aprobacion` funcionando, pero `pages/novedades/index.vue` no contiene
   ninguna referencia a esa acción (se verificó con búsqueda de texto en el archivo completo). La
   capacidad existe en el backend pero es inalcanzable desde la interfaz actual. Severidad: **BAJA** (gap
   de UX, no de integridad de datos — el backend igual protege el flujo).

## 19. Vulnerabilidades

No se encontraron vulnerabilidades de inyección SQL (uso consistente de QueryBuilder/repositorio
parametrizado de TypeORM, no concatenación de strings), ni de autenticación rota. El control de subida de
logo (§9) es un ejemplo positivo de defensa en profundidad bien documentada. La inconsistencia
`get`/`getOrThrow` de JWT (§9) es la única observación de esta categoría, y es de severidad baja.
No se realizó un escaneo de dependencias (`npm audit` o equivalente) como parte de esta auditoría —
**NO DETERMINADO**.

## 20. Deuda técnica

- Ausencia de una entidad `Persona` común para Cliente/Codeudor — son tablas separadas, lo que puede
  duplicar datos si la misma persona actúa en ambos roles en momentos distintos. Es una decisión de
  diseño válida si el negocio no necesita fusionarlos; queda como pregunta de negocio abierta, no como bug.
- No hay generación de cliente TypeScript desde OpenAPI/Swagger ni paquete de tipos compartido entre
  NestJS y Nuxt — el frontend tipa manualmente (o usa `any`) contra la forma real de las respuestas del
  backend. Ver §20 del documento de frontend para el detalle de este mismo hallazgo desde ese lado.
- Restos de mora deliberadamente dejados como `@deprecated` (columna `valorMoraPagada` en `Obligacion`,
  enum histórico de aplicación, método `revertirAbonoMora`) — correctos para poder revertir recibos
  históricos que sí tuvieron mora, pero deben permanecer estrictamente no-creables; se recomienda una
  prueba automatizada que falle si `registrarPago()` llega a generar una aplicación `MORA` nueva (no se
  confirmó que dicha prueba exista hoy — **NO DETERMINADO**).
- DTOs monetarios que aceptan `number` sin restricción de enteros (§14).
- Listados no paginados (§16).

## 21. Hallazgos históricos: reconciliación

Todo hallazgo con ID reconocible en las cuatro auditorías previas fue re-verificado directamente contra el
código actual. Resultado, por documento fuente:

**`AUDITORIA_QUIRURGICA_SEGUNDA_GENERACION.md` (2026-08-20) y `AUDITORIA_ROLES_Y_PERMISOS.md` (misma fecha, contenido mayormente duplicado del anterior):**

| ID | Hallazgo | Estado |
|---|---|---|
| CONT-01 | Estado `SUSPENDIDO` inválido existía | **CORREGIDO** — enum solo tiene ACTIVO/TERMINADO |
| CONT-02 | Reactivación sin exclusividad/motivo/historial | **CORREGIDO** — confirmado en controller+service |
| CONT-03 | Estado de inmueble no validado contra contrato real | **CORREGIDO** — `inmuebles.service.ts` |
| CONT-04 | `diaPago` mal derivado | **CORREGIDO** |
| CONT-05 / RDN-04 | Cánones futuros no se anulaban al terminar contrato | **CORREGIDO** — `anularCanonPosteriorATerminacion()`, solo PENDIENTE |
| PROP-01 | Sin entidad Propietario | **CORREGIDO** — módulo completo existe |
| CAJA-01 | `Movimiento` sin `medioPago`, todo mezclado | **CORREGIDO** |
| CAJA-02 | Sin módulo de Caja/arqueo | **CORREGIDO** — módulo `caja` completo |
| NOV-01 | Aprobar novedad = pagar (sin paso explícito) | **CORREGIDO** — split aprobar/pagar |
| RECAUDO-01 | Orden de aplicación incorrecto | **CORREGIDO** — Canon→Novedad en función única |
| RECAUDO-02 | Cambio no se aplicaba de inmediato | **RESUELTO** por decisión de negocio (RDN-01) |
| RECAUDO-03 | Recibo sin detalle de aplicaciones | **CORREGIDO** |
| DEP-01 | Descuentos de depósito no desglosados | **CORREGIDO** en backend y frontend (ver DEP-REV-01 como hallazgo *nuevo y distinto*, sobre la reversión, no la liquidación) |
| CONC-01 a CONC-04 | Carreras en generación de canon, reverso de movimiento, numeración, anulación de obligación | **CORREGIDOS los 4** — locks pesimistas + columnas únicas generadas confirmados por lectura directa |
| MORA-01 | Off-by-one de fecha | **CORREGIDO** (y el propio concepto de mora fue retirado después) |
| MORA-02 | Sin versionado de tasa de mora | **MOOT** — mora retirada por completo |
| RBAC-01 / RDN-06 | Edición de canon/depósito de inmueble sin restricción de rol | **CORREGIDO** |
| RBAC-02 / RDN-07 | Recepcionista podía cerrar novedad con impacto pendiente | **CORREGIDO** |
| TEST-01 | 0% cobertura de pruebas | **CORREGIDO** (backend); gap residual real en frontend (§17 del doc de frontend) |

**`ANALISIS_FUNCIONALIDADES.md` (2026-08-29):** correcto en su momento; hoy **parcialmente obsoleto
específicamente en sus afirmaciones sobre mora** (describe mora como cobrable y orden
Canon→Novedad→Mora — superado por el retiro de mora del 2026-09-01, posterior a ese documento). El resto
de su contenido (mapeo de los 15 módulos, lista de endpoints) es sustancialmente preciso y fue usado como
insumo de este documento.

**`# AUDITORIA_SISTEMA.md` (2026-09-01):** el más reciente de los cuatro. La mayoría de sus hallazgos
"Críticos" y "Altos" resultaron ya corregidos al momento de esta verificación (ver detalle abajo) — muy
probablemente porque este documento se escribió el mismo día del cierre de la Fase 5 (retiro de mora +
limpieza), y varios de los archivos que señala como problema tienen timestamp de modificación posterior
inmediato al de este documento. Reconciliación puntual de su lista de "Hallazgos Priorizados" (§16 de ese
documento):

| # en doc original | Hallazgo | Estado verificado ahora |
|---|---|---|
| Crítico 1 | Liquidación de depósito sin selector de tipo GENERAL/DEUDA en frontend | **CORREGIDO** — `ModalLiquidarDeposito.vue` sí tiene `USelectMenu` con `['GENERAL','DEUDA']` por línea de descuento |
| Crítico 2 | Inmutabilidad rota en reversión de depósito | **CONFIRMADO, SIGUE VIGENTE** — ver DEP-REV-01 en §18 |
| Crítico 3 | Tipado `any` extenso en frontend financiero | **CONFIRMADO, SIGUE VIGENTE** (ver doc de frontend §20) |
| Crítico 4 | Restos de mora en código/documentación | **PARCIALMENTE VIGENTE** — los restos existen pero están marcados `@deprecated` con comentarios explicando por qué se conservan; es el diseño correcto, no un descuido — reclasificado de "crítico" a **INFORMACIONAL** |
| Alto 5 | Auditoría best-effort para operaciones críticas | **CONFIRMADO, comportamiento intencional documentado en el propio código** (`audit.interceptor.ts`: no bloquea la respuesta si falla el registro) — riesgo real pero aceptado por diseño; ver §9 y §26 |
| Alto 6 | `saldoInicialCaja` no editable desde configuración | **CORREGIDO** — `configuracion/index.vue` sí lo expone y lo guarda |
| Alto 7 | SVG aceptado en frontend, rechazado en backend | **CORREGIDO** — frontend solo acepta `image/png,image/jpeg`, coincide con backend |
| Alto 8 | Reactivación sin generación inmediata de cánones | **CONFIRMADO, SIGUE VIGENTE** — ver REACT-01 en §18 |
| Alto 9 | `observaciones` de contrato no persistida | **CORREGIDO** (ronda 1) — el campo `observaciones` existía en el DTO y se descartaba; se eliminó del DTO |
| Medio 10 | DTOs monetarios con `number` en vez de entero | **CONFIRMADO, SIGUE VIGENTE, severidad baja** (§14) |
| Medio 11 | UI no expone reversión de aprobación de novedad | **CONFIRMADO, SIGUE VIGENTE** — ver UX-NOV-01 en §18 |
| Medio 12 | Reportes usan UUID en vez de consecutivo humano | **NO DETERMINADO** — `excel-reportes.service.ts` no fue leído en detalle en esta pasada |
| Medio 13 | Listados auxiliares no paginados | **CONFIRMADO, SIGUE VIGENTE, severidad baja** (§16) |
| Medio 14 | Falta de pruebas frontend | **CONFIRMADO, SIGUE VIGENTE** (§17 del doc de frontend) |
| — | Claim: `AuthService`/JWT usa `config.get()` sin throw "en algunos puntos" | **PARCIALMENTE CONFIRMADO** — cierto en `auth.module.ts` (JwtModule), falso en `jwt.strategy.ts` (usa `getOrThrow`). Ver §9. |

## 22. Riesgos

1. **Riesgo operativo, no técnico**: la Recepcionista puede terminar contratos sin ver todo el contexto
   financiero que sí ve el Administrador (por diseño de permisos) — riesgo de terminaciones sin revisión
   completa de deuda/depósito. Es un trade-off de negocio documentado, no un bug; se deja registrado aquí
   como riesgo operativo a monitorear, no como hallazgo a corregir sin decisión de negocio.
2. Los dos bugs confirmados de §18 (DEP-REV-01, REACT-01) son de severidad media — ninguno pierde dinero,
   pero ambos rompen una garantía que el sistema declara tener (inmutabilidad total; cánones siempre
   generados al activar un contrato).
3. Ausencia de tipado estricto compartido Backend↔Frontend es el riesgo estructural de mayor superficie:
   no causa bugs por sí solo, pero elimina una red de seguridad que detectaría automáticamente cuando un
   cambio de contrato de API rompe al frontend.

## 23. Dependencias críticas

`@nestjs/*` (11.x), `typeorm` (0.3.20), `mysql2`, `bcrypt`, `class-validator`/`class-transformer`,
`exceljs`, `pdfkit`, `sanitize-html`, `@nestjs/throttler`, `@nestjs/jwt`, `passport`/`passport-jwt`.
No se ejecutó auditoría de vulnerabilidades de dependencias (`npm audit`) — **NO DETERMINADO**.

## 24. Recomendaciones (para la futura fase de corrección — no ejecutar aquí)

Priorizadas por severidad/esfuerzo, sin implicar que deban ejecutarse en este orden sin decisión de negocio:

1. Corregir DEP-REV-01: reemplazar `descuentoRepo.remove(descuentos)` por un marcado de anulación
   (columna `anulado`/`reversadoEn`) en vez de borrado físico.
2. Corregir REACT-01: hacer que `reactivar()` invoque generación de canon del periodo vigente dentro de la
   misma transacción, o documentar explícitamente en la UI que el canon aparecerá tras la siguiente corrida
   del CRON.
3. Exponer en la UI de Novedades la acción de reversión de aprobación (UX-NOV-01) — cambio de frontend
   puro, backend ya listo.
4. Unificar `get`→`getOrThrow` en `auth.module.ts` por consistencia (bajo riesgo, bajo esfuerzo).
5. Endurecer DTOs monetarios a enteros estrictos donde el negocio confirme que nunca se manejan centavos.
6. Generar contratos TypeScript compartidos desde OpenAPI (esfuerzo alto, valor alto a mediano plazo).
7. Añadir prueba de integración que falle si `registrarPago()` genera alguna vez una aplicación `MORA`
   nueva, como cerrojo permanente contra la reintroducción accidental de mora.

## 25. Estado de la auditoría

Cobertura profunda y verificada por lectura directa: contratos, obligaciones, recaudo (el archivo más
grande y crítico, 819 líneas, leído completo), novedades, movimientos, caja, empresa, inmuebles, usuarios,
auth (service + strategy + module), roles guard, documentos (controller), app.module, dinero/fecha utils,
audit interceptor.

Cobertura NO alcanzada en esta pasada (declarado explícitamente, no asumido como "sin problemas"):
`dashboard.service.ts`, `auditoria.controller.ts`/`.service.ts` en detalle, `pdf-recibo.service.ts`,
`pdf-novedad.service.ts`, `excel-reportes.service.ts`, la mayoría de los DTOs individuales, las 23
migraciones una por una, `main.ts` completo (CORS/Helmet/exception filters globales), y auditoría de
dependencias (`npm audit`).

## 26. Preguntas / incertidumbres abiertas

1. **Contradicción documental sin resolver, requiere dueño de negocio**: `ESPECIFICACION_MAESTRA_NEGOCIO.md`
   §10 todavía dice que el orden de aplicación es "Canon → Novedad → Mora"; su propia nota posterior en §11
   (fechada 2026-09-01) dice que mora fue retirada y el orden es "Canon → Novedad". El código ya refleja
   §11 (verificado). §10 no fue actualizado. No se corrige aquí porque es un documento de reglas de
   negocio que requiere aval del dueño, no un ajuste técnico unilateral.
2. `PREGUNTAS_NEGOCIO.md` §I (Propietario financiero / comisiones) sigue abierta (🔴) — confirma que el
   alcance actual (sin comisiones ni liquidación a propietario) es deliberado pero aún no cerrado
   formalmente por el negocio.
3. ¿La auditoría best-effort (no bloqueante) es aceptable para las operaciones financieras más sensibles
   (recaudo, anulación, reverso), o el negocio prefiere trazabilidad garantizada aunque implique más
   latencia/complejidad transaccional? Hoy es una decisión de diseño implícita, no confirmada como
   decisión de negocio explícita.
4. ¿Debe existir una entidad `Persona` común para Cliente/Codeudor, o las tablas separadas son la decisión
   final? (§20).
5. Contenido exacto de las 25 migraciones, de `dashboard`, `auditoria` y de los servicios de generación de
   PDF/Excel: **NO DETERMINADO**, pendiente de una siguiente pasada si se requiere certeza total sobre esos
   componentes antes de la fase de corrección.

## 27. Qué NO debe asumirse

- **No asumir** que el sistema maneja IVA, retenciones, DIAN, facturación electrónica o cualquier
  obligación tributaria — está deliberadamente fuera de alcance y el código lo confirma (sin lógica fiscal
  encontrada en ningún módulo).
- **No asumir** que existe cálculo de mora en ningún flujo activo — fue retirado por completo el
  2026-09-01; lo que queda son campos `@deprecated` para poder revertir historia antigua, no una función
  viva.
- **No asumir** que el hallazgo "liquidación de depósito sin tipo de descuento" (de `# AUDITORIA_SISTEMA.md`)
  sigue vigente — está corregido; el hallazgo real y vigente en esa misma área es distinto (DEP-REV-01,
  sobre la *reversión*, no la liquidación).
- **No asumir** que `auth.module.ts` es un riesgo de seguridad explotable — es una inconsistencia de estilo
  de bajo impacto, no una vulnerabilidad real (la app no arranca sin la variable de entorno de todos modos).
- **No asumir** que los reversos financieros del sistema son 100% inmutables sin excepción — hay una
  excepción real y confirmada (DEP-REV-01).
- **No asumir** que Recepcionista puede editar Clientes/Codeudores — no puede, por diseño vigente
  (contradice una regla de negocio "confirmada" citada en auditorías de frontend más antiguas, que quedó
  obsoleta).
- **No modificar código, DTOs, entidades, endpoints, dependencias ni configuración a partir de este
  documento sin una fase de corrección separada y explícitamente autorizada** — este documento es
  DESCUBRIR → DOCUMENTAR → VALIDAR, no CORREGIR.
