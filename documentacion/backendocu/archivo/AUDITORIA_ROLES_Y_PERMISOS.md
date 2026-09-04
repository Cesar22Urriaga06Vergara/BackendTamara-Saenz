# Auditoría de Roles y Permisos — Tamara & Saenz ERP

**Fase:** Solo lectura (Fase 0 de la auditoría quirúrgica de segunda generación). No se modificó ningún archivo.
**Alcance:** Backend NestJS (`BackendTamara-Saenz`) + Frontend Nuxt/Vue (`FrontendTamara-Saenz`).
**Documento relacionado:** este informe es el detalle completo que respalda la sección 5 ("Matriz de roles y permisos") y parte de la sección 9 ("Auditoría de seguridad") de `AUDITORIA_QUIRURGICA_SEGUNDA_GENERACION.md`.

## Resumen ejecutivo

El backend implementa un **RolesGuard fail-closed** genuinamente sólido (`src/common/guards/roles.guard.ts:28-38`): cualquier endpoint mutante (POST/PUT/PATCH/DELETE) sin `@Roles` explícito se **deniega automáticamente**, en vez de quedar abierto por omisión. Todos los módulos financieros (`recaudo`, `movimientos`, `obligaciones`, `usuarios`, `auditoria`) están protegidos con `@Roles(Rol.ADMINISTRADOR)` a **nivel de clase**, y el frontend refleja consistentemente esas restricciones (no se detectó ningún caso de "botón oculto pero API abierta" en las áreas puramente financieras).

Sin embargo, se encontraron **violaciones reales de la regla de negocio** (no de seguridad genérica, sino de la especificación explícita), concentradas en el módulo de **Contratos**:

1. El código reintroduce el estado `SUSPENDIDO`, expresamente prohibido por la spec (sección 6.2).
2. La reactivación de contratos (`PATCH /contratos/:id/reactivar`) está permitida a **Recepcionista**, cuando la spec (sección 6.6) exige "solamente Administrador".
3. El flujo de reactivación implementado es `SUSPENDIDO → ACTIVO`, no el `TERMINADO → ACTIVO` que define la especificación.

También hay accesos de Recepcionista fuera de su lista cerrada de 6 acciones permitidas (actualizar inmuebles, cambiar estado de novedades) que requieren decisión de negocio.

---

## 1. Matriz completa de endpoints (evidencia backend)

| Endpoint | Módulo | Roles permitidos (backend) | Archivo:línea | ¿Financiero sensible? | ¿Protegido según spec? |
|---|---|---|---|---|---|
| `POST /auth/login` | auth | `@Public()` | auth.controller.ts:19-26 | No | Sí |
| `POST /auth/refresh` | auth | `@Public()` | auth.controller.ts:28-33 | No | Sí |
| `POST /auth/logout` | auth | ADMIN, RECEP | auth.controller.ts:35-41 | No | Sí |
| `POST /auth/me` | auth | ADMIN, RECEP | auth.controller.ts:43-48 | No | Sí |
| `GET /auditoria` | auditoria | ADMIN (clase) | auditoria.controller.ts:11 | No (metadatos) | Sí |
| `GET /empresa` | empresa | **sin @Roles** (cualquier autenticado) | empresa.controller.ts:23-26 | Expone `porcentajeMoraMensual`/`diasGraciaMora` | Ver Hallazgo H-05 |
| `PATCH /empresa` | empresa | ADMIN | empresa.controller.ts:28-33 | Sí (config. mora/empresa) | Sí |
| `POST /empresa/logo` | empresa | ADMIN | empresa.controller.ts:35-58 | No | Sí |
| `POST /recaudo/pagos` | recaudo | ADMIN (clase) | recaudo.controller.ts:19,23-27 | **Sí — registrar pago** | Sí |
| `GET /recaudo/recibos/:id` | recaudo | ADMIN (clase) | recaudo.controller.ts:29-32 | Sí | Sí |
| `GET /recaudo/contrato/:id/recibos` | recaudo | ADMIN (clase) | recaudo.controller.ts:34-41 | Sí | Sí |
| `PATCH /recaudo/recibos/:id/anular` | recaudo | ADMIN (clase) | recaudo.controller.ts:19,43-47 | **Sí — anular recibo** | Sí |
| `POST /recaudo/contrato/:id/liquidar-deposito` | recaudo | ADMIN (clase) | recaudo.controller.ts:19,49-57 | **Sí — liquidar depósito** | Sí |
| `GET /movimientos` | movimientos | ADMIN (clase) | movimientos.controller.ts:15,19-29 | Sí | Sí |
| `GET /movimientos/saldo-neto` | movimientos | ADMIN (clase) | movimientos.controller.ts:31-34 | Sí | Sí |
| `PATCH /movimientos/:id/reversar` | movimientos | ADMIN (clase) | movimientos.controller.ts:15,41-45 | **Sí — reversar movimiento** | Sí |
| `POST /contratos` | contratos | ADMIN, RECEP | contratos.controller.ts:18-23 | No | Sí (spec: "crear contratos") |
| `GET /contratos` | contratos | **sin @Roles** | contratos.controller.ts:25-28 | No | Sí |
| `GET /contratos/:id` | contratos | **sin @Roles** | contratos.controller.ts:30-33 | No | Sí |
| `GET /contratos/:id/ficha-recaudo` | contratos | ADMIN | contratos.controller.ts:36-39 | Sí | Sí |
| `PATCH /contratos/:id/terminar` | contratos | ADMIN, RECEP | contratos.controller.ts:42-47 | No | Sí (spec: "terminar contratos") |
| `PATCH /contratos/:id/suspender` | contratos | **ADMIN, RECEP** | contratos.controller.ts:49-54 | No directo, pero cambia disponibilidad del inmueble | **No — ver H-01/H-02** |
| `PATCH /contratos/:id/reactivar` | contratos | **ADMIN, RECEP** | contratos.controller.ts:56-61 | No directo | **No — ver H-01/H-02** |
| `POST /inmuebles` | inmuebles | ADMIN, RECEP | inmuebles.controller.ts:17-22 | No | Sí (spec: "crear inmuebles") |
| `GET /inmuebles`, `/barrios`, `/disponibles`, `/:id` | inmuebles | sin @Roles | inmuebles.controller.ts:24-42 | No | Sí |
| `PATCH /inmuebles/:id` | inmuebles | **ADMIN, RECEP** | inmuebles.controller.ts:44-49 | No | **Fuera de lista — ver H-03** |
| `POST /novedades` | novedades | ADMIN, RECEP | novedades.controller.ts:21-26 | No (spec: sin impacto financiero) | Sí (spec: "registrar novedades") |
| `GET /novedades`, `GET /novedades/:id` | novedades | ADMIN, RECEP | novedades.controller.ts:28-38 | No | Sí |
| `PATCH /novedades/:id/estado` | novedades | **ADMIN, RECEP** | novedades.controller.ts:40-45 | No directo, riesgo de proceso | **Fuera de lista — ver H-04** |
| `PATCH /novedades/:id/aprobar-cargo-arrendatario` | novedades | ADMIN | novedades.controller.ts:48-57 | **Sí — genera obligación** | Sí |
| `PATCH /novedades/:id/aprobar-gasto-inmobiliaria` | novedades | ADMIN | novedades.controller.ts:60-69 | **Sí — genera egreso** | Sí |
| `POST /clientes` | clientes | ADMIN, RECEP | clientes.controller.ts:18-23 | No | Sí (spec: "crear clientes") |
| `GET /clientes/buscar`, `GET /clientes`, `GET /clientes/:id` | clientes | sin @Roles | clientes.controller.ts:26-39 | No | Sí |
| `PATCH /clientes/:id` | clientes | ADMIN | clientes.controller.ts:41-46 | No | Sí (correcto — no está en lista de Recep.) |
| `POST /codeudores` | codeudores | ADMIN, RECEP | codeudores.controller.ts:18-23 | No | Sí (spec: "crear codeudores") |
| `GET /codeudores/*` | codeudores | sin @Roles | codeudores.controller.ts:25-38 | No | Sí |
| `PATCH /codeudores/:id` | codeudores | ADMIN | codeudores.controller.ts:40-45 | No | Sí |
| `GET /documentos/novedades/:id/pdf` | documentos | ADMIN, RECEP (override) | documentos.controller.ts:21,36-38 | No | Sí |
| `GET /documentos/recibos/:id/pdf` | documentos | ADMIN (clase) | documentos.controller.ts:21,49-50 | Sí | Sí |
| `GET /documentos/reportes/*.xlsx` (contratos, barrio, recaudo, cartera) | documentos | ADMIN (clase) | documentos.controller.ts:21,65-105 | Sí (recaudo/cartera) | Sí |
| `POST /obligaciones/generar-canones` | obligaciones | ADMIN (clase) | obligaciones.controller.ts:13,18-22 | Sí | Sí |
| `GET /obligaciones/contrato/:id/pendientes` | obligaciones | ADMIN (clase) | obligaciones.controller.ts:24-27 | Sí | Sí |
| `PATCH /obligaciones/:id/anular` | obligaciones | ADMIN (clase) | obligaciones.controller.ts:13,30-34 | **Sí — anular obligación** | Sí |
| `POST /usuarios`, `GET`, `GET /:id`, `PATCH /:id`, `PATCH /:id/password` | usuarios | ADMIN (clase, toda la clase) | usuarios.controller.ts:16 | No (RBAC admin) | Sí |
| `GET /dashboard` | dashboard | sin @Roles | dashboard.controller.ts:14-17 | No (documentado explícitamente sin cifras) | Sí |
| `GET /dashboard/financiero` | dashboard | ADMIN | dashboard.controller.ts:26-30 | Sí | Sí |

---

## 2. Endpoints financieros sensibles — verificación de protección

Todos los puntos críticos listados en el alcance de la tarea (registrar pago, anular recibo, aprobar/pagar novedad-gasto, liquidar depósito, reversar movimiento, reactivar contrato, editar/corregir movimiento financiero, configurar mora/empresa) están correctamente `@Roles(Rol.ADMINISTRADOR)`, tanto a nivel de clase como de método. **No se encontró ningún endpoint financiero sensible sin protección de rol backend.**

La única excepción parcial es **`PATCH /contratos/:id/reactivar` y `PATCH /contratos/:id/suspender`**, que no son "financieros" en sentido estricto pero sí son **transiciones de estado contractual protegidas por la especificación** (sección 6.6: reactivación exclusiva de Administrador) — ver Hallazgo H-01/H-02 abajo.

---

## 3. Frontend oculta pero backend no bloquea (bypass)

**No se encontró ningún caso clásico de bypass** (frontend oculta un botón, pero la API permite la acción a un rol no autorizado). La UI y el guard backend están, en general, sincronizados:

- `middleware/auth.global.ts:29` bloquea rutas `/recaudo`, `/reportes`, `/administracion`, `/configuracion`, `/movimientos`, `/auditoria` para Recepcionista — coincide con `@Roles(ADMINISTRADOR)` en esos módulos backend.
- `pages/novedades/index.vue:151` oculta los botones de aprobación financiera con `v-if="auth.esAdministrador"` — coincide con `@Roles(ADMINISTRADOR)` en `aprobar-cargo-arrendatario`/`aprobar-gasto-inmobiliaria`.
- `pages/clientes/index.vue:159` y `pages/codeudores/index.vue:159` ocultan editar/dar de baja con `v-if="auth.esAdministrador"` — coincide con `PATCH` restringido a ADMIN en backend.
- `pages/dashboard/index.vue:25,49,55` solo pide/muestra `/dashboard/financiero` si `auth.esAdministrador` — coincide con el guard backend.

**La única discrepancia notable es al revés de un "bypass":** en `pages/contratos/index.vue:187-201`, los botones **Suspender** y **Reactivar** se muestran a **cualquier usuario autenticado**, sin `v-if="auth.esAdministrador"`. Esto no es un bypass de seguridad (el backend efectivamente permite `RECEPCIONISTA` en ambos endpoints), pero **confirma y materializa en UI la violación de negocio** descrita en H-01/H-02: Recepcionista puede reactivar un contrato terminado/suspendido directamente desde la pantalla de Contratos, cuando la spec exige que sea exclusivo de Administrador.

---

## 4. Recepcionista con acceso fuera de su lista permitida

La spec (sección 3.2) limita a Recepcionista a: crear clientes, crear codeudores, crear inmuebles, crear contratos, terminar contratos, registrar novedades. Se encontraron los siguientes accesos backend **fuera** de esa lista:

| Acción concedida a RECEPCIONISTA | Evidencia | ¿En la lista permitida? |
|---|---|---|
| `PATCH /contratos/:id/suspender` | contratos.controller.ts:49-54 | No — "suspender" ni siquiera es un concepto de la spec |
| `PATCH /contratos/:id/reactivar` | contratos.controller.ts:56-61 | No — spec 6.6 dice explícitamente "solamente Administrador" |
| `PATCH /inmuebles/:id` (actualizar) | inmuebles.controller.ts:44-49 | No — spec solo lista "crear inmuebles" |
| `PATCH /novedades/:id/estado` (cambiar estado, salvo ANULAR con impacto pendiente) | novedades.controller.ts:40-45; novedades.service.ts:91-107 | No — spec solo lista "registrar novedades" (creación) |

---

## 5. Hallazgos (formato sección 23 del prompt maestro)

### H-01 — Estado `SUSPENDIDO` reintroducido en Contrato, prohibido explícitamente por la especificación

**Severidad:** P1
**Categoría:** REGLA_NEGOCIO
**Regla de negocio afectada:** Sección 6.2 — "Solo existen dos estados contractuales: ACTIVO, TERMINADO... No deben existir como estados de negocio: INACTIVO, SUSPENDIDO, EN_TERMINACION."
**Comportamiento actual:** `EstadoContrato` incluye `SUSPENDIDO` (`src/modules/contratos/entities/contrato.entity.ts:16-20`), con endpoints dedicados `PATCH /contratos/:id/suspender` y `PATCH /contratos/:id/reactivar` que operan sobre ese estado (`contratos.service.ts:163-181`). El frontend replica el estado en filtros y badges (`pages/contratos/index.vue:22-26,163`).
**Comportamiento esperado:** Solo dos estados: ACTIVO y TERMINADO. La única transición permitida es ACTIVO→TERMINADO y, excepcionalmente, TERMINADO→ACTIVO (reactivación, solo Administrador).
**Por qué importa:** Introduce un tercer estado que duplica lógica de negocio, contradice la spec de forma directa y crea ambigüedad operativa (¿un inmueble bajo contrato SUSPENDIDO está disponible? El modelo actual lo deja OCUPADO — ver inconsistencia relacionada con invariante 1 de la spec).
**Evidencia:**
- `src/modules/contratos/entities/contrato.entity.ts:16-20` (enum)
- `src/modules/contratos/contratos.controller.ts:49-61` (endpoints)
- `src/modules/contratos/contratos.service.ts:163-181` (lógica)
- `FrontendTamara-Saenz/pages/contratos/index.vue:22-26,163,187-201` (UI)

**Ruta funcional:** requisito (spec 6.2) → BD (enum `contrato.estado`) → backend (`ContratosService.suspender/reactivar`) → API (`/contratos/:id/suspender`, `/reactivar`) → frontend (botones sin gate de rol) → resultado observable (contrato en estado no permitido por negocio).
**Impacto:** Alto — el sistema opera con un modelo de estados distinto al de negocio definido; cualquier reporte, filtro o regla que asuma solo ACTIVO/TERMINADO puede comportarse de forma inconsistente frente a contratos SUSPENDIDO.
**Certeza:** ALTA
**Dependencias:** H-02 (la reactivación real de negocio es TERMINADO→ACTIVO, no SUSPENDIDO→ACTIVO).
**Recomendación:** Eliminar el estado SUSPENDIDO y los endpoints `suspender`/`reactivar` en su forma actual; implementar la única transición de negocio válida: reactivación desde TERMINADO, exclusiva de Administrador, con motivo obligatorio y trazabilidad, conservando la fecha histórica de terminación.
**Criterio de aceptación:** `EstadoContrato` solo admite ACTIVO/TERMINADO; existe un único endpoint de reactivación que solo opera sobre contratos TERMINADO, exclusivo de rol ADMINISTRADOR, exige motivo, y no borra `fechaFin`/`motivoTerminacion` históricos.
**Pruebas necesarias:** Reactivar contrato TERMINADO (Admin) → ACTIVO con historial conservado; intento de reactivar como Recepcionista → 403; intento de reactivar contrato ya ACTIVO → error; verificar que el inmueble vuelve a OCUPADO correctamente.

---

### H-02 — Reactivación de contrato permitida a Recepcionista, contradiciendo la exclusividad de Administrador

**Severidad:** P1
**Categoría:** SEGURIDAD / REGLA_NEGOCIO
**Regla de negocio afectada:** Sección 6.6 — "Condiciones [de reactivación]: solamente Administrador; motivo obligatorio; trazabilidad obligatoria."
**Comportamiento actual:** `PATCH /contratos/:id/reactivar` acepta `@Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)` (`contratos.controller.ts:56-58`) y **no exige motivo** — el DTO de reactivar ni siquiera existe (el endpoint no recibe body). El servicio (`contratos.service.ts:173-181`) tampoco registra motivo ni trazabilidad de la reactivación, solo limpia `motivoTerminacion = null`, **borrando** el motivo previo de suspensión.
**Comportamiento esperado:** Solo Administrador puede reactivar; motivo obligatorio; trazabilidad obligatoria; no debe perderse el historial anterior.
**Por qué importa:** Es una violación directa y doble: (a) rol incorrecto — Recepcionista puede revertir una terminación/suspensión sin autorización de Administrador; (b) ausencia de motivo/trazabilidad — se pierde el `motivoTerminacion` anterior al poner `null`, violando también el principio de conservación histórica (invariante 19 de la spec).
**Evidencia:**
- `src/modules/contratos/contratos.controller.ts:56-61`
- `src/modules/contratos/contratos.service.ts:173-181` (línea 179: `contrato.motivoTerminacion = null;`)
- `FrontendTamara-Saenz/pages/contratos/index.vue:108-131,190-192,276-284` (sin gate de rol, sin motivo)

**Ruta funcional:** requisito (spec 6.6) → backend (`@Roles` incorrecto + servicio sin motivo/trazabilidad) → API → frontend (sin gate ni campo de motivo) → resultado (Recepcionista reactiva contratos libremente, sin dejar rastro del motivo).
**Impacto:** Alto — control operativo/financiero puede ser revertido por un rol no autorizado, y se pierde trazabilidad histórica.
**Certeza:** ALTA
**Dependencias:** H-01.
**Recomendación:** Restringir `@Roles(Rol.ADMINISTRADOR)` únicamente; agregar DTO con `motivo` obligatorio; persistir el motivo de reactivación (no sobrescribir/perder `motivoTerminacion` histórico, p. ej. usando un campo o tabla de historial separada); quitar el botón de Reactivar del frontend cuando `!auth.esAdministrador`.
**Criterio de aceptación:** Un usuario RECEPCIONISTA que llame `PATCH /contratos/:id/reactivar` recibe 403; la reactivación exige motivo; el motivo de terminación/suspensión previo permanece consultable después de reactivar.
**Pruebas necesarias:** Test de integración con token RECEPCIONISTA → 403; test de que el historial de terminación anterior sigue siendo recuperable tras reactivar.

---

### H-03 — Recepcionista puede actualizar inmuebles (fuera de su lista de acciones permitidas)

**Severidad:** P2 (potencialmente P1 si se interpreta estrictamente)
**Categoría:** REQUIERE_DECISION_DE_NEGOCIO
**Regla de negocio afectada:** Sección 3.2 — lista cerrada de acciones de Recepcionista incluye "crear inmuebles" pero no "editar/actualizar inmuebles".
**Comportamiento actual:** `PATCH /inmuebles/:id` acepta `@Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)` (`inmuebles.controller.ts:44-49`), permitiendo a Recepcionista modificar canon, depósito, dirección, barrio y estado (dentro de `MANTENIMIENTO`/`INACTIVO`) de cualquier inmueble. El frontend no oculta el botón de edición para Recepcionista (`pages/inmuebles/index.vue:198-204`, sin `v-if` de rol).
**Comportamiento esperado:** Ambiguo — la spec no dice explícitamente si "crear" incluye corregir datos del inmueble recién creado. No puede resolverse con la especificación tal como está redactada.
**Por qué importa:** Si se interpreta la lista de la sección 3.2 como exhaustiva (regla contra la invención, sección 26), esto es un exceso de permisos: Recepcionista podría alterar el `canonValor` de un inmueble (dato con impacto financiero indirecto, ya que ese valor se copia al contrato al crearlo — ver `contratos.service.ts:66`).
**Evidencia:**
- `src/modules/inmuebles/inmuebles.controller.ts:44-49`
- `FrontendTamara-Saenz/pages/inmuebles/index.vue:198-204`

**Ruta funcional:** requisito (spec 3.2, lista cerrada) → backend (`@Roles` incluye RECEPCIONISTA) → API → frontend (sin gate) → resultado (Recepcionista modifica canon/depósito de inmuebles).
**Impacto:** Medio — el canon editado por Recepcionista se propaga al crear un contrato nuevo (`canonValor: inmueble.canonValor` en `contratos.service.ts:66`), es decir, Recepcionista influye indirectamente en un valor financiero futuro sin aprobación de Administrador.
**Certeza:** MEDIA (depende de interpretación de la spec)
**Dependencias:** Ninguna.
**Recomendación:** Decisión de negocio: (a) si se mantiene, documentar explícitamente que "crear inmuebles" incluye edición operativa no financiera; o (b) restringir `canonValor`/`depositoValor` a Administrador y dejar solo campos descriptivos (dirección, códigos de servicios, observaciones) editables por Recepcionista.
**Criterio de aceptación:** Pendiente de decisión de negocio.
**Pruebas necesarias:** Ninguna hasta resolver la ambigüedad.

---

### H-04 — Recepcionista puede cambiar el estado de una novedad más allá de su creación

**Severidad:** P3
**Categoría:** REQUIERE_DECISION_DE_NEGOCIO
**Regla de negocio afectada:** Sección 3.2 ("registrar novedades") y Sección 17 ("Recepcionista registra → PENDIENTE → Administrador decide").
**Comportamiento actual:** `PATCH /novedades/:id/estado` acepta `@Roles(Rol.ADMINISTRADOR, Rol.RECEPCIONISTA)` (`novedades.controller.ts:40-45`). El servicio (`novedades.service.ts:91-107`) sí bloquea a Recepcionista de anular una novedad con `impactoFinanciero === PENDIENTE` (defensa en profundidad correcta), pero **permite** a Recepcionista pasar una novedad a `CERRADA` libremente, sin que exista ninguna validación de que el impacto financiero ya fue resuelto por Administrador.
**Comportamiento esperado:** Ambiguo — la spec describe el flujo como "Recepcionista registra → PENDIENTE → Administrador decide", lo que sugiere que el ciclo de vida post-registro (seguimiento/cierre) es resorte de Administrador, pero no lo dice de forma explícita para todas las transiciones.
**Por qué importa:** Un Recepcionista podría cerrar (`CERRADA`) una novedad con `impactoFinanciero = PENDIENTE` sin que haya sido resuelta financieramente. Esto no bloquea la aprobación posterior (`validarAprobable` en `novedades.service.ts:199-206` solo verifica `impactoFinanciero`, no `estado`), pero sí puede sacar la novedad de vistas/filtros que Administrador use para dar seguimiento a pendientes, generando riesgo de que una novedad con impacto financiero pendiente "desaparezca" operativamente.
**Evidencia:**
- `src/modules/novedades/novedades.controller.ts:40-45`
- `src/modules/novedades/novedades.service.ts:91-107,199-206`

**Ruta funcional:** requisito (spec 17) → backend (`cambiarEstado` permite CERRAR con impacto pendiente si no es ANULAR) → API → frontend (sin UI para esto en `pages/novedades/index.vue`, pero la API lo permite igual) → resultado (posible pérdida de visibilidad operativa de novedades con impacto financiero sin resolver).
**Impacto:** Bajo-Medio — no hay pérdida de datos ni corrupción financiera (el registro persiste y sigue siendo aprobable), pero sí un riesgo de proceso/UX.
**Certeza:** MEDIA
**Dependencias:** Ninguna.
**Recomendación:** Decisión de negocio: aplicar a `CERRADA` (no solo a `ANULADA`) la misma restricción ya existente — bloquear el cierre por Recepcionista mientras `impactoFinanciero === PENDIENTE`.
**Criterio de aceptación:** Pendiente de decisión de negocio.
**Pruebas necesarias:** Test que verifique si Recepcionista puede cerrar una novedad con impacto pendiente, y si eso debe bloquearse.

---

### H-05 — Lectura de configuración de empresa (incluye parámetros de mora) sin restricción de rol

**Severidad:** P5
**Categoría:** REQUIERE_DECISION_DE_NEGOCIO
**Regla de negocio afectada:** Contexto de la tarea de auditoría — "configuración de empresa/mora deben estar restringidas a Administrador"; la spec no distingue explícitamente lectura de escritura.
**Comportamiento actual:** `GET /empresa` no tiene `@Roles` (`empresa.controller.ts:23-26`), por lo que cualquier usuario autenticado (incluido Recepcionista) puede leer `porcentajeMoraMensual`, `diasGraciaMora` y `horizonteMesesCanon`. La escritura (`PATCH /empresa`) sí está correctamente restringida a Administrador.
**Comportamiento esperado:** Ambiguo — la spec habla de "acciones" (mutaciones) protegidas para Administrador; no prohíbe explícitamente la lectura de configuración por Recepcionista, y de hecho probablemente sea necesaria para mostrar el logo/nombre de empresa en pantallas comunes.
**Por qué importa:** Impacto bajo (es solo lectura de parámetros, no de datos de clientes/dinero), pero técnicamente expone una cifra de negocio (% de mora) a un rol que, según el comentario del propio código (`roles.enum.ts:3-4`), debería estar "SIN acceso a dinero/reportes contables".
**Evidencia:** `src/modules/empresa/empresa.controller.ts:23-26`; `src/modules/empresa/entities/empresa.entity.ts:30-38`.
**Ruta funcional:** requisito → backend (`GET` sin `@Roles`) → API → resultado (Recepcionista puede consultar % de mora).
**Impacto:** Bajo.
**Certeza:** BAJA (es plausible que sea intencional, ya que el logo/nombre de empresa se necesita para pantallas comunes).
**Dependencias:** Ninguna.
**Recomendación:** Si se decide restringir, separar el endpoint en datos "públicos" (nombre, logo) vs. "parámetros de negocio" (mora, horizonte), igual que ya se hizo con `dashboard`/`dashboard/financiero`.
**Criterio de aceptación:** Pendiente de decisión de negocio.
**Pruebas necesarias:** Ninguna hasta decisión.

---

## 6. Aspectos verificados como correctos (no son hallazgos)

- Todos los endpoints de recaudo, movimientos, obligaciones, usuarios, auditoría y aprobación de novedades: exclusivos de Administrador, tanto en backend (`@Roles`) como en frontend (gates consistentes o rutas bloqueadas por `middleware/auth.global.ts`).
- `ObligacionesService.anular()` (obligaciones.service.ts:151-161) respeta correctamente la spec 8.3: solo permite anular obligaciones `PENDIENTE` sin abonos; si ya tiene pagos, exige revertir desde Recaudo.
- `NovedadesService` respeta correctamente `APROBADO ≠ PAGADO` (spec 17-18) **en el flujo de cargo al arrendatario**: aprobar cargo genera una obligación cobrable, exclusivo de Administrador. (Nota: el flujo de gasto de inmobiliaria sí viola esta regla — ver hallazgo NOV-01 en el documento maestro de auditoría, `AUDITORIA_QUIRURGICA_SEGUNDA_GENERACION.md`, detectado por otro frente de esta auditoría al trazar el flujo financiero completo).
- Creación de clientes, codeudores, inmuebles y contratos, y terminación de contratos: correctamente abiertos a Recepcionista y Administrador, coincidiendo exactamente con la spec 3.2.
- No se detectó ningún endpoint mutante (POST/PATCH/PUT/DELETE) sin `@Roles`, gracias al diseño fail-closed del `RolesGuard`.

---

## Archivos citados como evidencia

- `src/common/guards/roles.guard.ts`, `src/common/guards/jwt-auth.guard.ts`
- `src/common/decorators/roles.decorator.ts`, `current-user.decorator.ts`, `public.decorator.ts`
- `src/common/enums/roles.enum.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/contratos/contratos.controller.ts`, `contratos.service.ts`
- `src/modules/inmuebles/inmuebles.controller.ts`
- `src/modules/novedades/novedades.controller.ts`, `novedades.service.ts`
- `src/modules/recaudo/recaudo.controller.ts`
- `src/modules/movimientos/movimientos.controller.ts`
- `src/modules/obligaciones/obligaciones.controller.ts`, `obligaciones.service.ts`
- `src/modules/empresa/empresa.controller.ts`, `entities/empresa.entity.ts`
- `src/modules/usuarios/usuarios.controller.ts`
- `src/modules/dashboard/dashboard.controller.ts`
- `src/modules/personas/clientes.controller.ts`, `codeudores.controller.ts`
- `src/modules/documentos/documentos.controller.ts`
- `FrontendTamara-Saenz/middleware/auth.global.ts`
- `FrontendTamara-Saenz/pages/contratos/index.vue`, `pages/inmuebles/index.vue`, `pages/novedades/index.vue`, `pages/clientes/index.vue`, `pages/codeudores/index.vue`, `pages/dashboard/index.vue`

No se modificó ningún archivo durante esta auditoría (fase de solo lectura respetada).
