# Fase 4 — Reportes de novedades

Todos los endpoints están bajo `/documentos/reportes`, devuelven `.xlsx`, requieren autenticación y están restringidos a `ADMINISTRADOR` o `CONTADOR`. Cada descarga se registra mediante `@AuditAction()` y el interceptor global de auditoría.

## Endpoints

| Endpoint | Filtros | Contenido |
|---|---|---|
| `GET /documentos/reportes/novedades.xlsx` | Ninguno | Listado general con consecutivo, fecha, descripción, inmueble, cliente, estado, impacto, monto, pago y aprobación. |
| `GET /documentos/reportes/novedades-por-inmueble.xlsx` | `inmuebleId`, `fechaDesde`, `fechaHasta`, `estado` | Inmueble, dirección, cliente, tipo de novedad, descripción, valor, responsable, estado y fecha. |
| `GET /documentos/reportes/novedades-financiero.xlsx` | `fechaDesde`, `fechaHasta` | Fecha, inmueble, cliente, descripción, valor, responsable financiero, estado, monto aprobado y fecha de pago. |
| `GET /documentos/reportes/gastos-inmobiliaria.xlsx` | `fechaDesde`, `fechaHasta`, `inmuebleId` | Fecha, inmueble, descripción, valor, medio de pago, referencia y estado del gasto. |
| `GET /documentos/reportes/novedades-pendientes.xlsx` | Ninguno | Novedades con impacto financiero pendiente y estado operativo abierto o en seguimiento; incluye fecha de creación, inmueble, cliente, descripción, valor, días pendiente y responsable sugerido. |

## Reglas de datos

- Los reportes no usan la paginación de pantalla: consultan el universo completo que corresponde a sus filtros.
- `novedades-pendientes.xlsx` excluye novedades anuladas o cerradas sin resolver, porque no son pendientes operativas aprobables.
- Los gastos distinguen `PAGADO` de `PENDIENTE_PAGO` y conservan medio y referencia reales cuando existen.
- Los importes se escriben con formato monetario COP sin alterar el valor persistido.

## Implementación

- Generadores: `src/modules/documentos/excel-reportes.service.ts`.
- Rutas y autorización: `src/modules/documentos/documentos.controller.ts`.
- Filtros: `src/modules/documentos/dto/filtro-reporte-novedad.dto.ts`.
- Consulta completa y locks del flujo financiero: `src/modules/novedades/novedades.service.ts`.
- Consumo UI: `../FrontendTamara-Saenz/pages/reportes/index.vue`.

## Validación

La suite del servicio Excel verifica encabezados, posiciones de columnas, importes, medios de pago y filas especializadas. El backend completo compila y la suite global terminó con 36 suites y 238 pruebas aprobadas.
