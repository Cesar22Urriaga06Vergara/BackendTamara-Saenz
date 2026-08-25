# AUDITORÍA QUIRÚRGICA DE SEGUNDA GENERACIÓN
## Sistema interno de administración y control de arrendamientos — Tamara & Saenz

**Fecha:** 2026-08-20
**Fuente de verdad funcional:** `ESPECIFICACION_MAESTRA_NEGOCIO.md`
**Metodología:** `PROMPT_AUDITORIA_QUIRURGICA_CLAUDE_CODE.md`
**Alcance técnico:** Backend NestJS + TypeORM (`BackendTamara-Saenz`) y Frontend Nuxt/Vue (`FrontendTamara-Saenz`)
**Fase:** Solo lectura. No se modificó ningún archivo de código durante esta auditoría.

Esta auditoría fue construida leyendo íntegramente entidades, migraciones, servicios, controllers, DTOs, guards, interceptores, páginas, stores y composables reales — no se aceptó ningún README o comentario como evidencia de que algo funciona. Cada hallazgo cita archivo y línea.

---

# 1. RESUMEN EJECUTIVO

El sistema implementa correctamente una **parte sustancial** de la especificación de negocio: la autorización backend es fail-closed y consistente (ningún endpoint mutante queda sin `@Roles`), las operaciones de recaudo y anulación de recibo están correctamente envueltas en transacciones con locks pesimistas, la precisión decimal de todos los campos monetarios es correcta (`decimal(12,2)`), la separación Obligación/Recibo/Aplicación existe como modelo de datos, y ni el frontend ni el backend contienen ningún mecanismo de condonación de deuda.

Sin embargo, la auditoría encontró **11 hallazgos P0/P1 de naturaleza financiera o de seguridad** que representan desviaciones directas y verificables de la especificación, no interpretaciones discutibles:

1. **El estado `SUSPENDIDO` fue reintroducido en `Contrato`**, expresamente prohibido por la sección 6.2, y la única transición de reactivación real exigida por el negocio (`TERMINADO → ACTIVO`, exclusiva de Administrador, con motivo obligatorio) **no existe en el código**.
2. **La entidad `Propietario` no existe en absoluto** — ningún inmueble está asociado a un propietario, y el propietario especial "INMOBILIARIA" nunca se crea.
3. **La caja física y las transferencias bancarias están estructuralmente mezcladas**: `Movimiento` no tiene ningún campo de medio de pago, por lo que es imposible reconstruir cuánto efectivo debería haber físicamente en caja.
4. **Aprobar un gasto de novedad genera el movimiento financiero de inmediato** — el sistema trata `APROBADO` como sinónimo de `PAGADO`, violando directamente la sección 17/18.
5. **El orden de aplicación del dinero Canon→Novedad→Mora no está implementado**: el código aplica dinero por fecha de vencimiento cronológica sin distinguir tipo, y la mora **nunca es cobrable** como partida propia — es un número que se muestra en pantalla pero que el motor de recaudo no puede recibir como pago.
6. **Un endpoint de reverso de movimientos permite doble reverso bajo concurrencia** por ausencia de lock, pudiendo duplicar el efecto en caja.
7. **La cobertura de pruebas automatizadas es 0%** en ambos proyectos — no existe un solo archivo de prueba, ni configuración de framework de testing.

El resto de hallazgos (16 adicionales, P2-P5) son gaps funcionales (módulo de Caja del §15 inexistente, descuentos de depósito sin desglose, recibo sin desglose de aplicación) o deuda técnica (FKs nullable, referencias sin FK real, generación de canon sin lock estructural).

**Conclusión de una línea:** el código actual **no implementa exactamente** el negocio definido por la especificación — implementa una versión anterior y parcialmente distinta, con al menos un módulo completo ausente (Propietario, Caja física) y dos reglas financieras centrales (orden de aplicación, APROBADO≠PAGADO) invertidas o incompletas.

---

# 2. ESTADO REAL DEL SISTEMA

- **Backend:** NestJS + TypeORM + MySQL. 11 módulos: `auditoria`, `auth`, `contratos`, `dashboard`, `documentos`, `empresa`, `inmuebles`, `movimientos`, `novedades`, `obligaciones`, `personas`, `recaudo`, `usuarios`.
- **Frontend:** Nuxt 3 + Vue + Pinia. 4 stores (`auth`, `contratos`, `filtros`, `novedades`), 16 páginas, middleware global de autenticación por rol.
- **Autenticación:** JWT + refresh token, guards globales (`JwtAuthGuard`, `RolesGuard`) registrados vía `APP_GUARD` en `app.module.ts`.
- **Pruebas:** cero archivos `*.spec.ts`/`*.e2e-spec.ts` en backend; cero `*.spec.ts`/`*.test.ts` en frontend; sin script `test` en ningún `package.json`; sin `jest`/`vitest` instalado. Confirmado por 2 agentes de forma independiente.
- **Migraciones:** 6 migraciones incrementales, con evidencia de al menos una auditoría histórica previa que sí corrigió un hallazgo (retiro de `EN_TERMINACION`, ver sección 16).
- **Documentos:** generación de PDF (recibo, novedad) y Excel (4 reportes) vía `exceljs`/librería PDF — decisión técnica, no de negocio.

---

# 3. MODELO REAL DE NEGOCIO IMPLEMENTADO

| Concepto de negocio | Implementado como | Archivo |
|---|---|---|
| Propietario | **No existe** | — (ver PROP-01) |
| Inmueble | `Inmueble` (DISPONIBLE/OCUPADO/MANTENIMIENTO/INACTIVO) | `src/modules/inmuebles/entities/inmueble.entity.ts` |
| Contrato | `Contrato` (ACTIVO/**SUSPENDIDO**/TERMINADO — 3 estados, no 2) | `src/modules/contratos/entities/contrato.entity.ts` |
| Obligación | `Obligacion` (tipo CANON\|NOVEDAD; estado PENDIENTE/PARCIAL/PAGADA/ANULADA) | `src/modules/obligaciones/entities/obligacion.entity.ts` |
| Mora | Campo calculado en memoria, nunca persistido como partida cobrable | `obligaciones.service.ts:124-137` |
| Pago recibido | `ReciboCaja` + `DetallePago` (medio, monto, referencia) | `src/modules/recaudo/entities/*.entity.ts` |
| Aplicación del pago | `AplicacionPago` (recibo↔obligación, montoAplicado) | `aplicacion-pago.entity.ts` |
| Cambio (§9.3) | **No existe** — todo excedente se convierte en `SaldoFavorCredito` acumulable | `recaudo.service.ts:101-136` |
| Caja física / Transferencias | **Un único ledger `Movimiento`**, sin distinguir medio de pago | `movimientos/entities/movimiento.entity.ts` |
| Novedad | `Novedad` (ABIERTA/EN_SEGUIMIENTO/CERRADA/ANULADA; impacto PENDIENTE/CARGO_ARRENDATARIO/GASTO_INMOBILIARIA) | `novedades/entities/novedad.entity.ts` |
| Gasto de inmobiliaria (Egreso) | Movimiento generado en el mismo paso que la aprobación (APROBADO=PAGADO) | `novedades.service.ts:160-197` |
| Depósito | `Contrato.depositoCustodia` + `LiquidarDepositoDto` (descuento agregado, sin ítems) | `recaudo.service.ts:256-288` |
| Trazabilidad | `RegistroAuditoria` (log HTTP genérico, sin valor anterior/nuevo) + `@AuditAction` | `auditoria/entities/registro-auditoria.entity.ts` |

---

# 4. MATRIZ DE ENTIDADES

| Entidad | Archivo | Campos monetarios (precisión) | Relaciones | Enums |
|---|---|---|---|---|
| Usuario | `usuarios/entities/usuario.entity.ts` | — | — | `Rol`: ADMINISTRADOR, RECEPCIONISTA |
| Cliente / Codeudor | `personas/entities/{cliente,codeudor}.entity.ts` | — | — | — |
| **Inmueble** | `inmuebles/entities/inmueble.entity.ts` | canonValor, depositoValor `decimal(12,2)` | **sin relación a Propietario** | EstadoInmueble: DISPONIBLE, OCUPADO, MANTENIMIENTO, INACTIVO |
| **Contrato** | `contratos/entities/contrato.entity.ts` | canonValor, saldoAFavor, depositoCustodia `decimal(12,2)` | cliente N:1, inmueble N:1, codeudores N:M | **EstadoContrato: ACTIVO, SUSPENDIDO, TERMINADO** |
| Obligacion | `obligaciones/entities/obligacion.entity.ts` | valorOriginal/valorAbonado/valorMoraAcumulada `decimal(12,2)` | contrato N:1 | TipoObligacion: CANON, NOVEDAD (sin MORA); EstadoObligacion: PENDIENTE, PARCIAL, PAGADA, ANULADA |
| ReciboCaja | `recaudo/entities/recibo-caja.entity.ts` | valorTotal, excedente `decimal(12,2)` | contrato N:1, detallesPago 1:N | EstadoRecibo: EMITIDO, ANULADO |
| DetallePago | `recaudo/entities/detalle-pago.entity.ts` | monto `decimal(12,2)` | recibo N:1 (**nullable**) | MedioPago: EFECTIVO, TRANSFERENCIA |
| AplicacionPago | `recaudo/entities/aplicacion-pago.entity.ts` | montoAplicado `decimal(12,2)` | recibo N:1 (**nullable**), obligacion N:1 (**nullable**) | — |
| SaldoFavorCredito | `recaudo/entities/saldo-favor-credito.entity.ts` | montoOriginal/montoDisponible `decimal(12,2)` | contrato N:1, recibo N:1 nullable | — |
| **Movimiento** | `movimientos/entities/movimiento.entity.ts` | monto `decimal(12,2)`, **sin medioPago** | ids sueltos sin FK real | TipoMovimiento: INGRESO, EGRESO; OrigenMovimiento: RECAUDO, NOVEDAD, DEPOSITO, MANUAL |
| Novedad | `novedades/entities/novedad.entity.ts` | montoAprobado `decimal(12,2)` nullable | inmueble N:1, contrato N:1 nullable | EstadoNovedad, ImpactoFinanciero: PENDIENTE, CARGO_ARRENDATARIO, GASTO_INMOBILIARIA |
| Empresa | `empresa/entities/empresa.entity.ts` | diasGraciaMora=5, porcentajeMoraMensual `decimal(5,2)`=1.50, horizonteMesesCanon=3 | — (fila única global) | — |
| Consecutivo | `empresa/entities/consecutivo.entity.ts` | ultimoNumero bigint, `@VersionColumn` | — | — |
| RegistroAuditoria | `auditoria/entities/registro-auditoria.entity.ts` | — (sin valorAnterior/valorNuevo) | — | — |

Todos los campos monetarios usan `decimal(12,2)` explícito; no se encontró ningún `float`/`double` en columnas de dinero (positivo, verificado por el agente de BD).

---

# 5. MATRIZ DE ROLES Y PERMISOS

Resultado global: el `RolesGuard` es **fail-closed** (`src/common/guards/roles.guard.ts`) — cualquier endpoint POST/PATCH/PUT/DELETE sin `@Roles` explícito se deniega automáticamente. No se encontró ningún endpoint financiero sensible sin protección de rol backend.

| Acción | Administrador | Recepcionista | Evidencia backend | ¿Coincide con §3.2? |
|---|---|---|---|---|
| Crear cliente/codeudor/inmueble/contrato | ✅ | ✅ | `*.controller.ts` (`@Roles(ADMIN, RECEP)`) | Sí |
| Terminar contrato | ✅ | ✅ | `contratos.controller.ts:42-47` | Sí |
| Registrar novedad | ✅ | ✅ | `novedades.controller.ts:21-26` | Sí |
| **Suspender contrato** | ✅ | ✅ | `contratos.controller.ts:49-54` | **No — la acción ni siquiera debería existir (§6.2)** |
| **Reactivar contrato** | ✅ | ✅ | `contratos.controller.ts:56-61` | **No — §6.6 exige "solamente Administrador"** |
| **Actualizar inmueble (`PATCH /inmuebles/:id`)** | ✅ | ✅ | `inmuebles.controller.ts:44-49` | Fuera de la lista cerrada de §3.2 — REQUIERE_DECISION_DE_NEGOCIO |
| **Cambiar estado de novedad (cierre)** | ✅ | ✅ | `novedades.controller.ts:40-45` | Fuera de la lista cerrada de §3.2 — REQUIERE_DECISION_DE_NEGOCIO |
| Registrar pago / anular recibo / liquidar depósito | ✅ | ❌ | `recaudo.controller.ts` (`@Roles(ADMIN)` de clase) | Sí |
| Anular obligación | ✅ | ❌ | `obligaciones.controller.ts:13,30-34` | Sí |
| Reversar movimiento | ✅ | ❌ | `movimientos.controller.ts:15,41-45` | Sí |
| Aprobar cargo/gasto de novedad | ✅ | ❌ | `novedades.controller.ts:48-69` | Sí |
| Gestión de usuarios | ✅ | ❌ | `usuarios.controller.ts:16` (clase) | Sí |
| Configurar empresa/mora (escritura) | ✅ | ❌ | `empresa.controller.ts:28-33` | Sí |
| Leer configuración de empresa (mora/gracia) | ✅ | ✅ (sin `@Roles`) | `empresa.controller.ts:23-26` | P5 — bajo impacto |

**Frontend:** consistente con backend en las áreas puramente financieras (`middleware/auth.global.ts` bloquea `/recaudo`, `/movimientos`, `/reportes`, `/administracion`, `/configuracion`, `/auditoria` para Recepcionista; los botones de aprobación en `novedades/index.vue` y edición en `clientes/codeudores` están ocultos vía `v-if="auth.esAdministrador"`). **Única discrepancia real:** los botones "Suspender"/"Reactivar" en `pages/contratos/index.vue:187-201` se muestran a cualquier usuario autenticado, materializando en UI el mismo exceso de permiso que existe en backend.

---

# 6. MATRIZ DE ESTADOS Y TRANSICIONES

## Contrato

| Estado actual | Acción | Rol permitido (código) | Estado nuevo | Efectos | Permitido según spec |
|---|---|---|---|---|---|
| (nuevo) | Crear | ADMIN, RECEP | ACTIVO | Inmueble→OCUPADO | Sí |
| ACTIVO | Terminar | ADMIN, RECEP | TERMINADO | Inmueble→DISPONIBLE, no borra deuda | Sí |
| ACTIVO | **Suspender** | ADMIN, RECEP | **SUSPENDIDO** | Inmueble sigue OCUPADO (no se libera) | **No — estado inexistente en el negocio** |
| SUSPENDIDO | **Reactivar** | ADMIN, RECEP | ACTIVO | `motivoTerminacion=null` (se borra el motivo previo); inmueble no se toca | **No — ni el estado de origen ni el rol ni la ausencia de motivo cumplen §6.6** |
| **TERMINADO** | **Reactivar** | — | — | **No existe ningún código que ejecute esta transición** | **Requerido por §6.6 y ausente** |

`generarCanonesMensuales()` solo procesa contratos `estado: ACTIVO` (`obligaciones.service.ts:27`), por lo que un contrato TERMINADO correctamente deja de generar canon nuevo.

## Inmueble

| Estado actual | Acción | Efectos | Validación cruzada con Contrato |
|---|---|---|---|
| DISPONIBLE | `Contrato.crear()` | →OCUPADO | Sí, con `pessimistic_write` y verificación de disponibilidad (`contratos.service.ts:42-57`) |
| OCUPADO | `Contrato.terminar()` | →DISPONIBLE | Sí (`contratos.service.ts:154`) |
| cualquiera | `PATCH /inmuebles/:id` con `estado` en body | Cambia a **cualquier valor del enum** | **No — sin ninguna consulta a la tabla `contrato`** (`inmuebles.service.ts:66-70`); la única barrera es de frontend |

## Obligación

| Estado actual | Acción | Estado nuevo | Validación |
|---|---|---|---|
| PENDIENTE | Abono parcial | PARCIAL | `aplicarAbono` (`obligaciones.service.ts:164-179`) |
| PARCIAL | Abono que completa | PAGADA | Idem |
| PENDIENTE (sin abonos) | Anular con motivo | ANULADA | `anular()` rechaza si `estado !== PENDIENTE` (`obligaciones.service.ts:151-161`) — correcto, protege contra ocultar deuda con abonos |

## Novedad

`ABIERTA → (impactoFinanciero: PENDIENTE) → [Administrador aprueba] → CARGO_ARRENDATARIO (genera Obligacion) | GASTO_INMOBILIARIA (genera Movimiento EGRESO inmediato — ver NOV-01) → CERRADA`

---

# 7. AUDITORÍA FINANCIERA

## 7.1 Flujo real de recaudo (tal como implementado)

```
POST /recaudo/pagos → RecaudoService.registrarPago() [recaudo.service.ts:35-152]
 1. valorTotalPago = Σ detallesPago.monto (sin separar por medio)
 2. Transacción + lock pesimista sobre Contrato
 3. disponible = valorTotalPago + saldoFavorDisponible
 4. Obligaciones PENDIENTE/PARCIAL ordenadas por fechaVencimiento ASC
    (⚠ SIN distinguir tipo CANON/NOVEDAD, ⚠ "Mora" no es una fila de obligación)
 5. Bucle: aplica dinero en ese orden cronológico puro
 6. excedente → SaldoFavorCredito (NUNCA se devuelve como "cambio" inmediato)
 7. Un único Movimiento INGRESO por el total (sin desglose de medio)
 8. Recibo + AplicacionPago persistidos (correcto, trazabilidad interna intacta)
```

## 7.2 Verificación del ejemplo numérico oficial (§10)

Canon=$400.000, Novedad=$150.000, Mora=$50.000, Pago=$500.000.

El código produce el resultado numérico correcto (Canon 400k, Novedad 100k, Mora 0) **por coincidencia de fechas**, no porque implemente la regla. El mecanismo real es `ORDER BY fechaVencimiento ASC` sin distinguir `tipo`. Dado que `crearObligacionNovedad` fija `fechaVencimiento = fecha de aprobación` (`obligaciones.service.ts:79`), una novedad aprobada hace semanas tiene fecha más antigua que el canon del mes corriente — en ese escenario realista, **el dinero se aplicaría a la novedad antes que al canon**, invirtiendo la prioridad exigida por §10. Ver hallazgo **RECAUDO-01**.

Adicionalmente, "Mora" nunca puede ser destino de un `AplicacionPago`: `TipoObligacion` solo admite `CANON | NOVEDAD` (`obligacion.entity.ts:4-7`). La mora calculada (`calcularMora()`, `obligaciones.service.ts:124-137`) se muestra en pantalla y en el reporte de cartera, pero el motor de recaudo no tiene ningún mecanismo para recibir dinero contra ella. **Es estructuralmente incobrable.**

## 7.3 Mora — verificación matemática

Fórmula implementada (`obligaciones.service.ts:135-136`): `mora = saldo_capital × (%/100) / 30 × días_atraso` — coincide algebraicamente con §11.2.

Simulación con el ejemplo oficial (fecha_pago=10-ago, gracia=5 → gracia=10..14, mora inicia 15-ago):
- **Pago dentro de gracia (12-ago):** `diasAtraso = max(0, floor((12-15)/día)) = 0` → mora=0. ✅ Correcto.
- **Consulta exactamente el 15-ago (primer día fuera de gracia):** `diasAtraso = floor((15-15)/día) = 0` → mora=0. **❌ Incorrecto** — según el propio ejemplo del negocio, el 15-ago ya debería producir mora>0 (día 1 de mora), pero el código lo trata como un sexto día de gracia. Off-by-one sistemático de 1 día, subestimado en el 100% de las obligaciones con mora. Ver **MORA-01**.
- **Porcentaje = 0:** `moraDiaria = saldo × 0 = 0` para cualquier atraso → mora=0 exacto. ✅ Correcto sin excepción.

La fórmula usa `new Date()` fijo y lee `porcentajeMoraMensual`/`diasGraciaMora` de la fila única y mutable de `Empresa`, sin versión histórica — un cambio de tasa hoy recalcula retroactivamente toda la mora de deuda abierta, sin dejar rastro de qué tasa aplicaba en qué fecha. Ver **MORA-02**.

## 7.4 "Cambio" vs. "Saldo a favor"

El código **no implementa** el "cambio inmediato" del §9.3/§15: cualquier excedente (venga en efectivo o transferencia) se convierte siempre en `SaldoFavorCredito`, consumido automáticamente en el siguiente pago (`recaudo.service.ts:101-136`). No existe ninguna rama de código que devuelva dinero físico en el momento. Ver **RECAUDO-02** (REQUIERE_DECISION_DE_NEGOCIO).

## 7.5 Caja, transferencias y devoluciones

`Movimiento` no tiene columna de medio de pago. Un recibo mixto EFECTIVO+TRANSFERENCIA genera un único `Movimiento` INGRESO indistinguible de un pago 100% efectivo. `MovimientosService.saldoNeto()` suma todo sin filtrar por medio, y el frontend lo presenta literalmente como "Saldo neto de caja". **Es estructuralmente imposible separar hoy cuánto dinero debería existir físicamente en caja de cuánto entró por banco.** Ver **CAJA-01** (P0).

No existe ningún módulo de "Caja" (saldo inicial, conteo físico, diferencia esperado-vs-contado, §15) ni de "control de transferencias" separado. Ver **CAJA-02**.

Las devoluciones/reversos sí cumplen el principio de no editar el movimiento original: `RecaudoService.anular()` y `MovimientosService.reversar()` siempre crean un registro nuevo referenciando al original, con motivo obligatorio (excepto el gap de validación en **AUD-02**).

## 7.6 Novedades y egresos — APROBADO ≠ PAGADO

`NovedadesService.aprobarGastoInmobiliaria()` (`novedades.service.ts:160-197`) llama a `movimientosService.registrarEgreso(...)` **en el mismo método que marca la aprobación** (líneas 182-193). No existe estado `PAGADO` en `ImpactoFinanciero` (solo `PENDIENTE | CARGO_ARRENDATARIO | GASTO_INMOBILIARIA`), ni ningún endpoint de "pago real" en todo el backend. El comentario del propio código lo confirma: "Genera un movimiento de caja tipo EGRESO asumido por la inmobiliaria" al aprobar. **Esto es exactamente el escenario que la sección 29 del prompt maestro prohíbe explícitamente ("No conviertas aprobación de gasto en pago").** Ver **NOV-01** (P0).

En cambio, "Cargo al arrendatario" está correctamente implementado: solo crea una `Obligacion` cobrable, sin tocar `Movimiento` (`novedades.service.ts:141-149`).

## 7.7 Depósito

`Contrato.depositoCustodia` nunca se convierte automáticamente en obligación/pago — correcto. Pero `LiquidarDepositoDto.valorDescuentos` es un único número agregado, sin lista de descuentos individuales con concepto/valor propio (§19 lo exige explícitamente). La devolución tampoco registra medio de pago (mismo root cause que CAJA-01). Ver **DEP-01**.

## 7.8 Recibo

`RecaudoService.obtener()` no incluye la relación `AplicacionPago` en su consulta, y `PdfReciboService` solo imprime medios de pago y totales — nunca concepto, período, mora separada ni saldo posterior por obligación, pese a que esa información sí se persiste correctamente en `AplicacionPago`. Ver **RECAUDO-03**.

---

# 8. AUDITORÍA DE INTEGRIDAD DE DATOS

- **Precisión decimal:** correcta en el 100% de los campos monetarios revisados (`decimal(12,2)`, mora `decimal(5,2)`). Sin `float`/`double`.
- **FKs nullable que deberían ser obligatorias:** `AplicacionPago.recibo`/`.obligacion` y `DetallePago.recibo` no tienen `{ nullable: false }` — lógicamente nunca deberían existir sin su padre. Ver **BD-01** (P4).
- **Referencias sin FK real:** `Movimiento.reciboId/novedadId/contratoId` y `Obligacion.novedadOrigenId` son `uuid`/`varchar` sueltos sin constraint FK — patrón de desacoplamiento deliberado entre módulos, pero sacrifica integridad referencial estructural. Ver **BD-02** (P4).
- **Doble contrato ACTIVO sobre el mismo inmueble:** sin protección estructural en BD (no hay unique/índice parcial); mitigado solo a nivel aplicativo con `pessimistic_write` + verificación dentro de la transacción de `ContratosService.crear()`. Razonable como mitigación pero no es una invariante estructural. Ver **BD-03** (P4).
- **Inmueble.estado editable sin validación cruzada:** ver **CONT-03** (P1) — es también un problema de integridad de datos, no solo de permisos.

---

# 9. AUDITORÍA DE SEGURIDAD

- El `RolesGuard` es fail-closed a nivel de framework (`src/common/guards/roles.guard.ts`) — ningún endpoint mutante queda abierto por omisión. Esto es una fortaleza arquitectónica real.
- Ningún endpoint financiero sensible (pago, anulación, reverso, aprobación, liquidación de depósito, configuración de mora) carece de `@Roles(ADMINISTRADOR)`.
- La única brecha de seguridad concreta es la combinación **CONT-01/CONT-02**: Recepcionista puede ejecutar `suspender`/`reactivar` sobre contratos, una acción que el negocio reserva explícitamente a Administrador (§6.6) y que ni siquiera debería existir como concepto (§6.2).
- Brechas menores (P2-P3, REQUIERE_DECISION_DE_NEGOCIO): Recepcionista puede editar cualquier campo de un inmueble (incluido canon/depósito) vía `PATCH /inmuebles/:id`, y puede cerrar una novedad con impacto financiero aún pendiente.
- No se encontró ningún caso de "seguridad = botón oculto": todas las restricciones de UI están respaldadas por el guard de backend, excepto el caso ya mencionado de Contratos, donde ni backend ni frontend imponen la barrera correcta.

---

# 10. AUDITORÍA BACKEND

Patrón dominante correcto: `RecaudoService.registrarPago/anular/liquidarDeposito`, `ObligacionesService.aplicarAbono/revertirAbono` y `NovedadesService` (creación/aprobación) usan `dataSource.transaction` + `pessimistic_write` + propagación de `manager` de forma consistente y bien diseñada.

El patrón se rompe puntualmente en:
- `ObligacionesService.generarCanonesMensuales()` — check-then-insert sin transacción ni lock, sin índice UNIQUE `(contratoId, tipo, periodo)` en BD. Riesgo real de canon duplicado si el cron nocturno coincide con un disparo manual. Ver **CONC-01** (P1).
- `MovimientosService.reversarManual()` — check-then-act sin `pessimistic_write` sobre el movimiento original, y sin constraint UNIQUE sobre `movimientoOriginalId`. Dos solicitudes concurrentes de reverso sobre el mismo movimiento pueden generar **dos reversos**, duplicando el impacto en caja. Ver **CONC-02** (P0 — el más grave de concurrencia, porque corrompe directamente el saldo).
- El mismo método, al no propagar su propio `manager` a `ConsecutivoService.siguiente()`, puede dejar un hueco permanente de numeración si el `INSERT` del reverso falla después de confirmado el consecutivo. Ver **CONC-03** (P1).
- `ObligacionesService.anular()` — sin lock; dos anulaciones simultáneas de la misma obligación PENDIENTE no corrompen dinero pero pueden perder silenciosamente el motivo original por sobre-escritura. Ver **CONC-04** (P3).
- `ContratosService.suspender/reactivar()` — sin transacción, a diferencia de `terminar()` que sí la usa.
- `AnularReciboDto.motivo` y `AnularObligacionDto.motivo` aceptan cadena vacía (`@IsString()` sin `@IsNotEmpty()`), a diferencia de `ReversarMovimientoDto` que sí lo exige correctamente. Ver **AUD-02** (P3).

---

# 11. AUDITORÍA FRONTEND

**Hallazgo positivo relevante:** no se encontró ningún cálculo financiero duplicado en el frontend. Mora, saldo, cartera, recaudo y saldo neto se leen siempre de respuestas del backend; `useFormatoCO.ts` solo formatea, `useExcelExport.ts`/`usePdfDownload.ts` solo descargan binarios ya generados en servidor. Esto cumple el principio de "cartera como vista operativa" (§12).

Manejo de errores: consistente, todas las páginas capturan errores HTTP y los muestran vía alertas; la única excepción es un `catch` vacío deliberado y documentado en `auth.store.ts` (logout best-effort), que es una decisión de diseño razonable, no un hallazgo.

Discrepancias reales frontend↔backend:
- `pages/contratos/index.vue` no oculta "Suspender"/"Reactivar" tras `auth.esAdministrador`, a diferencia del patrón correcto usado en Clientes/Codeudores/Novedades.
- `pages/contratos/nuevo.vue` precarga el día de pago en `5` fijo, sin derivarlo de la fecha de inicio (ver **CONT-04**).
- `pages/recaudo/index.vue` solo permite un input numérico agregado para descuentos de depósito (ver **DEP-01**).
- `pages/movimientos/index.vue` presenta el "saldo neto" mezclado como si fuera caja física (ver **CAJA-01**).

---

# 12. AUDITORÍA DE CONCURRENCIA

Ver detalle completo en sección 10. Resumen de riesgo:

| Operación | Transacción | Lock | Riesgo de carrera |
|---|---|---|---|
| Registrar pago | ✅ | ✅ (`pessimistic_write` sobre Contrato) | Bajo |
| Anular recibo | ✅ | ✅ (sobre ReciboCaja + Contrato) | Bajo |
| Liquidar depósito | ✅ | ✅ (sobre Contrato) | Bajo |
| Generar canon (cron + manual) | ❌ | ❌ | **Alto — CONC-01** |
| Reversar movimiento manual | ❌ | ❌ | **Crítico — CONC-02** |
| Anular obligación | ❌ | ❌ | Medio — CONC-04 |
| Suspender/reactivar contrato | ❌ | ❌ | Medio (agravado por ser también una violación de regla de negocio) |

---

# 13. AUDITORÍA DE REPORTES

Backend usa `exceljs` — decisión técnica válida (§23). Existen 4 reportes `.xlsx`: contratos, cartera (incluye mora y fila de totales), recaudo, inmuebles-por-barrio — todos `@Roles(ADMINISTRADOR)`, y el frontend expone exactamente estos 4. **Consistencia correcta para lo que existe.**

**Faltante:** no existe ningún reporte de caja/movimientos/transferencias, porque el objeto de negocio "Caja" (§15) nunca se modeló (ver CAJA-02). El dashboard financiero (`dashboard.service.ts`) recalcula cartera directamente de `obligacion` sin duplicar lógica — correcto, misma fuente de verdad que Recaudo y Excel de cartera.

---

# 14. INVARIANTES VERIFICADAS (contra la lista de la sección 22 de la especificación)

| # | Invariante | Cumple | Evidencia / hallazgo asociado |
|---|---|---|---|
| 1 | Inmueble con contrato ACTIVO no puede estar disponible | Parcial | Flujo normal sí; `PATCH /inmuebles/:id` lo puede romper — **CONT-03** |
| 2 | Contrato TERMINADO no genera nuevas obligaciones | Sí | `generarCanonesMensuales` filtra `estado=ACTIVO` |
| 3 | Terminar no elimina obligaciones pendientes | Sí | `terminar()` no toca `obligacion` |
| 4 | Obligación ANULADA no sigue cobrable | Sí | `pendientesPorContrato`/`todasPendientes` excluyen ANULADA |
| 5 | Obligación con abonos no se anula silenciosamente | Sí | `anular()` rechaza `estado != PENDIENTE` |
| 6 | Un abono no crea obligación nueva | Sí | `aplicarAbono` solo hace UPDATE |
| 7 | Aplicación respeta Canon→Novedad→Mora | **No** | **RECAUDO-01** |
| 8 | La mora nunca genera nueva mora | Sí | cálculo siempre sobre capital, nunca sobre `valorMoraAcumulada` |
| 9 | Porcentaje 0 → mora 0 | Sí | verificado matemáticamente |
| 10 | Efectivo modifica caja | **No verificable — mezclado** | **CAJA-01** |
| 11 | Transferencia no modifica caja física | **No** | **CAJA-01** |
| 12 | Devolución no borra movimiento original | Sí | `reversar()`/`anular()` siempre crean registro nuevo |
| 13 | Aprobación de gasto no genera movimiento hasta pago real | **No** | **NOV-01** |
| 14 | Toda mutación financiera es trazable | Parcial | `@AuditAction` cubre todos los endpoints financieros, pero sin valor anterior/nuevo — **AUD-01** |
| 15 | Correcciones financieras requieren motivo | Parcial | Exigido en 2 de 3 DTOs; **AUD-02** permite motivo vacío en los otros 2 |
| 16 | Frontend no es la única barrera de autorización | Sí (con la excepción de Contratos) | Ver sección 9 |
| 17 | Recaudo, caja y transferencias son conceptos distintos | **No** | **CAJA-01**, **CAJA-02** |
| 18 | Recibo refleja la aplicación real del dinero | **No** | **RECAUDO-03** |
| 19 | Historial de terminación/reactivación se conserva | **No** | **CONT-02** (se borra `motivoTerminacion`) |
| 20 | Reportes financieros exportables a XLSX | Parcial | 4/4 reportes existentes son exportables; falta el reporte de Caja porque el módulo no existe |

**8 de 20 invariantes financieras no se cumplen o se cumplen solo parcialmente.**

---

# 15. HALLAZGOS

Cada hallazgo consolida la evidencia coincidente de los distintos agentes de auditoría que lo detectaron de forma independiente (indicado entre paréntesis).

## P0 — Riesgo crítico

### CAJA-01 — La caja física y las transferencias bancarias están mezcladas en un único ledger sin distinguir medio de pago
**Categoría:** INTEGRIDAD_FINANCIERA
**Regla afectada:** §14.2, §14.3, §22 invariantes 10/11/17
**Comportamiento actual:** `Movimiento` (`movimientos/entities/movimiento.entity.ts:22-70`) no tiene columna de medio de pago. `RecaudoService.registrarPago` (`recaudo.service.ts:139-149`) suma todos los `DetallePago` (que sí distinguen EFECTIVO/TRANSFERENCIA) en un único `Movimiento` INGRESO agregado. `MovimientosService.saldoNeto()` (`movimientos.service.ts:158-169`) suma todo sin filtrar por medio, y el frontend (`pages/movimientos/index.vue:115-122`) lo presenta como "Saldo neto de caja".
**Comportamiento esperado:** Un ingreso por transferencia debe afectar únicamente el control bancario; uno en efectivo, únicamente la caja física; ambos deben ser calculables por separado.
**Por qué importa:** Un arqueo físico de caja nunca podrá cuadrar contra este número. Es la invariante más básica de control de dinero físico del negocio y hoy es estructuralmente inobservable.
**Evidencia:** `movimiento.entity.ts` (sin campo), `recaudo.service.ts:36,139-149`, `movimientos.service.ts:158-169`, `pages/movimientos/index.vue:115-122`. Confirmado independientemente por 4 agentes (DB, Caja/Novedades, Frontend, Recaudo).
**Certeza:** ALTA
**Recomendación:** Agregar `medioPago` a `Movimiento` (o generar un movimiento por cada `DetallePago`), y que `saldoNeto()`/futuros endpoints de caja filtren por medio.
**Criterio de aceptación:** Un recibo mixto de $300k efectivo + $200k transferencia genera movimientos distinguibles por medio; caja física solo suma los de efectivo.
**Pruebas necesarias:** Unit test de pago mixto verificando impacto separado en caja física vs. control bancario.

### CONC-02 — Doble reverso posible en `PATCH /movimientos/:id/reversar` por ausencia de lock
**Categoría:** CONCURRENCIA / INTEGRIDAD_FINANCIERA
**Regla afectada:** §22 invariante 12
**Comportamiento actual:** `MovimientosService.reversarManual` (`movimientos.service.ts:117-133`) hace `findOne` del original y `findOne` de "¿ya reversado?" **sin `pessimistic_write`**, a diferencia de `RecaudoService.anular` que sí bloquea la fila antes de verificar el estado. `Movimiento.movimientoOriginalId` no tiene índice UNIQUE.
**Comportamiento esperado:** Igual patrón que `RecaudoService.anular`: lock pesimista antes de verificar y crear el reverso.
**Por qué importa:** Dos solicitudes concurrentes sobre el mismo movimiento (doble clic, dos operadores) generan **dos** movimientos de reverso, duplicando el efecto en caja/transferencias — corrupción financiera real, no teórica.
**Evidencia:** `movimientos.service.ts:117-133`; contraste con el patrón correcto en `recaudo.service.ts:193-202`.
**Certeza:** ALTA
**Recomendación:** Aplicar `pessimistic_write` sobre el movimiento original dentro de la misma transacción que inserta el reverso, o agregar UNIQUE parcial sobre `movimientoOriginalId`.
**Criterio de aceptación:** Dos solicitudes concurrentes de reverso sobre el mismo id producen exactamente un reverso.
**Pruebas necesarias:** Test de concurrencia con dos promesas simultáneas sobre el mismo `movimientoId`.

### NOV-01 — Aprobar un gasto de novedad genera el movimiento financiero de inmediato (APROBADO = PAGADO)
**Categoría:** REGLA_NEGOCIO / INTEGRIDAD_FINANCIERA
**Regla afectada:** §17, §18, §22 invariante 13; prohibición explícita en §29 del prompt maestro
**Comportamiento actual:** `NovedadesService.aprobarGastoInmobiliaria` (`novedades.service.ts:160-197`, líneas 182-193) llama a `registrarEgreso` en el mismo método que marca la aprobación. `ImpactoFinanciero` no tiene estado `PAGADO`; no existe ningún endpoint de "pago real" en todo el backend.
**Comportamiento esperado:** Aprobar debe dejar el gasto en "APROBADO, pendiente de pago", sin movimiento financiero; un paso separado de "pago real" (con medio explícito) debe ser el único que dispare el `Movimiento`.
**Por qué importa:** Es el escenario exacto que la especificación advierte no debe ocurrir. Distorsiona el saldo de caja/banco con egresos aprobados pero no desembolsados realmente.
**Evidencia:** `novedades.service.ts:155-197`; `novedad.entity.ts:18-22` (enum sin PAGADO); confirmado independientemente por 4 agentes (Caja/Novedades, Frontend, Concurrencia, Recaudo).
**Certeza:** ALTA
**Recomendación:** Separar en dos pasos: aprobación (sin movimiento) y pago real (con medio, dispara `registrarEgreso`).
**Criterio de aceptación:** Tras aprobar un gasto, `GET /movimientos` no muestra ningún movimiento asociado hasta que se registre el pago real.
**Pruebas necesarias:** Test que aprueba y verifica ausencia de movimiento; test que paga y verifica su creación.

### RECAUDO-01 — El orden Canon→Novedad→Mora no está implementado; la mora nunca es cobrable
**Categoría:** INTEGRIDAD_FINANCIERA / REGLA_NEGOCIO
**Regla afectada:** §10, §22 invariante 7
**Comportamiento actual:** `RecaudoService.registrarPago` (`recaudo.service.ts:63-83`) ordena las obligaciones pendientes únicamente por `fechaVencimiento ASC`, sin distinguir `tipo`. `TipoObligacion` solo admite `CANON | NOVEDAD` — "Mora" no existe como fila de obligación y por tanto nunca puede recibir una `AplicacionPago`. El resultado del ejemplo oficial del §10 coincide numéricamente solo por casualidad de fechas relativas; con una novedad más antigua que el canon del período (escenario realista, dado que `crearObligacionNovedad` fija `fechaVencimiento = fecha de aprobación`), el dinero se aplicaría a la novedad antes que al canon, invirtiendo la prioridad exigida.
**Comportamiento esperado:** Canon íntegro primero, luego Novedad, luego Mora — independiente de fechas relativas entre tipos.
**Por qué importa:** Es la regla de aplicación de dinero explícitamente definida por el negocio (reemplaza FIFO genérico), y su ausencia significa que la mora acumulada, aunque se calcule y se muestre en cartera, **nunca puede cobrarse** por el sistema.
**Evidencia:** `recaudo.service.ts:62-83`; `obligacion.entity.ts:4-7`; `obligaciones.service.ts:74-85,124-137`. Confirmado independientemente por 2 agentes (Frontend, Recaudo) con simulación numérica exacta del ejemplo oficial.
**Certeza:** ALTA
**Recomendación:** Ordenar explícitamente por tipo (`CASE tipo WHEN CANON THEN 0 WHEN NOVEDAD THEN 1 END, fechaVencimiento ASC`) y diseñar, junto con RDN-02, cómo modelar la mora como partida aplicable.
**Criterio de aceptación:** El ejemplo exacto del §10 se reproduce incluso cuando la novedad es más antigua que el canon.
**Pruebas necesarias:** Caso oficial del §10; caso con novedad más antigua que canon (hoy rompe la regla).

## P1 — Violación de regla de negocio

### CONT-01 — Estado `SUSPENDIDO` reintroducido en Contrato, prohibido explícitamente por la especificación
**Categoría:** REGLA_NEGOCIO
**Regla afectada:** §6.2, §29
**Comportamiento actual:** `EstadoContrato` incluye `SUSPENDIDO` (`contrato.entity.ts:16-20`), persistido en el enum de BD, con endpoints `PATCH /contratos/:id/suspender`/`reactivar` funcionales, expuestos en UI (`pages/contratos/index.vue`). Mientras un contrato está SUSPENDIDO, el inmueble permanece OCUPADO sin liberar.
**Comportamiento esperado:** Solo ACTIVO/TERMINADO.
**Por qué importa:** Tercer estado de negocio no autorizado, con reglas propias no especificadas (disponibilidad, generación de obligaciones) y que contradice literalmente la fuente de verdad.
**Evidencia:** confirmado independientemente por **6 de los 8 agentes** (RBAC, Contratos, DB, Caja/Novedades, Frontend, Obligaciones/Mora, Recaudo) — es el hallazgo con mayor consenso de toda la auditoría.
**Certeza:** ALTA
**Dependencias:** CONT-02.
**Recomendación:** Requiere decisión de negocio previa (ver RDN-03) antes de eliminar código en producción, dado que contratos reales pueden estar en este estado hoy.
**Criterio de aceptación:** `EstadoContrato` solo admite ACTIVO/TERMINADO; migración de datos para contratos SUSPENDIDO existentes.
**Pruebas necesarias:** Verificar inventario de contratos SUSPENDIDO en producción antes de cualquier cambio; test de que ningún endpoint puede producir un tercer estado.

### CONT-02 — La reactivación TERMINADO→ACTIVO exigida por el negocio no existe; lo implementado (SUSPENDIDO→ACTIVO) carece de motivo, rol correcto y trazabilidad
**Categoría:** GAP_FUNCIONAL / REGLA_NEGOCIO / SEGURIDAD
**Regla afectada:** §6.6, §22 invariante 19
**Comportamiento actual:** `reactivar()` (`contratos.service.ts:173-181`) solo acepta `estado === SUSPENDIDO`; ningún contrato TERMINADO puede reactivarse. El endpoint no recibe `motivo` (sin `@Body()`), está permitido para RECEPCIONISTA (`@Roles(ADMIN, RECEP)`), no reocupa el inmueble, y **borra** `motivoTerminacion` (`= null`) en vez de conservarlo.
**Comportamiento esperado:** TERMINADO→ACTIVO, exclusivo de Administrador, motivo obligatorio, inmueble reocupado, historial de terminación preservado.
**Por qué importa:** Es una violación cuádruple de la misma regla (estado de origen, rol, motivo, conservación histórica) sobre una transición explícitamente definida por el negocio.
**Evidencia:** confirmado independientemente por 5 agentes (RBAC, Contratos, DB, Frontend, Obligaciones/Mora, Concurrencia).
**Certeza:** ALTA
**Dependencias:** CONT-01.
**Recomendación:** Reescribir `reactivar()` para operar solo sobre TERMINADO, con DTO que exija `motivo`, restringido a `@Roles(ADMINISTRADOR)`, reocupando el inmueble con la misma verificación de disponibilidad usada en `crear()`, y preservando `fechaFin`/`motivoTerminacion` en un campo/tabla de historial separado.
**Criterio de aceptación:** Dado un contrato TERMINADO, Administrador lo reactiva con motivo → ACTIVO, inmueble OCUPADO, fecha de terminación histórica sigue consultable; Recepcionista recibe 403.
**Pruebas necesarias:** Rechazo por rol; rechazo sin motivo; verificación de inmueble ya ocupado por otro contrato; conservación de historial.

### CONT-03 — Disponibilidad de inmueble editable directamente por API sin validar contrato activo
**Categoría:** INTEGRIDAD_FINANCIERA / DATOS
**Regla afectada:** §5, §22 invariante 1
**Comportamiento actual:** `PATCH /inmuebles/:id` acepta `estado` sin restricción de valores; `InmueblesService.actualizar()` (`inmuebles.service.ts:66-70`) hace `Object.assign` + `save` sin consultar la tabla `contrato`. La única protección es de frontend (UI limita las opciones a MANTENIMIENTO/INACTIVO), reconocida como tal en un comentario del propio código.
**Comportamiento esperado:** El backend debe rechazar forzar `DISPONIBLE` en un inmueble con contrato ACTIVO, o `OCUPADO` sin uno.
**Por qué importa:** Cualquier cliente API distinto del frontend oficial puede romper la invariante central de disponibilidad.
**Evidencia:** `inmuebles.service.ts:66-70`, `dto/update-inmueble.dto.ts:1-4`. Detectado por el agente de Contratos/Inmuebles.
**Certeza:** ALTA
**Recomendación:** Validar en el service que un cambio a DISPONIBLE/OCUPADO sea consistente con la existencia de un contrato ACTIVO, o remover `estado` de `UpdateInmuebleDto` y exponer transiciones explícitas separadas.
**Criterio de aceptación:** PATCH a DISPONIBLE con contrato ACTIVO existente → 400.
**Pruebas necesarias:** Test de integración con inmueble ocupado + intento de forzar disponibilidad.

### PROP-01 — La entidad Propietario no existe en absoluto
**Categoría:** GAP_FUNCIONAL / REGLA_NEGOCIO
**Regla afectada:** §4 — "Todo inmueble debe quedar asociado a una entidad Propietario"; "1 Propietario → N Inmuebles"; propietario especial "INMOBILIARIA"
**Comportamiento actual:** No existe ningún archivo `propietario.entity.ts`; `Inmueble` no tiene columna ni relación hacia propietario; `seed.ts` nunca crea un propietario "INMOBILIARIA".
**Comportamiento esperado:** Entidad `Propietario` con FK 1:N desde `Inmueble`, seed del propietario especial.
**Por qué importa:** Es un requisito de modelo de datos explícito y obligatorio ("todo inmueble debe") que simplemente no fue implementado — no es un matiz, es una ausencia total.
**Evidencia:** `inmuebles/entities/inmueble.entity.ts` (sin columna); `database/seeds/seed.ts` (sin propietario). Detectado por el agente de BD.
**Certeza:** ALTA
**Recomendación:** Definir entidad `Propietario`, migración, FK NOT NULL en `Inmueble`, seed de "INMOBILIARIA".
**Criterio de aceptación:** Todo inmueble creado exige `propietarioId`; existe "INMOBILIARIA" tras el seed inicial.
**Pruebas necesarias:** Test de creación de inmueble sin propietario → rechazo; test de migración de datos para inmuebles existentes.

### MORA-01 — Off-by-one: el primer día de mora se calcula sistemáticamente con 0 días
**Categoría:** BUG / INTEGRIDAD_FINANCIERA
**Regla afectada:** §11.1
**Comportamiento actual:** `calcularMora()` (`obligaciones.service.ts:128-133`) calcula correctamente `vencimientoConGracia = fechaVencimiento + diasGracia` (10-ago+5=15-ago, coincide con el ejemplo), pero `diasAtraso = floor((hoy - vencimientoConGracia)/día)` produce `0` exactamente el 15-ago — el negocio dice que la mora "inicia el 15", pero el código no genera mora>0 hasta el 16-ago.
**Comportamiento esperado:** El 15-ago (primer día fuera de gracia) debe producir al menos 1 día de mora.
**Por qué importa:** Subestimación sistemática de 1 día de interés en el 100% de las obligaciones con mora, durante toda su vida útil como deuda.
**Evidencia:** `obligaciones.service.ts:128-133`. Confirmado independientemente por 2 agentes (Obligaciones/Mora, Recaudo) con simulación numérica idéntica.
**Certeza:** ALTA
**Recomendación:** `diasAtraso = floor((hoy - vencimientoConGracia)/día) + 1` cuando `hoy >= vencimientoConGracia`, o usar como frontera el último día de gracia.
**Criterio de aceptación:** Con vencimiento 10-ago y gracia=5, consultar el 15-ago produce `diasAtraso=1`.
**Pruebas necesarias:** Test parametrizado por fecha (14, 15, 16-ago).

### CONC-01 — Generación de canon sin transacción ni lock: riesgo de obligaciones CANON duplicadas
**Categoría:** CONCURRENCIA / INTEGRIDAD_FINANCIERA
**Regla afectada:** §7
**Comportamiento actual:** `generarCanonesMensuales()` (`obligaciones.service.ts:23-63`) hace check-then-insert sin `dataSource.transaction` ni `pessimistic_write`, y no existe índice UNIQUE `(contratoId, tipo, periodo)` en BD. El cron nocturno y el endpoint manual (`POST /obligaciones/generar-canones`) invocan el mismo método sin exclusión mutua.
**Comportamiento esperado:** Garantía estructural (constraint UNIQUE) y/o transaccional contra duplicados.
**Por qué importa:** Una obligación CANON duplicada infla la cartera y puede generar cobro doble real al arrendatario.
**Evidencia:** `obligaciones.service.ts:23-63`; `migrations/1786664727402-InicialEsquema.ts` (sin UNIQUE). Confirmado por 2 agentes (Contratos, Concurrencia).
**Certeza:** MEDIA (defecto estructural cierto; probabilidad de colisión real depende de la operación)
**Recomendación:** Índice UNIQUE `(contratoId, tipo, periodo)` + transacción con lock.
**Criterio de aceptación:** Dos invocaciones concurrentes para el mismo contrato/periodo nunca producen más de una obligación CANON.
**Pruebas necesarias:** Test de concurrencia disparando dos generaciones en paralelo.

### CONC-03 — Reverso manual no comparte transacción con el consecutivo: riesgo de hueco de numeración
**Categoría:** CONCURRENCIA / DATOS
**Comportamiento actual:** `reversarManual` invoca `ConsecutivoService.siguiente()` sin pasar su `manager`, por lo que el consecutivo se confirma en su propia transacción antes del `INSERT` del movimiento de reverso — si este último falla, el número queda consumido sin documento asociado. El propio comentario de `consecutivo.service.ts:19-24` documenta este riesgo como algo a evitar.
**Evidencia:** `movimientos.service.ts:76-133`; `consecutivo.service.ts:19-24,58-59`.
**Certeza:** ALTA
**Recomendación:** `reversarManual` debe abrir su propia transacción y propagar el `manager`.
**Criterio de aceptación:** Un fallo simulado en el INSERT del reverso hace rollback también del consecutivo.

### RECAUDO-02 — El "cambio inmediato" del §9.3/§15 no existe; todo excedente se convierte en un crédito acumulable no documentado
**Categoría:** REGLA_NEGOCIO
**Comportamiento actual:** Cualquier excedente (efectivo o transferencia) se convierte siempre en `SaldoFavorCredito`/`Contrato.saldoAFavor`, consumido automáticamente en pagos futuros. No existe ninguna rama de devolución física inmediata.
**Evidencia:** `recaudo.service.ts:47-60,86-103,130-136`. Ver también **RDN-01**.
**Certeza:** ALTA en cuanto al comportamiento; requiere decisión de negocio sobre si es correcto.
**Recomendación:** Ver sección 18, RDN-01.

### RECAUDO-03 — El recibo (API + PDF) no puede mostrar concepto, período, mora separada ni saldo posterior
**Categoría:** GAP_FUNCIONAL / REGLA_NEGOCIO
**Regla afectada:** §20, §22 invariante 18
**Comportamiento actual:** `RecaudoService.obtener()` no incluye la relación `AplicacionPago`; `PdfReciboService.generar()` solo imprime medios de pago y totales.
**Evidencia:** `recaudo.service.ts:155-162`; `pdf-recibo.service.ts:163-222`.
**Certeza:** ALTA
**Recomendación:** Incluir `aplicaciones` (con concepto/período/tipo de la obligación) en `obtener()` y añadir tabla de aplicación al PDF.
**Criterio de aceptación:** Un recibo con aplicación a 2 obligaciones muestra cada concepto/período/valor aplicado en PDF y JSON.

## P2 — Funcionalidad requerida ausente

### CAJA-02 — No existe módulo de "Caja" (saldo inicial, conteo físico, diferencia) ni de "control bancario" separado
**Regla afectada:** §15
**Evidencia:** ausencia confirmada por búsqueda exhaustiva; sin entidad, sin endpoint. Confirmado por 4 agentes.
**Recomendación:** Modelar entidad de arqueo de caja, alimentada por `Movimiento` una vez resuelto CAJA-01.

### DEP-01 — Descuentos del depósito sin desglose por concepto y valor; devolución sin medio de pago
**Regla afectada:** §19
**Evidencia:** `liquidar-deposito.dto.ts:1-7` (un solo número agregado); `recaudo.service.ts:256-288`.
**Recomendación:** Reemplazar `valorDescuentos: number` por lista de `{concepto, valor}`; agregar `medioPago` a la devolución.

### CONT-05 — Obligaciones CANON generadas por adelantado no se ajustan al terminar el contrato antes de esos periodos
**Regla afectada:** §6.4, §7
**Comportamiento actual:** El horizonte de generación (default 3 meses) puede dejar canon futuro ya generado y cobrable tras una terminación anticipada; `terminar()` no consulta ni ajusta `obligacion`.
**Evidencia:** `obligaciones.service.ts:23-63`; `contratos.service.ts:141-161`.
**Nota:** el destino correcto de esas obligaciones (anular automáticamente vs. dejar a criterio manual) es ambiguo — ver **RDN-04**.

### AUD-01 — La tabla central de auditoría no captura motivo ni valor anterior/nuevo
**Regla afectada:** §21
**Comportamiento actual:** `RegistroAuditoria` solo guarda módulo/acción/usuario/ruta/duración/IP — no el body de la petición ni valores antes/después. Esa información existe pero está fragmentada por entidad de negocio (`motivoAnulacion`, etc.), no consolidada.
**Evidencia:** `registro-auditoria.entity.ts`; `audit.interceptor.ts:35-51`.
**Nota:** ver **RDN-05** — depende de si el patrón "anular + re-registrar" ya satisface el espíritu de §21.

## P3 — Integración / UX operativa

### CONT-04 — Fecha de pago del canon no hereda la fecha de inicio por defecto
**Regla afectada:** §6.1
**Comportamiento actual:** `diaPago` es obligatorio en el DTO (sin `@IsOptional`); frontend precarga `5` fijo, sin derivarlo del día de `fechaInicio`.
**Evidencia:** `create-contrato.dto.ts:18`; `pages/contratos/nuevo.vue:55`.
**Recomendación:** Hacer `diaPago` opcional; si no se envía, derivarlo server-side de `fechaInicio.getDate()`.

### AUD-02 — DTOs de anulación permiten motivo vacío
**Regla afectada:** §22 invariante 15
**Comportamiento actual:** `AnularReciboDto.motivo` y `AnularObligacionDto.motivo` usan `@IsString()` sin `@IsNotEmpty()`, a diferencia de `ReversarMovimientoDto` que sí lo exige.
**Evidencia:** `dto/anular-recibo.dto.ts:1-5`; `dto/anular-obligacion.dto.ts:1-5`.
**Recomendación:** Agregar `@IsNotEmpty()` a ambos.

### CONC-04 — `ObligacionesService.anular()` sin lock pesimista
**Comportamiento actual:** Dos anulaciones simultáneas de la misma obligación PENDIENTE pueden sobrescribir silenciosamente el motivo original sin error, aunque no hay pérdida financiera.
**Evidencia:** `obligaciones.service.ts:151-161`.

### RBAC-01 — Recepcionista puede actualizar cualquier campo de un inmueble, incluidos canon/depósito
**Nota:** el canon editado se propaga automáticamente al crear un nuevo contrato (`contratos.service.ts:66`). Ver **RDN-06**.

### RBAC-02 — Recepcionista puede cerrar una novedad con impacto financiero aún pendiente
**Evidencia:** `novedades.service.ts:91-107,199-206` — la validación de bloqueo existe para ANULAR pero no para CERRAR. Ver **RDN-07**.

## P4 — Deuda técnica

### BD-01 — FKs nullable que deberían ser NOT NULL (`AplicacionPago.recibo/obligacion`, `DetallePago.recibo`)
### BD-02 — Referencias sueltas sin FK real (`Movimiento.reciboId/novedadId/contratoId`, `Obligacion.novedadOrigenId`)
### BD-03 — Sin protección estructural en BD contra dos contratos ACTIVOS sobre el mismo inmueble (mitigado aplicativamente con lock)

## P5 — Mejora

### RBAC-03 — `GET /empresa` (incluye % de mora) sin restricción de rol, accesible a Recepcionista
### MORA-02 — El cálculo de mora no es función pura ni versiona la tasa histórica (`Empresa` es fila global mutable sin historial) — reconstrucción exacta retroactiva no garantizada tras un cambio de tasa

---

# 16. HALLAZGOS HISTÓRICOS

| Hallazgo histórico | Estado |
|---|---|
| Estado `EN_TERMINACION` presente en el enum original de Contrato | **CORREGIDO** — retirado explícitamente en la migración `1786730000000-AnulacionObligacionYRetiroEnTerminacion.ts:9-17`, con comentario que documenta que nunca fue asignado por ningún flujo de negocio. No debe reabrirse. |
| Estado `SUSPENDIDO` presente en el enum original de Contrato | **VIGENTE** — a diferencia de `EN_TERMINACION`, nunca fue limpiado con el mismo criterio; sigue activamente cableado en servicio, controller y frontend. Ver **CONT-01**. |

No se identificaron otros hallazgos históricos rastreables en el código actual más allá de estos dos, dado que no se proporcionaron los documentos de auditorías anteriores como entrada — esta sección se limita a lo que las migraciones y comentarios del propio código documentan explícitamente como corregido.

---

# 17. ELEMENTOS FUERA DE ALCANCE

Confirmado: ningún hallazgo de esta auditoría corresponde a los elementos explícitamente excluidos por la sección 2 de la especificación (comisiones a propietarios, liquidación al propietario, cuentas por pagar al propietario, DIAN/IVA, condonación de deuda). No se encontró ningún código que implemente parcialmente ninguno de estos — su ausencia es correcta y no debe tratarse como bug.

---

# 18. REQUIERE_DECISION_DE_NEGOCIO

### RDN-01 — ¿El excedente de un pago debe devolverse como "cambio" físico inmediato, o el modelo de "saldo a favor" acumulable (ya implementado) es la política real del negocio?
**Qué hace el código:** Convierte siempre el excedente en crédito consumible en pagos futuros (`SaldoFavorCredito`), nunca en devolución inmediata.
**Interpretaciones posibles:** (a) es la práctica operativa real y la especificación de "cambio" quedó desactualizada; (b) el negocio sí espera devolución física inmediata cuando el medio es efectivo, y el saldo a favor solo debería aplicar a transferencias.
**Documentado en negocio:** §9.3 y §15 describen "cambio" como devolución inmediata; ninguna sección menciona "saldo a favor".
**Impacto:** determina si RECAUDO-02 se corrige eliminando el crédito acumulable o si se documenta como regla vigente.

### RDN-02 — ¿Cómo debe modelarse la Mora como partida efectivamente cobrable?
**Qué hace el código:** La mora es un valor calculado en memoria sobre el capital pendiente de Canon/Novedad, nunca una obligación propia con saldo.
**Interpretaciones posibles:** (a) debe convertirse en obligación real, cobrable como tercera partida tras Canon y Novedad; (b) es puramente informativa y el §10 solo aplica entre Canon y Novedad (el ejemplo oficial, con mora aplicada=$0, es compatible con ambas lecturas).
**Impacto:** determina el diseño completo de RECAUDO-01/RECAUDO-03.

### RDN-03 — ¿El estado `SUSPENDIDO` es una necesidad de negocio real no documentada, o un remanente a eliminar?
**Qué hace el código:** Implementa una pausa completa de contrato (`ACTIVO↔SUSPENDIDO`) que no libera el inmueble ni genera canon mientras dura.
**Interpretaciones posibles:** (a) remanente de una versión anterior, debe eliminarse (coherente con §6.2, que lo nombra explícitamente); (b) el negocio necesita un mecanismo real de pausa temporal no documentado aún.
**Impacto:** alto — determina si CONT-01/CONT-02/CONT-03 se resuelven eliminando código (con migración de datos de contratos ya SUSPENDIDO) o formalizando el flujo.

### RDN-04 — ¿Qué debe pasar con las obligaciones CANON ya generadas por adelantado cuando un contrato se termina antes de esos periodos?
**Qué hace el código:** Las deja `PENDIENTE`, cobrables indefinidamente, sin distinguirlas de deuda generada durante la vigencia real.
**Interpretaciones posibles:** (a) deben anularse automáticamente al terminar; (b) el negocio decide caso a caso vía el flujo de anulación manual existente; (c) reducir el horizonte de generación a 0-1 mes.
**Documentado en negocio:** §8.3 sugiere que la anulación no debe ser un mecanismo de "ocultar deuda que no se desea cobrar", lo cual desalienta una anulación automática silenciosa.

### RDN-05 — ¿El patrón "anular + re-registrar" (sin columnas dedicadas de valor anterior/nuevo) satisface la exigencia de la sección 21?
**Qué hace el código:** Nunca edita registros financieros; siempre marca ANULADO/crea reverso con motivo, referenciando el original.
**Interpretaciones posibles:** (a) satisface el espíritu de §21 (nunca edición silenciosa); (b) la especificación exige literalmente columnas `valorAnterior`/`valorNuevo` consolidadas en el módulo de auditoría central.

### RDN-06 — ¿"Crear inmuebles" (permiso de Recepcionista, §3.2) incluye editar campos financieros del inmueble (canon, depósito) después de creado?
**Qué hace el código:** `PATCH /inmuebles/:id` permite a Recepcionista modificar cualquier campo, incluidos los financieros, que luego se propagan al crear un contrato nuevo.

### RDN-07 — ¿Recepcionista puede cerrar una novedad con impacto financiero aún no resuelto por Administrador?
**Qué hace el código:** Bloquea explícitamente la anulación de una novedad con impacto pendiente, pero no el cierre (`CERRADA`).

### RDN-08 — ¿Las condiciones de mora (día de gracia, porcentaje) deben poder configurarse por contrato, o es correcto que sean 100% globales?
**Qué hace el código:** `diasGraciaMora`/`porcentajeMoraMensual` viven únicamente en `Empresa` (fila única global); `Contrato` no tiene columnas de mora.
**Documentado en negocio:** §6.1 lista "condiciones de mora" entre los datos fundamentales del contrato — contradice el hallazgo de que hoy es 100% global.

---

# 19. PLAN DE ACCIÓN

## Fase 0 — Riesgos y bloqueadores (P0)
1. **CAJA-01** — separar caja física de transferencias en `Movimiento`.
2. **CONC-02** — lock en reverso manual de movimientos (corrupción activa de saldo, el más urgente por ser explotable con solo dos clics).
3. **NOV-01** — separar aprobación de pago real en gastos de novedad.
4. **RECAUDO-01** — implementar orden Canon→Novedad→Mora real (requiere resolver RDN-02 primero para saber cómo modelar Mora).

## Fase 1 — Integridad financiera (P1, tras resolver RDN aplicables)
5. **CONT-01/CONT-02** (requiere RDN-03 primero) — eliminar o formalizar SUSPENDIDO; implementar reactivación TERMINADO→ACTIVO real.
6. **CONT-03** — validar disponibilidad de inmueble en backend.
7. **PROP-01** — modelar entidad Propietario + seed INMOBILIARIA.
8. **MORA-01** — corregir off-by-one del cálculo de mora.
9. **CONC-01** — lock/UNIQUE en generación de canon.
10. **CONC-03** — transacción compartida en reverso + consecutivo.
11. **RECAUDO-02** (requiere RDN-01) — implementar cambio inmediato o documentar saldo a favor como regla vigente.
12. **RECAUDO-03** — recibo con desglose de aplicación.

## Fase 2 — Reglas de negocio (P2)
13. **CAJA-02** — módulo de Caja completo (§15).
14. **DEP-01** — descuentos de depósito desglosados.
15. **CONT-05** (requiere RDN-04) — ajuste de canon adelantado al terminar.
16. **AUD-01** (requiere RDN-05) — ampliar auditoría central si se decide necesario.

## Fase 3 — Seguridad y permisos
17. **RBAC-01** (requiere RDN-06), **RBAC-02** (requiere RDN-07), **RBAC-03** — ajustar según decisiones.

## Fase 4 — Backend y base de datos
18. **BD-01**, **BD-02**, **BD-03** — endurecer constraints tras confirmar ausencia de datos huérfanos.

## Fase 5 — Frontend y UX
19. **CONT-04** — derivar día de pago de fecha de inicio.
20. Ocultar botones "Suspender"/"Reactivar" según rol una vez resuelto CONT-01/02.

## Fase 6 — Pruebas
21. **TEST-01** — instalar `@nestjs/testing`+`jest` (backend) y `vitest` (frontend); priorizar suites de integración sobre `RecaudoService`, `ObligacionesService`, `MovimientosService`, `ConsecutivoService`, `ContratosService`.

## Fase 7 — Limpieza y deuda técnica
22. **AUD-02**, **CONC-04**, MORA-02 (versionado histórico de tasa, si RDN-08 lo confirma necesario).

---

# 20. MATRIZ DE PRIORIDADES

| Orden | Hallazgo | Severidad | Dependencias | Archivos principales | Riesgo si no se corrige |
|---|---|---|---|---|---|
| 1 | CONC-02 | P0 | — | `movimientos.service.ts` | Duplicación de saldo por doble reverso concurrente |
| 2 | CAJA-01 | P0 | — | `movimiento.entity.ts`, `recaudo.service.ts`, `movimientos.service.ts` | Imposibilidad de arqueo de caja física |
| 3 | NOV-01 | P0 | — | `novedades.service.ts` | Caja/banco reflejan gastos no desembolsados |
| 4 | RECAUDO-01 | P0 | RDN-02 | `recaudo.service.ts` | Mora incobrable; prioridad de cobro invertida |
| 5 | CONT-01/02 | P1 | RDN-03 | `contrato.entity.ts`, `contratos.service.ts` | Estado de negocio no válido en producción; reactivación real imposible |
| 6 | CONT-03 | P1 | — | `inmuebles.service.ts` | Doble asignación de inmueble vía API directa |
| 7 | PROP-01 | P1 | — | `inmueble.entity.ts` | Requisito de modelo de datos incumplido en su totalidad |
| 8 | MORA-01 | P1 | — | `obligaciones.service.ts` | Subestimación sistemática de mora |
| 9 | CONC-01 | P1 | — | `obligaciones.service.ts` | Canon duplicado bajo concurrencia |
| 10 | CONC-03 | P1 | CONC-02 | `movimientos.service.ts`, `consecutivo.service.ts` | Hueco de numeración de documentos |
| 11 | RECAUDO-02 | P1 | RDN-01 | `recaudo.service.ts` | Regla de "cambio" no implementada |
| 12 | RECAUDO-03 | P1 | — | `recaudo.service.ts`, `pdf-recibo.service.ts` | Recibo no cumple requisito funcional del §20 |
| 13 | CAJA-02 | P2 | CAJA-01 | (módulo nuevo) | §15 completo sin implementar |
| 14 | DEP-01 | P2 | — | `liquidar-deposito.dto.ts`, `recaudo.service.ts` | Trazabilidad insuficiente de descuentos |
| 15 | TEST-01 | P1 | — | (ambos proyectos) | Ninguna regresión financiera se detecta automáticamente |

---

# 21. MAPA DE DEPENDENCIAS

```
RDN-02 (¿mora cobrable?) ──► RECAUDO-01 ──► RECAUDO-03 (recibo con desglose correcto)
RDN-01 (¿cambio o crédito?) ──► RECAUDO-02
RDN-03 (¿SUSPENDIDO real?) ──► CONT-01 ──► CONT-02 ──► ocultar botones UI (Fase 5)
CAJA-01 (medioPago en Movimiento) ──► CAJA-02 (módulo Caja) ──► reporte Excel de Caja (Fase 2/13 §23)
CAJA-01 ──► DEP-01 (medio en devolución de depósito)
CONC-02 ──► CONC-03 (misma función, mismo fix de transacción)
TEST-01 ──► (prerrequisito de confianza para verificar TODAS las correcciones anteriores)
```

No debe corregirse frontend (ocultar botones, ajustar formularios) antes de que el backend correspondiente esté corregido — en particular CONT-01/02 y RECAUDO-01/02 deben resolverse en backend antes de tocar `pages/contratos/index.vue` y `pages/recaudo/index.vue`.

---

# 22. PLAN DE PRUEBAS

Dado que la cobertura actual es 0%, toda corrección debe ir acompañada de su propia prueba de regresión. Prioridad máxima:

1. **Recaudo:** pago exacto según el ejemplo del §10 (post-corrección); pago con novedad más antigua que canon; pago total, parcial, sobrepago con y sin saldo a favor previo; pago mixto efectivo+transferencia.
2. **Mora:** parametrizado por fecha (día de gracia límite, primer día de mora, varios días después); porcentaje 0%; mora nunca genera mora.
3. **Concurrencia:** dos reversos simultáneos sobre el mismo movimiento; dos generaciones de canon simultáneas sobre el mismo contrato/periodo.
4. **Contratos:** terminación con deuda; reactivación con y sin motivo; reactivación por Recepcionista (debe fallar); inmueble ya ocupado.
5. **Novedades:** aprobar gasto no debe crear movimiento; pagar gasto sí debe crearlo.
6. **Obligaciones:** anular con y sin abonos; anular con motivo vacío (debe fallar tras AUD-02).
7. **Depósito:** liquidación con múltiples descuentos; devolución total.

---

# 23. CRITERIOS DE ACEPTACIÓN

Ver criterio de aceptación individual dentro de cada hallazgo en la sección 15. Como patrón general para todo el plan: cada corrección debe demostrarse con (a) una prueba automatizada que falle antes del fix y pase después, (b) verificación de que la operación sigue siendo atómica/trazable, y (c) verificación de que el frontend correspondiente refleja el nuevo comportamiento sin cálculos propios duplicados.

---

# 24. ORDEN EXACTO RECOMENDADO DE IMPLEMENTACIÓN

1. Instalar infraestructura de pruebas (**TEST-01**) — antes de tocar cualquier lógica financiera, para poder verificar cada fix con confianza.
2. Resolver decisiones de negocio bloqueadoras: **RDN-01, RDN-02, RDN-03** (estas tres condicionan el diseño de los hallazgos P0).
3. **CONC-02** (fix más simple y aislado, máximo riesgo activo).
4. **CAJA-01** (cambio de modelo de datos, base para CAJA-02, DEP-01, y para que RECAUDO-01/03 puedan mostrar el desglose correcto).
5. **NOV-01** (aislado, no depende de nada anterior).
6. **RECAUDO-01** y **RECAUDO-02** (dependen de RDN-01/RDN-02 ya resueltas).
7. **RECAUDO-03** (depende de RECAUDO-01 para mostrar el desglose correcto).
8. **CONT-01/CONT-02/CONT-03** (dependen de RDN-03; tocar contratos y disponibilidad de inmuebles juntos).
9. **PROP-01**, **MORA-01**, **CONC-01**, **CONC-03** (independientes entre sí, pueden paralelizarse).
10. Fase 2 (**CAJA-02**, **DEP-01**, **CONT-05**), Fase 3 (RBAC-*), Fase 4 (BD-*), Fase 5 (frontend), Fase 7 (deuda técnica menor).

---

# 25. RIESGOS RESIDUALES

- **Datos en producción:** si el sistema ya tiene contratos en estado SUSPENDIDO o mora acumulada calculada con el off-by-one, cualquier corrección de CONT-01/MORA-01 requiere primero un inventario y una decisión de migración de datos — no solo un cambio de código.
- **Ausencia de pruebas:** hasta que TEST-01 esté resuelto, cada corrección de los hallazgos P0/P1 se verifica manualmente, con riesgo de regresión no detectada en producción.
- **Cambios de tasa de mora:** mientras no se resuelva MORA-02/RDN-08, cualquier cambio de `porcentajeMoraMensual` en producción recalcula retroactivamente toda la mora abierta sin dejar rastro de la tasa anterior — deshabilitar temporalmente cambios de esta configuración durante la corrección es una mitigación razonable.
- **Migraciones de esquema:** BD-01/BD-02/BD-03 no deben aplicarse como `NOT NULL`/`UNIQUE` sin antes verificar ausencia de filas huérfanas o duplicadas existentes, para evitar que la migración falle o corrompa datos.

---

# 26. CONCLUSIÓN FINAL

El código actual **no implementa exactamente** el negocio definido por la especificación. Implementa una base sólida en varias áreas (autorización backend fail-closed, transacciones y locks correctos en el flujo principal de recaudo, precisión decimal, separación conceptual obligación/pago/aplicación, ausencia total de condonación), pero se desvía de forma verificable y material en:

- un módulo de negocio completo ausente (**Propietario**, §4);
- una invariante financiera estructuralmente inobservable (**caja física vs. transferencias**, §14-15);
- dos reglas financieras centrales invertidas o incompletas (**orden de aplicación del dinero**, §10; **APROBADO≠PAGADO**, §17-18);
- un estado de contrato explícitamente prohibido y activamente en uso (**SUSPENDIDO**, §6.2), con su reactivación real (§6.6) sin implementar;
- una vulnerabilidad de concurrencia explotable con dos clics (**doble reverso de movimientos**);
- cobertura de pruebas automatizadas del 0%, que impide verificar con confianza cualquier corrección futura de lo anterior.

Ninguno de estos hallazgos corresponde a "funcionalidades de una inmobiliaria ideal" fuera de alcance — los 11 hallazgos P0/P1 son, todos, desviaciones directas de reglas explícitamente numeradas en la especificación entregada. El plan de acción de la sección 19 prioriza correctamente: primero contener el riesgo financiero activo (Fase 0), luego cerrar las brechas de integridad (Fase 1), y solo después abordar deuda técnica y mejoras (Fases 4-7). Ocho decisiones de negocio (sección 18) deben resolverse con el dueño del producto antes de iniciar la implementación de los hallazgos que dependen de ellas — proceder sin esas decisiones arriesgaría inventar una regla de negocio no autorizada, exactamente lo que esta metodología de auditoría prohíbe.
