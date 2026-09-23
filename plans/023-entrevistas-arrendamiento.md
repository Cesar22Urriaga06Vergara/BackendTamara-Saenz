# Plan 023: Módulo de entrevistas de arrendamiento

> **ESTADO: IN PROGRESS.** Implementación inicial realizada en backend y frontend. La evolución estructurada 023-B está parcialmente implementada: enums, fiador, riesgo ingreso/canon, privacidad de borradores, autoguardado local y migración aditiva ya están disponibles. Este documento define la lógica funcional, el contrato entre repositorios, los controles de seguridad y los pendientes antes de considerarlo listo para producción.

### Avance 023-B

- Backend: `TipoDocumentoEntrevista`, `EstadoCivilEntrevista`, mayoría de edad, fiador obligatorio completo, relación ingreso/canon, `riesgoIngresos`, justificación obligatoria al aprobar con riesgo y `decididoEn`.
- Backend: Recepción no lista borradores creados por otro usuario.
- Frontend: campos estructurados, fiador completo, alerta de riesgo y recuperación/autoguardado local del borrador.
- Documento: migración aditiva `1786970000000-EntrevistaArrendamientoDatosEstructurados` aplicada en la base de desarrollo; no elimina ni reescribe columnas históricas.
- Pendiente: completar la captura por pasos, selección automática del canon desde el inmueble, DTO específico de actualización, pruebas HTTP de permisos y verificación visual real del PDF con datos largos.

### Avance 023-D: PDF y detalle

- PDF en formato A4 con encabezado corporativo, logo, NIT, régimen, consecutivo y colores de impresión.
- Secciones visuales numeradas: control, datos personales, economía, historial, referencias, convivencia, fiador, decisión y firma.
- Alertas visibles para riesgo de ingresos, soportes faltantes y falta de aceptación del estudio.
- Pie repetido con consecutivo, empresa, NIT, fecha de generación y paginación `Página X de Y`.
- Campos vacíos normalizados a `—`, textos largos con wrap de PDFKit y firmas manuscritas con espacio reservado.
- Vista de detalle Nuxt alineada con el PDF: alertas, referencias, fiador, decisión y trazabilidad de creación/decisión.
- Se añadió una prueba de contenido del PDF; lint focalizado, build backend y typecheck frontend pasan.
- Historial de auditoría por evento aún queda pendiente: la tabla global actual registra HTTP, pero no expone una relación específica por entrevista.

## 1. Objetivo

Registrar y controlar la entrevista que se realiza a un posible **arrendatario**, conservar la información diligenciada como evidencia operativa y permitir consultar o generar un PDF del expediente.

El módulo no reemplaza el contrato de arrendamiento, el estudio financiero ni los recibos de caja. Una entrevista aprobada no crea automáticamente un cliente, codeudor ni contrato.

El formato original contiene dos preguntas repetidas sobre fiador/codeudor. En el sistema se consolidan en un único campo `fiadorCodeudor`.

## 2. Decisiones de negocio

- El entrevistado es el posible arrendatario/inquilino.
- La entrevista puede crearse antes de que exista un cliente o contrato.
- La relación con cliente, inmueble y contrato es opcional.
- La información del formulario se conserva como snapshot: modificar posteriormente los datos del cliente o inmueble no debe alterar lo declarado en la entrevista.
- Recepción registra y consulta entrevistas.
- Administración registra, consulta, cambia estados y toma la decisión final.
- El Contador no tiene acceso a esta información personal salvo que se cree explícitamente una regla de negocio posterior.
- No se cargan certificados, extractos ni documentos escaneados en esta primera versión.
- `presentaSoportes` solo registra si el entrevistado manifestó haber presentado certificación laboral o extractos.
- La firma se registra inicialmente como texto y fecha. No es firma electrónica.

## 3. Estados y transiciones

Estados permitidos:

```text
BORRADOR -> REALIZADA -> APROBADA
                         \-> RECHAZADA
```

Reglas:

| Estado actual | Estado nuevo | Quién | Condiciones |
|---|---|---|---|
| BORRADOR | BORRADOR | Recepción/Admin | Edición de datos permitida |
| BORRADOR | REALIZADA | Recepción/Admin | Captura diligenciada; deja de ser editable |
| REALIZADA | APROBADA | Admin | Decisión exclusiva del Administrador |
| REALIZADA | RECHAZADA | Admin | Motivo de rechazo obligatorio |
| REALIZADA | BORRADOR | Nadie | No se permite retroceder |
| APROBADA | cualquiera | Nadie | Estado final |
| RECHAZADA | cualquiera | Nadie | Estado final |

La autorización se valida en backend. Ocultar botones en Nuxt es únicamente una mejora de interfaz y no un control de seguridad.

## 4. Modelo de datos

Tabla: `entrevista_arrendamiento`.

### Identificación y control

- `id`: UUID interno.
- `consecutivo`: identificador legible, por ejemplo `ENT-000001`.
- `estado`: enum `BORRADOR`, `REALIZADA`, `APROBADA`, `RECHAZADA`.
- `creadoPorEmail`.
- `decididoPorEmail`.
- `motivoDecision`.
- `creadoEn` y `actualizadoEn`.

### Datos personales

- `nombreCompleto`.
- `numeroDocumento`.
- `fechaNacimiento`.
- `estadoCivil`.
- `telefono`.
- `correoElectronico`.
- `personasInmueble`.

### Información laboral y económica

- `empresaActividad`.
- `cargo`.
- `tipoContratoLaboral`.
- `tiempoLaborando`.
- `ingresosMensuales`.
- `otrosIngresos`.
- `presentaSoportes`.

Los valores económicos se almacenan como `decimal(12,2)` y se validan para que no sean negativos.

### Historial de arrendamiento

- `direccionActual`.
- `motivoMudanza`.
- `arrendadorAnterior`.
- `telefonoArrendadorAnterior`.
- `problemasPago`.

### Referencias

Cada referencia conserva nombre y teléfono:

- `referenciaLaboral` / `telefonoReferenciaLaboral`.
- `referenciaPersonal` / `telefonoReferenciaPersonal`.
- `referenciaFamiliar` / `telefonoReferenciaFamiliar`.

### Convivencia, condiciones y firma

- `mascotas`.
- `fuma`.
- `permanenciaEstimada`.
- `fiadorCodeudor`.
- `aceptaEstudioCredito`.
- `observaciones`.
- `firmaSolicitante`.
- `fechaFirma`.

### Relaciones opcionales

- `clienteId` -> `cliente.id`.
- `inmuebleId` -> `inmueble.id`.
- `contratoId` -> `contrato.id`.

Las relaciones usan `ON DELETE SET NULL` para conservar el expediente aunque se elimine una relación de directorio. La información textual del snapshot permanece.

## 5. API backend

Módulo: `src/modules/entrevistas-arrendamiento/`.

### Crear

```http
POST /api/v1/entrevistas-arrendamiento
Authorization: Bearer <token>
Content-Type: application/json
```

Crea siempre en `BORRADOR`. El correo del usuario se toma del token, no del cuerpo enviado por el frontend.

Campos mínimos:

```json
{
  "nombreCompleto": "Ana Pérez",
  "numeroDocumento": "123456789"
}
```

### Listar

```http
GET /api/v1/entrevistas-arrendamiento?page=1&limit=10&busqueda=ana&estado=REALIZADA&fechaDesde=2026-09-01&fechaHasta=2026-09-30
```

Devuelve resultado paginado con forma:

```json
{
  "data": [],
  "total": 0
}
```

Filtros:

- `busqueda`: nombre o número de documento.
- `estado`: enum permitido.
- `fechaDesde` y `fechaHasta`: fecha ISO 8601.
- `inmuebleId`: UUID opcional.
- `page` y `limit`: paginación común; `limit` máximo 100.

La interfaz puede enviar cadenas vacías para filtros no seleccionados. El DTO las transforma a `undefined` antes de validar, por lo que no se produce un falso `400`.

### Obtener detalle

```http
GET /api/v1/entrevistas-arrendamiento/:id
```

Carga relaciones opcionales de cliente, inmueble y contrato. Si no existe, responde `404`.

### Actualizar

```http
PATCH /api/v1/entrevistas-arrendamiento/:id
```

Solo permite modificar una entrevista en `BORRADOR`. Una entrevista `REALIZADA`, `APROBADA` o `RECHAZADA` conserva su contenido histórico y no se edita en sitio.

### Cambiar estado

```http
PATCH /api/v1/entrevistas-arrendamiento/:id/estado
Content-Type: application/json
```

Ejemplo de realización:

```json
{
  "estado": "REALIZADA"
}
```

Ejemplo de rechazo:

```json
{
  "estado": "RECHAZADA",
  "motivo": "No cumple las condiciones definidas para el inmueble."
}
```

La acción debe llevar `@AuditAction` y registrar quién ejecutó el cambio.

## 6. Matriz de permisos

| Acción | Administrador | Recepcionista | Contador |
|---|---:|---:|---:|
| Crear entrevista | Sí | Sí | No |
| Consultar listado | Sí | Sí | No |
| Consultar detalle | Sí | Sí | No |
| Editar borrador | Sí | Sí | No |
| Marcar como realizada | Sí | Sí | No |
| Aprobar | Sí | No | No |
| Rechazar | Sí | No | No |
| Ver PDF | Sí | Sí | No |

La clase del controlador permite `ADMINISTRADOR` y `RECEPCIONISTA`; las decisiones finales se restringen adicionalmente en el servicio.

## 7. PDF y documentos

Endpoint:

```http
GET /api/v1/documentos/entrevistas-arrendamiento/:id/pdf
```

Comportamiento:

- Requiere autenticación.
- Permite Administración y Recepción.
- Genera el PDF al vuelo; no se almacena un archivo permanente.
- Responde `Content-Type: application/pdf`.
- Usa `Content-Disposition: inline` para abrir/ver/imprimir.
- El nombre usa el consecutivo, por ejemplo `ENT-000001.pdf`.
- Usa empresa, NIT, logo y datos corporativos existentes.
- No muestra UUIDs internos como identificadores legibles.
- Incluye el estado de control, creador, decisor y motivo de decisión.
- Incluye todas las secciones del formato original.
- Debe soportar textos largos sin solapamiento ni pérdida de contenido.

Servicio: `PdfEntrevistaArrendamientoService`. No debe reutilizar `PdfReciboService` porque la entrevista no es un documento financiero.

## 8. Frontend Nuxt/Vue

Rutas:

- `/entrevistas-arrendamiento`: listado paginado y filtrable.
- `/entrevistas-arrendamiento/nueva`: formulario de captura.
- `/entrevistas-arrendamiento/:id`: detalle, estado y PDF.

Componentes y composables:

- `components/entrevistas-arrendamiento/Formulario.vue`: captura por secciones; usa Composition API y `script setup lang="ts"`.
- `composables/useEntrevistasArrendamiento.ts`: contrato tipado para crear, actualizar, cambiar estado y abrir PDF.
- `types/entrevistas-arrendamiento.ts`: tipos alineados con respuesta backend.
- `useListadoPaginado`: paginación, carga, filtros y errores.
- `usePdfDownload`: abre el PDF autenticado en una pestaña nueva.
- `SharedStatusBadge`: representación de estados sin depender únicamente del color.

La página de listado no debe contener toda la lógica del formulario. El flujo de datos debe ser props hacia componentes y eventos hacia la página contenedora.

## 9. Validación y privacidad

La entrevista contiene datos personales y potencialmente financieros. Aplican estos controles:

- Validar todos los campos en DTO backend, aunque exista validación visual en Nuxt.
- Limitar longitudes de texto y tamaño de campos libres.
- Validar correo, fechas, UUIDs, enums y montos no negativos.
- No registrar el cuerpo completo de la entrevista en logs.
- No exponer entrevistas sin JWT.
- No crear endpoints públicos ni URLs permanentes de PDF.
- No guardar contraseñas, tokens, soportes o documentos escaneados en esta tabla.
- No usar `v-html` para mostrar observaciones o referencias.
- No permitir que el frontend envíe `creadoPorEmail` o `decididoPorEmail` como autoridad.
- Registrar creación, cambio de estado y descarga de PDF mediante auditoría.
- Mantener `DB_SYNCHRONIZE=false` en producción; el esquema se modifica únicamente por migraciones.

## 10. Migraciones y despliegue

Migración:

```text
src/database/migrations/1786960000000-EntrevistasArrendamiento.ts
```

En producción el arranque debe ejecutar:

```bash
npm run deploy:migrate && node dist/main
```

El script actual de producción es:

```json
"start:prod": "npm run deploy:migrate && node dist/main"
```

Render debe arrancar el contenedor mediante `npm run start:prod`. TypeORM compara la tabla `migrations` con los archivos compilados y ejecuta solo las migraciones pendientes.

Esto no debe reemplazarse por un `INSERT` manual en `migrations`: registrar una migración sin ejecutar su SQL puede dejar el esquema incompleto. Tampoco se debe activar `synchronize` en producción.

## 11. Pruebas requeridas

### Backend

- Crear entrevista con campos mínimos.
- Crear sin cliente, inmueble ni contrato.
- Conservar snapshot de nombre, documento e ingresos.
- Crear consecutivo único.
- Aceptar filtros vacíos enviados por Nuxt.
- Rechazar estado inválido.
- Rechazar fechas no ISO.
- Marcar borrador como realizada.
- Rechazar aprobación por Recepción con `403`.
- Rechazar rechazo sin motivo.
- Rechazar decisión sobre borrador.
- Impedir edición después de `REALIZADA`.
- Obtener `404` para UUID inexistente.
- Generar PDF con campos opcionales vacíos.
- Generar PDF con textos largos.
- Verificar que el PDF no contiene UUIDs internos como identificadores visibles.

### Frontend

- Mostrar filtros y listado vacío correctamente.
- Crear una entrevista con campos obligatorios.
- Deshabilitar guardar sin nombre o documento.
- Mostrar solo acciones permitidas por rol.
- Mostrar campo de motivo al seleccionar `RECHAZADA`.
- Abrir PDF desde listado y detalle.
- Mantener errores de API visibles y recuperables.
- Ejecutar `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build`.

### Humo de aceptación

1. Iniciar backend y frontend.
2. Iniciar sesión como Recepción.
3. Crear entrevista y confirmar que queda `BORRADOR`.
4. Marcarla `REALIZADA`.
5. Consultar detalle y abrir PDF.
6. Intentar aprobar como Recepción y confirmar `403`.
7. Iniciar sesión como Administración.
8. Aprobar o rechazar con motivo.
9. Confirmar que el PDF refleja el estado y la trazabilidad.
10. Reiniciar el backend y verificar que no se pierdan datos.

## 12. Fuera de alcance

- Firma electrónica con validez jurídica.
- Carga de documentos y certificados.
- Scoring automático.
- Consulta a centrales de riesgo.
- Notificaciones por correo o WhatsApp.
- Conversión automática de entrevista aprobada a cliente o contrato.
- Flujo de portal público para aspirantes.
- Eliminación física de entrevistas decididas.

## 13. Pendientes técnicos antes de producción

- Confirmar que la migración `1786960000000` está incluida en el artefacto `dist` del deploy.
- Verificar las variables de conexión de Render contra Aiven.
- Ejecutar `npm run deploy:migrate` en un entorno de staging antes de producción.
- Completar pruebas de integración HTTP con base MySQL real.
- Revisar que el consecutivo se obtenga dentro de la misma transacción de creación para evitar huecos si falla el guardado posterior.
- Validar relaciones opcionales (`clienteId`, `inmuebleId`, `contratoId`) antes de guardar y devolver `404` claro si alguna no existe.
- Aplicar DTO específico para actualización parcial en vez de aceptar directamente `Partial<CreateEntrevistaArrendamientoDto>` en el controlador.
- Confirmar que las longitudes de campos libres cumplen la política de privacidad y operación.
