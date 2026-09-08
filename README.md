# Backend — Inversiones Tamara & Saenz S. En C. (ERP Inmobiliario)

NestJS 11 + TypeORM + MySQL 8 + JWT + Swagger.

## ✅ Verificado end-to-end (13 de agosto de 2026)

Este proyecto fue probado de verdad, no solo escrito: `npm install`, compilación TypeScript,
migración generada y ejecutada contra MySQL/MariaDB real, seed, arranque de la API, y pruebas
funcionales vía `curl` de los flujos completos (login, crear contrato con N:M codeudores,
generar canon, pago mixto con aplicación por antigüedad, PDF, anulación con reverso exacto,
export a Excel, y enforcement de RBAC). En el proceso se encontraron y corrigieron **6 bugs
reales** que un simple `npm install && npm run start` habría hecho fallar:

1. **Peer dependencies desactualizadas**: `@nestjs/config`, `@nestjs/typeorm`, `@nestjs/swagger`,
   `@nestjs/jwt`, `@nestjs/passport` y `@nestjs/schedule` estaban pineados a versiones que no
   soportan NestJS 11. Actualizadas a las versiones compatibles.
2. **`tsconfig.json`**: `baseUrl` deprecado en TS moderno, removido (no se usaba).
3. **`jwt.strategy.ts`**: usaba `config.get()` en vez de `config.getOrThrow()` para el secreto
   JWT — con `.get()`, si faltara la variable de entorno, la app arrancaría igual generando
   tokens con `secretOrKey: undefined` en silencio. Corregido.
4. **Entidades TypeORM con campos `string | null`**: TypeORM no puede inferir el tipo de
   columna desde un tipo unión de TypeScript (`DataTypeNotSupportedError` al generar la
   migración). Se agregó `type: 'varchar'` / `type: 'uuid'` explícito en todas las columnas
   nullable afectadas (~9 entidades).
5. **`.env.example`**: los valores con `#` sin comillas (`Admin#2026`) se truncaban al cargar
   con `dotenv` (quedaba `Admin`), rompiendo el login del usuario sembrado. Ahora van entre
   comillas dobles — **respeta las comillas si editas el `.env`**.
6. **`registrar-pago.dto.ts`**: al campo `medioPago` del DTO anidado le faltaba `@IsEnum()`.
   Con `whitelist: true` global, class-validator rechazaba la petición completa
   (`property medioPago should not exist`). Corregido.

También se corrigió una inconsistencia cosmética (no de datos) donde el objeto de respuesta
de `POST /contratos` mostraba el inmueble como `DISPONIBLE` justo después de crearlo, aunque
en base de datos ya quedaba correctamente en `OCUPADO` (se reordenaron las operaciones dentro
de la transacción).

La migración incluida en `src/database/migrations/` YA fue generada y ejecutada exitosamente
contra una base de datos real — no es un archivo de ejemplo, es la migración real y funcional
del esquema completo (todas las tablas y foreign keys). **No necesitas correr
`migration:generate`, solo `migration:run`.**

## Módulos incluidos en esta entrega (Fase 1 + Motor Financiero)
- `auth`: login, refresh tokens (validados por hash), guards RBAC.
- `empresa`: datos corporativos + parámetros globales + consecutivos atómicos (bloqueo pesimista).
- `usuarios`: gestión de usuarios (solo Administrador).
- `personas`: directorios de Clientes y Codeudores (independientes).
- `inmuebles`: portafolio con barrio, canon, depósito y servicios públicos.
- `contratos`: motor de estados, `fecha_fin` nullable, relación N:M con codeudores.
- `novedades`: registro por Recepción + aprobación financiera exclusiva Administrador
  (ya conectada a `obligaciones` y `movimientos`).
- `obligaciones`: generación mensual automática de canon (CRON diario + disparo manual),
  obligaciones tipo `NOVEDAD` desde aprobaciones. Cobro neto por capital — sin costo de mora
  (retirado el 2026-09-01).
- `recaudo`: motor de pagos mixtos (varios medios en un recibo), aplicación a obligaciones
  por antigüedad, excedente a `saldo_a_favor`, anulación con reverso (nunca `DELETE`),
  liquidación de depósito en custodia al terminar contrato.
- `movimientos`: caja INGRESO/EGRESO, inmutable — toda corrección es un movimiento de reverso.
- `documentos`: PDF vectorial (PDFKit) de Recibo de Caja en Carta/Media Carta, y exportación
  de reportes a Excel (ExcelJS) por contratos e inmuebles por barrio.
- `auditoria`: persistencia real de trazabilidad, conectada al `AuditInterceptor` global.

### Todo lo planteado en el super-prompt está cubierto
No quedan pendientes de alcance funcional. Posibles mejoras futuras (fuera del scope original):
paginación server-side en el reporte de auditoría exportable a Excel, y notificaciones
automáticas de cartera vencida por correo (hoy la cartera se calcula y se muestra, pero no se
notifica).

## Novedades de esta última entrega
- `dashboard`: `GET /dashboard` devuelve métricas operativas para cualquier rol autenticado
  y agrega cifras financieras (`carteraTotal`, `recaudoMesActual`) SOLO si el usuario es
  Administrador — el Recepcionista nunca recibe cifras de dinero, ni siquiera agregadas.
- `recaudo`: se agregó la entidad `AplicacionPago` para trazar exactamente qué obligación
  recibió qué monto de cada recibo. `RecaudoService.anular()` ahora revierte cada abono
  específico (vía `ObligacionesService.revertirAbono`) en vez de solo reversar el movimiento
  de caja global — la anulación de un recibo deja las obligaciones exactamente como estaban
  antes del pago.
- `documentos`: nuevo endpoint `GET /documentos/reportes/cartera.xlsx` — reporte consolidado
  de obligaciones pendientes/parciales de todos los contratos, con saldo pendiente y una fila
  de totales al final (`ObligacionesService.todasPendientes()`).
- `auditoria`: los filtros `desde`/`hasta` (ya soportados por el service/controller desde el
  inicio) ahora están expuestos en la UI de `/auditoria`.

## Puesta en marcha

```bash
npm install
cp .env.example .env       # respeta las comillas en los valores con '#'
```

Genera el secreto JWT (**no uses el de ejemplo**) y pégalo en `JWT_ACCESS_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Define `SEED_ADMIN_PASSWORD` y `SEED_RECEPCION_PASSWORD` con contraseñas fuertes propias
(el seed falla si faltan). Luego:

```bash
npm run migration:run     # ejecuta la migración YA GENERADA (no hace falta migration:generate)
npm run seed               # crea Empresa, Consecutivos y usuarios Admin/Recepción
npm run start:dev
```

El proyecto se prueba y ejecuta contra **MySQL 8** (driver mysql2; en producción, el plugin MySQL
de Railway). Verificado 2026-09-08: las 25 migraciones + los 188 tests corren limpio contra
MySQL 8.4.11 (plan BE-016). El backend **no arranca** si `JWT_ACCESS_SECRET` es corto (<32) o un
valor de ejemplo.

Swagger (solo con `SWAGGER_ENABLED=true`): `http://localhost:3010/api/v1/docs`

## Usuarios de prueba (definidos en `.env`)
- Admin: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
- Recepción: `SEED_RECEPCION_EMAIL` / `SEED_RECEPCION_PASSWORD`

## Rotación de secretos

- **`JWT_ACCESS_SECRET`**: cambiarlo invalida **todas las sesiones activas** — todos los usuarios
  deben volver a hacer login. Coordina una ventana antes de rotarlo en producción.
- **Contraseñas de usuarios** (`admin@`, `recepcion@`): se cambian desde `/administracion`
  (o `PATCH /usuarios/:id/password`), **nunca** editando el seed o el `.env` (el seed solo crea
  el usuario si no existe; no actualiza contraseñas).
- El `.env` real de producción debe tener `NODE_ENV=production` y `SWAGGER_ENABLED` ausente o `false`.
- **`JWT_ACCESS_EXPIRES_IN`**: usar `15m` (default del código). Con la sesión deslizante de 1 día
  (`JWT_REFRESH_EXPIRES_IN=1d`) y la resiliencia de sesión del frontend, un access token corto no
  molesta al usuario y reduce a minutos la ventana de un token filtrado.

## Separación de responsabilidades: Recepcionista (operativo) vs Administrador (contable)

**Regla de negocio confirmada 2026-08-18** (reemplaza cualquier afirmación previa de este README
sobre RBAC de Inmuebles/Contratos que la contradiga):

> Todo lo **operativo/técnico** es del Recepcionista; todo lo **contable** es del Administrador.

- **Recepcionista puede**: crear Clientes, Codeudores, Inmuebles y Contratos; terminar Contratos;
  registrar Novedades y sugerir si el cargo corresponde al Cliente o a la
  Inmobiliaria (`responsableSugerido`); generar el recibo de reporte de novedad (documento de
  control interno, sin impacto financiero, análogo en trazabilidad al recibo de caja).
- **Administrador exclusivo**: todo el módulo `recaudo` (registrar pagos, anular recibos,
  liquidar depósito), la ficha de recaudo del contrato, y la decisión financiera final de cada
  Novedad vía `aprobar-cargo-arrendatario` / `aprobar-gasto-inmobiliaria` — el Administrador
  decide si el cargo se cobra al cliente o lo asume la inmobiliaria, sin importar lo que sugirió
  Recepción al registrarla.
- **Salvaguarda de saldo pendiente al terminar un contrato**: la operación NUNCA debe
  hacer que una deuda deje de ser cobrable ni desaparezca de los reportes. Las obligaciones
  `PENDIENTE`/`PARCIAL` de un contrato terminado no se cancelan automáticamente;
  siguen visibles y cobrables desde `recaudo` (ficha de recaudo y reporte de cartera) hasta que
  el Administrador las liquide.

**Estado de implementación de esta regla** (detalle y plan de corrección en
`ARCHITECTURE_AND_AUDIT.md`, ítems AUD-002, AUD-007, AUD-035 a AUD-037):
- Crear contrato por Recepcionista: ✅ ya implementado (`POST /contratos`).
- Crear Cliente/Codeudor por Recepcionista: ✅ ya implementado.
- Registrar novedades por Recepcionista + aprobación financiera exclusiva Administrador:
  ✅ ya implementado.
- Crear/editar Inmueble por Recepcionista: ✅ ya implementado — `POST /inmuebles` y
  `PATCH /inmuebles/:id` aceptan `Rol.ADMINISTRADOR` y `Rol.RECEPCIONISTA`; el frontend ya
  muestra los botones correspondientes a ambos roles (AUD-036).
- Terminar/reactivar contrato: `PATCH /contratos/:id/terminar` acepta ambos roles;
  `PATCH /contratos/:id/reactivar` es **exclusivo Administrador**. No existe `/suspender`
  (estado SUSPENDIDO eliminado — migración EliminarSuspendidoYHistorialContrato). `ficha-recaudo`
  permanece exclusiva de Administrador. UI de acciones agregada en `pages/contratos/index.vue`
  (AUD-035).
- Obligaciones pendientes de un contrato terminado siguen cobrables y visibles en el
  reporte de cartera: ✅ ya cumplido — verificado que `ObligacionesService.todasPendientes()` y
  `DashboardService.metricasFinancieras()` no filtran por `contrato.estado`, y que
  `terminar()` no modifica las obligaciones del contrato (AUD-007, confirmado sin
  cambios de código pendientes).
- Recibo de reporte de novedad, generado por Recepcionista y guardado para control interno:
  ✅ ya implementado — `PdfNovedadService` + `GET /documentos/novedades/:id/pdf`, sin montos ni
  impacto financiero; botón "Recibo" en `pages/novedades/index.vue` (AUD-037).
- Ficha de recaudo y módulo `recaudo` exclusivos de Administrador: ✅ ya implementado, sin cambios
  (se mantiene "todo lo contable es del Administrador").
- `fecha_fin` del contrato es `NULL` al crear; solo se solicita en `PATCH /contratos/:id/terminar`.
- Creación de contrato es 100% por búsqueda estricta de IDs ya existentes (Cliente/Codeudores/Inmueble).
- Consecutivos (`RECIBO_CAJA`, `EGRESO`, `NOVEDAD`) usan `SELECT ... FOR UPDATE` dentro de una
  transacción (`ConsecutivoService.siguiente()`) para evitar duplicados bajo concurrencia.
- Sin estado `EN_VENTA` en Inmueble (restricción absoluta del negocio).
- Pagos mixtos: `POST /recaudo/pagos` acepta varios `detallesPago` (EFECTIVO, TRANSFERENCIA)
  en un solo recibo; el excedente se guarda en `contrato.saldoAFavor`.
- Movimientos de caja son inmutables: no existe endpoint `DELETE`; anular un recibo genera
  un movimiento de reverso trazable (`Movimiento.esReverso` + `movimientoOriginalId`).
- El módulo `recaudo` completo (y por tanto `documentos`, que depende de él) está bloqueado
  con `@Roles(Rol.ADMINISTRADOR)` a nivel de controlador — el Recepcionista no puede acceder
  a ningún endpoint financiero, ni siquiera de solo lectura.
- `GET /contratos` acepta filtro opcional `inmuebleId` (además de `barrio`), usado por el
  selector de contrato relacionado al registrar una novedad (AUD-026).

## Fase 3 (2026-08-18) — Frontend, cerrada

Los 8 ítems de la Fase 3 de `ARCHITECTURE_AND_AUDIT.md` (AUD-022 a AUD-029) quedaron
resueltos: manejo de errores consistente en las 11 páginas con lecturas/escrituras que fallaban
en silencio, retry automático tras renovar sesión, RBAC reflejado en Personas, selector de
contrato por `inmuebleId`, confirmación antes de desactivar un usuario, y las tres capacidades
de backend que no tenían UI (liquidar depósito, generar canon manual, consulta de movimientos y
saldo neto). El módulo `movimientos` (`GET /movimientos`, `GET /movimientos/saldo-neto`) ya
existía en el backend; solo faltaba su consumo desde el frontend, ahora en `pages/movimientos/`.

## Fase 4 (2026-08-18) — Integración Backend↔Frontend, cerrada

Los 2 ítems de la Fase 4 (AUD-030, AUD-031) quedaron resueltos:
- `/auditoria` se agregó a `rutasSoloAdmin` en `middleware/auth.global.ts` (frontend) — un
  Recepcionista que navegue directo a esa URL ahora es redirigido, igual que con `/recaudo`.
- `NovedadesService.cambiarEstado()` ahora recibe el rol del usuario actual y rechaza con `403`
  la transición a `ANULADA` cuando `impactoFinanciero` sigue `PENDIENTE`, si quien la ejecuta no
  es Administrador. Decisión de desarrollo (no se requirió confirmación de negocio adicional):
  anular una novedad sin resolver su impacto financiero bloquea para siempre la posibilidad de
  cobrarla o registrarla como gasto (`validarAprobable` rechaza aprobar una novedad `ANULADA`),
  así que es, en la práctica, una decisión contable — aplica el mismo principio ya confirmado
  por el usuario en la Fase 2 (AUD-007): ningún impacto financiero pendiente debe volverse
  incobrable por una acción puramente operativa. El resto de transiciones de estado
  (`ABIERTA`/`EN_SEGUIMIENTO`/`CERRADA`, y `ANULADA` una vez ya resuelto el impacto financiero)
  siguen abiertas a Recepcionista sin restricción nueva.

## Fase 5 (2026-08-18) — Seguridad, cerrada

- AUD-032: se retiró `logoUrl` de `UpdateEmpresaDto` — ya no se puede editar como texto libre
  vía `PATCH /empresa`, bypaseando las validaciones reales de `POST /empresa/logo` (MIME,
  tamaño, nombre aleatorio). Con `forbidNonWhitelisted: true` ya activo globalmente, el campo
  ahora es rechazado automáticamente.
- AUD-033: verificado y descartado sin cambios de código. `/uploads` se sirve sin autenticación
  (es middleware estático de Express, fuera del pipeline de guards), pero solo contiene el logo
  de la empresa con nombre `randomUUID()` (no enumerable) — no hay ningún otro `FileInterceptor`
  en el backend. Moverlo detrás de un guard rompería `configuracion/index.vue` (usa `<img src>`,
  que no puede enviar `Authorization`) sin ganar seguridad real, dado que no hay contenido
  sensible en esa carpeta.

## Retiro del costo de mora + auditoría contable (2026-09-01)

**Decisión de negocio:** el sistema ya NO cobra mora / interés por retraso. Los cobros son
netos, exclusivamente por **canon de arrendamiento** (y cargos tipo NOVEDAD aprobados). Se
retiró toda la lógica de mora de servicios y controladores; el orden de aplicación del dinero
pasa de `Canon → Novedad → Mora` a `Canon → Novedad`.

- **Sin migraciones destructivas.** Las columnas `obligacion.valorMoraAcumulada`,
  `empresa.diasGraciaMora`, `empresa.porcentajeMoraMensual` y la tabla `historial_tasa_mora`
  quedan huérfanas en la BD real (todas con `DEFAULT`). `obligacion.valorMoraPagada` y el enum
  `aplicacion_pago.concepto` se conservan solo como shim de compatibilidad para anular un
  recibo histórico que hubiera cobrado mora (`ObligacionesService.revertirAbonoMora`).
- **Hallazgos contables corregidos en el mismo ciclo:**
  - **B1** — `contrato.saldoAFavor` se recalcula siempre desde `SUM(saldo_favor_credito.montoDisponible)`
    (`RecaudoService.sincronizarSaldoAFavor`); antes lo mantenían dos estrategias divergentes.
  - **B2** — redondeo monetario central (`src/common/utils/dinero.util.ts`) en todo el motor de
    aplicación; DTOs de montos pasan a `@IsInt()` (COP no maneja centavos).
  - **B4** — `dashboard.recaudoMesActual` excluye los recibos `esLiquidacionDeposito`.
  - **B5** — recibir depósito en custodia genera un `Movimiento` INGRESO (origen `DEPOSITO`) con
    su medio de pago; `CreateContratoDto` gana `medioPagoDeposito`/`referenciaDeposito`. Para el
    histórico: `src/database/seeds/reconciliar-depositos.ts` (dry-run por defecto).
  - **B6** — `liquidarDeposito` descuenta de la devolución solo la deuda EFECTIVAMENTE abonada.
  - **B7** — `TerminarContratoDto.motivoTerminacion` ahora `@IsNotEmpty()` + `@MaxLength(300)`.
  - **B9** — `reporte-recaudo.xlsx` distingue tipo de documento y totaliza solo el recaudo neto.
- **Frontend (coordinación):** desaparecen `valorMoraAcumulada` / `totalMoraVencida` de las
  respuestas de ficha-recaudo, obligaciones, `simularPago` y deudores; `PATCH /empresa` rechaza
  `diasGraciaMora`/`porcentajeMoraMensual`; `POST /recaudo/pagos` rechaza el campo `formato`.

## Limpieza de documentación (2026-09-04)

Corregidas afirmaciones obsoletas en esta bitácora (MySQL 8 → MariaDB; feature "suspender"
y medios CONSIGNACION/OTRO retirados; refs a AUDITORIA_FUNCIONAL_COMPLETA.md → ARCHITECTURE_AND_AUDIT.md).
Auditorías previas movidas a `documentacion/backendocu/archivo/`.
