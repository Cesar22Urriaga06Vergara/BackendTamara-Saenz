# Fase 1 — Análisis del flujo financiero de novedades / recibos

## Objetivo

Validar la implementación real del ciclo de novedades y cerrar el punto de integración entre:
- recepción de la novedad,
- aprobación financiera del administrador,
- generación de obligación o egreso,
- pago real del gasto de inmobiliaria,
- reversión y consistencia del estado de negocio.

No se trata de una auditoría de arquitectura ni de un rediseño de módulos; la prioridad es dejar el flujo operativo que ya existe coherente, documentado y ejecutable.

## Alcance revisado

Se revisaron los módulos que conforman el flujo real:
- Backend: `src/modules/novedades/*`, `src/modules/obligaciones/*`, `src/modules/movimientos/*`, `src/modules/documentos/*`.
- Frontend: `pages/novedades/index.vue`, `pages/gastos/index.vue` y el patrón de consumo `useApiFetch` / `useListadoPaginado`.
- Pruebas de integración: `src/modules/novedades/novedades.integration.spec.ts` y `src/modules/movimientos/movimientos.integration.spec.ts`.

## Estado real del flujo

### 1) Registro inicial

El backend registra la novedad con un consecutivo atómico y sin impacto financiero inmediato.

Responsable:
- Recepcionista o Administrador.

Regla:
- `crear()` valida inmueble y contrato opcional.
- `estado = ABIERTA`.
- `impactoFinanciero = PENDIENTE`.
- No se genera obligación ni movimiento de caja.

Esto está bien alineado con el diseño operativo: la novedad es un evento operativo, no un hecho contable definitivo.

### 2) Cambio de estado operativo

La transición del tablero está modelada por `cambiarEstado()`.

Estados:
- `ABIERTA`
- `EN_SEGUIMIENTO`
- `CERRADA`
- `ANULADA`

Reglas importantes:
- Si la novedad ya está `CERRADA` o `ANULADA`, no admite cambios.
- Si se quiere cerrar o anular una novedad con `impactoFinanciero = PENDIENTE`, la operación solo la puede hacer el Administrador.
- Esto es consistente con la política de negocio: todo lo contable queda bajo control del Administrador.

En el Frontend, la UI solo expone las transiciones que forman el flujo operativo visible para cada rol, y oculta la cierre forzado cuando la novedad todavía no tiene impacto financiero resuelto.

### 3) Aprobación financiera

La aprobación se divide en dos caminos mutuamente excluyentes:

#### A. Cargo al arrendatario

`aprobarCargoArrendatario()`:
- valida que la novedad no esté ya resuelta,
- exige `contrato` asociado,
- setea:
  - `impactoFinanciero = CARGO_ARRENDATARIO`,
  - `montoAprobado = dto.monto`,
  - `estado = CERRADA`,
  - `aprobadoPorEmail`.
- llama a `ObligacionesService.crearObligacionNovedad()`.

Resultado financiero:
- se crea una obligación de tipo `NOVEDAD` asociada al contrato.
- esa obligación queda pendiente de ser cobrada en el flujo de recaudo.

#### B. Gasto de inmobiliaria

`aprobarGastoInmobiliaria()`:
- valida que la novedad sea aprobable,
- setea:
  - `impactoFinanciero = GASTO_INMOBILIARIA`,
  - `montoAprobado = dto.monto`,
  - `estado = CERRADA`,
  - `gastoPagado = false`.

Resultado financiero:
- el gasto queda asumido por la inmobiliaria,
- no se mueve dinero aún,
- la compensación financiera real ocurre cuando se registra el pago.

Esto cumple el principio clave del dominio: aprobación no es pago.

### 4) Pago real del gasto de inmobiliaria

`pagarGastoInmobiliaria()` es el único paso que genera un movimiento de caja tipo `EGRESO`.

Se ejecutan estas validaciones:
- la novedad debe tener impacto `GASTO_INMOBILIARIA`,
- no debe estar ya pagada,
- debe tener `montoAprobado` válido,
- se exige un `medioPago` real (`EFECTIVO` o `TRANSFERENCIA`).

Luego:
- llama a `movimientosService.registrarEgreso()` con origen `NOVEDAD`,
- marca `gastoPagado = true`,
- guarda `medioPagoGasto`, `referenciaPagoGasto`, `fechaPagoGasto`, `pagadoPorEmail`.

Este diseño está bien alineado con la especificación y con el comportamiento de negocio que se espera del cierre financiero de la novedad.

### 5) Reversión de aprobación

`revertirAprobacion()` es el mecanismo de corrección cuando la aprobación se realizó mal y aún no se materializó en dinero.

Reglas:
- si es `CARGO_ARRENDATARIO`, la obligación tipo novedad debe estar en `PENDIENTE`; de lo contrario se bloquea y exige reversar el pago desde recaudo.
- si es `GASTO_INMOBILIARIA`, se bloquea si `gastoPagado = true`; allí el administrador debe revertir el movimiento desde la sección de movimientos.
- luego la novedad queda:
  - `impactoFinanciero = PENDIENTE`,
  - `estado = EN_SEGUIMIENTO`,
  - `montoAprobado = null`,
  - `aprobadoPorEmail = null`.

La trazabilidad se conserva en `observaciones` y no se destruye el contexto anterior.

## Verificación real del estado de la integración

### Backend

La lógica principal del dominio ya existe y está reforzada con bloqueos pesimistas en los puntos que tocan estado compartido o dinero:
- `cambiarEstado()`
- `aprobarCargoArrendatario()`
- `aprobarGastoInmobiliaria()`
- `pagarGastoInmobiliaria()`
- `revertirAprobacion()`
- `MovimientosService.reversarManual()`

Eso ayuda a prevenir condiciones de carrera y duplicación en decisiones financieras.

### Frontend

La UI ya implementa el ciclo operativo real en `pages/novedades/index.vue`:
- cambiar estado,
- aprobar cargo al arrendatario,
- aprobar gasto de inmobiliaria,
- registrar pago del gasto,
- revertir aprobación.

La pantalla de gastos (`pages/gastos/index.vue`) también refleja la separación correcta entre:
- gasto aprobado pendiente de pago,
- gasto ya pagado.

La parte del Frontend que consume la API y presenta la diferencia entre aprobación y pago está bien alineada con el backend.

## Hallazgos y riesgos reales

### Hallazgo principal: la lógica base ya está implementada, pero falta cierre operativo y documentación

No hay una inconsistencia fundamental en el dominio de financiación de novedades. La mayor parte del core ya está resuelto y probado por integración.

Lo que todavía queda como cierre de la entrega es principalmente:

1. Documento de análisis y trazabilidad del flujo completo (`NOVEDADES_ANALISIS.md`).
2. Verificación explícita de que el flujo de negocio de novedades/recibos está ejecutado en el sistema real y no solo en el código.
3. Cierre de reportes/documentos que permitan exportar este universo de novedades en los mismos patrones que ya se siguen para cartera, recaudo y contratos.
4. Validación final del contrato entre backend y frontend para que cada estado y cada acción estén siempre visibles y no dependan de detalles implícitos del navegador.

### Riesgos menores detectados

- El documento de validación no está aún centralizado como un artefacto del repositorio; el análisis se completa a partir del código y no de una guía operativa única.
- La interfaz y el backend están parcialmente alineados, pero el cierre de reportes y exportación no está todavía formalizado para el universo de novedades.
- Hay que mantener una disciplina estricta de separación entre aprobación y pago, porque este es el punto de negocio más sensible del flujo.

## Conclusión de la Fase 1

El flujo financiero de novedades no está roto en su núcleo: ya existe la separación conceptual y técnica entre:
- novedad registrada,
- novedad aprobada,
- novedad pagada,
- reversión de aprobación,
- movimiento contable real.

Lo que falta no es reconstruir la lógica desde cero, sino validar la consistencia del ciclo completo, dejar la evidencia del análisis y cerrar los puntos de integración y reporte que permitan operar con este flujo de manera segura, documental y verificable.

## Siguiente acción

Se continúa con la Fase 2: corrección de inconsistencias concretas que aún queden en el flujo y que impidan la ejecución completa y consistente del negocio en producción.
