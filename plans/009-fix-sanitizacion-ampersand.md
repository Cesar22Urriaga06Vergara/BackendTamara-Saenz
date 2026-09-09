# Plan 009: `SanitizarHtmlPipe` corrompía `&`/`<`/`>` en texto plano legítimo

> **ESTADO: DONE.** Ver commit al final. Encontrado durante BE-008 (mejoras visuales de PDF):
> el nombre de la empresa se mostraba como `"...&amp; Saenz..."` en los 3 PDFs revisados.

## Status

- **Priority**: P1 — afecta CUALQUIER campo de texto enviado por `POST`/`PATCH` en toda la API,
  no solo el nombre de la empresa (nombres de clientes, direcciones, descripciones, etc.).
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (datos)

## Why this matters

`src/common/pipes/sanitizar-html.pipe.ts` es un pipe **global** (`main.ts:63`, aplicado a TODO el
body de TODA petición `POST`/`PATCH`/`PUT`) que sanitiza cada string contra XSS almacenado con
`sanitizeHtml(valor, { allowedTags: [], allowedAttributes: {} })`.

Esa configuración sí elimina tags reales correctamente (`<script>alert(1)</script>` → eliminado
por completo, protección XSS intacta) — pero el serializador interno de `sanitize-html` **también
codifica como entidad HTML** cualquier `&`, `<`, `>` que sobreviva como texto plano, aunque nunca
formaron parte de un tag real. Ejemplo confirmado: `"Inversiones Tamara & Saenz S. En C."` se
guardaba literalmente como `"Inversiones Tamara &amp; Saenz S. En C."` en la base de datos, visible
después en cualquier pantalla o PDF que mostrara ese nombre.

Esto corrompe silenciosamente cualquier dato de negocio legítimo que contenga esos caracteres —
razones sociales con "&", direcciones con "<"/">", etc. — en **cualquier** campo de texto de la
API, no solo `empresa.nombre`.

## Root cause

`sanitize-html` parsea el string como si fuera HTML y lo vuelve a serializar; el texto que
sobrevive (no forma parte de un tag eliminado) se serializa con sus caracteres reservados
HTML-encodeados, como haría cualquier serializador HTML válido. Como este sistema **nunca**
vuelve a renderizar estos valores como HTML (confirmado: sin `v-html` en ningún `.vue` del
frontend; PDFKit dibuja texto literal, no interpreta markup), ese encoding es puro ruido que
termina siendo dato corrupto.

## Fix

En `limpiarValor()`, tras `sanitizeHtml(...)`, se decodifican las 5 entidades HTML básicas de
vuelta a su carácter literal (`&amp;`→`&`, `&lt;`→`<`, `&gt;`→`>`, `&quot;`→`"`, `&#39;`→`'`),
en ese orden (`&amp;` al final, para no re-decodificar un `&lt;` que en realidad representaba el
texto literal de 4 caracteres `&lt;` tecleado por el usuario). Es seguro decodificar después de
sanitizar: `allowedTags: []` ya garantiza que ningún tag real sobrevive en el resultado, así que no
hay ninguna estructura de markup que pudiera "reactivarse" al decodificar.

## Scope

**In scope**: `src/common/pipes/sanitizar-html.pipe.ts`,
`src/common/pipes/sanitizar-html.pipe.spec.ts` (nuevo — el pipe no tenía ningún test), y
`package.json` (`jest.transformIgnorePatterns`, ver STOP conditions / hallazgo colateral abajo).

**Out of scope**: cualquier dato ya corrompido en la BD real (nombres/direcciones ya guardados
con `&amp;` en vez de `&`) — este fix solo corrige las **futuras** escrituras. Si se quiere migrar
datos históricos, es una decisión y un script aparte del dueño.

## Hallazgo colateral durante la implementación: Jest no podía cargar `sanitize-html`

Al escribir el primer test unitario que instancia `SanitizarHtmlPipe` (nunca antes se había hecho
— el pipe solo se ejercitaba en runtime real vía `main.ts`, no en los specs de integración, que
usan `bootstrapTestApp()` sin pasar por `main.ts`), Jest falló con
`SyntaxError: Cannot use import statement outside a module` — `sanitize-html` v2.17.7 vendoriza
versiones ESM-only de sus dependencias internas (`htmlparser2`, `entities`, `dom-serializer`,
`domelementtype`, `domhandler`, `domutils`, todas en `node_modules/sanitize-html/node_modules/`),
y la config de Jest del repo ignora por defecto todo `node_modules` en la transformación.

Se amplió `jest.transformIgnorePatterns` en `package.json` para permitir que `ts-jest` transforme
específicamente ese subárbol de dependencias (lista explícita de los 7 paquetes nested, no un
comodín — más robusto a cambios futuros de versión sin abrir la puerta a transformar todo
`node_modules`, lo que ralentizaría la suite completa).

## Verificación

- `npm run lint`, `npm run build`, `npm test` → exit 0 (173/173, 167 previos + 6 nuevos).
- Nuevo `sanitizar-html.pipe.spec.ts` (6 tests): elimina tags reales (XSS intacto), no corrompe
  `&` en un dato de negocio legítimo, no corrompe `<`/`>` en texto plano, nunca toca `password`,
  sanitiza recursivamente objetos/arreglos anidados, no toca valores fuera de `body`.
- **Humo real** contra el backend corriendo: `PATCH /empresa` con
  `{"nombre":"Inversiones Tamara & Saenz S. En C."}` → la respuesta y el `GET /empresa/publico`
  posterior muestran el `&` literal (antes: `&amp;`). Confirmado además que un intento real de XSS
  (`{"nombre":"<script>alert(1)</script>Empresa Segura"}`) sigue devolviendo solo `"Empresa
  Segura"` — protección intacta. Regenerado el PDF del recibo real y confirmado visualmente que
  el encabezado ya no muestra `&amp;`. Nombre de la empresa restaurado a su valor correcto tras
  la prueba.

## Maintenance notes

- **Reviewer**: confirmar que `decodificarEntidadesBasicas` se aplica DESPUÉS de `sanitizeHtml`,
  nunca antes (decodificar antes permitiría que un tag disfrazado con entidades — `&lt;script&gt;`
  — se convirtiera en un tag real justo antes de sanitizar, aunque en ese orden específico
  `sanitizeHtml` igual lo trataría como texto entrante sin decodificar primero, así que el orden
  actual — sanitizar primero, decodificar después — es el único correcto).
- **Diferido**: no se migran datos ya corrompidos en la BD real con `&amp;` guardado. Si se quiere,
  requiere un script de limpieza aparte revisado por el dueño (identificar todas las columnas de
  texto afectadas, no solo `empresa.nombre`).
