# AUDITORÍA INTEGRAL DEL FRONTEND + PLAN DE ACCIÓN
## Inversiones Tamara & Saenz S.E.N.C.

Actúa como un equipo compuesto por:

- **Frontend Engineer Senior**
- **UI/UX Designer Senior**
- **Product Designer**
- **Software Architect**
- **Auditor de aplicaciones administrativas y financieras**
- **Especialista en accesibilidad y responsive design**

Tu objetivo en esta etapa NO es comenzar a programar.

Tu objetivo es:

> **comprender profundamente el frontend actual, auditarlo contra la especificación y las referencias visuales, detectar oportunidades de mejora y diseñar un plan de acción completo, ordenado y técnicamente seguro.**

---

# 1. OBJETIVO REAL

No quiero una auditoría orientada a "conservar lo que ya existe".

Tampoco quiero una reescritura arbitraria.

Quiero una **auditoría de mejora integral**.

Esto significa:

> **Todo el frontend puede mejorarse.**

Una funcionalidad que actualmente funciona correctamente NO debe considerarse automáticamente como definitiva.

Debe evaluarse nuevamente desde:

- UX;
- UI;
- arquitectura;
- mantenibilidad;
- consistencia;
- accesibilidad;
- responsive;
- navegación;
- claridad;
- eficiencia operativa;
- escalabilidad.

---

# 2. PRINCIPIO FUNDAMENTAL

Diferencia claramente entre:

### IMPLEMENTACIÓN ACTUAL

Lo que existe hoy.

### REGLA DE NEGOCIO

Lo que el sistema debe hacer.

### EXPERIENCIA DE USUARIO

Cómo debería vivir el usuario esa funcionalidad.

### SOLUCIÓN TÉCNICA

Cómo está implementada actualmente y cómo podría implementarse mejor.

### SOLUCIÓN OBJETIVO

Cómo debería quedar después de la mejora.

---

# 3. NADA ESTÁ "INTocable"

No asumas:

"Funciona → no se toca."

Ese NO es el criterio.

El criterio es:

"Funciona → analizar si puede hacerse mejor."

Por ejemplo, una operación de recaudo puede ser financieramente correcta pero aun así necesitar mejoras en:

- diseño;
- jerarquía;
- pasos;
- feedback;
- accesibilidad;
- responsive;
- textos;
- visualización;
- componentes;
- navegación;
- prevención de errores.

Por lo tanto:

**NO proteger automáticamente ningún componente solo porque actualmente funciona.**

---

# 4. QUÉ SÍ DEBE PRESERVARSE

Lo que debe preservarse son las reglas y garantías del negocio.

Especialmente:

- integridad financiera;
- autorización;
- roles;
- trazabilidad;
- estados válidos;
- reglas de aplicación de dinero;
- relaciones entre entidades;
- consistencia de datos;
- controles de operaciones sensibles.

Pero incluso esas áreas pueden ser **mejoradas en su implementación y experiencia**, siempre que el comportamiento de negocio correcto permanezca.

---

# 5. MATERIAL DE REFERENCIA

Analiza conjuntamente:

## FUENTE 1 — FRONTEND ACTUAL

Inspecciona completamente el repositorio.

No te limites a las páginas principales.

Revisa también:

- componentes;
- composables;
- stores;
- middleware;
- layouts;
- utilidades;
- servicios;
- estilos;
- configuración;
- manejo de estado;
- permisos;
- navegación.

---

## FUENTE 2 — ESPECIFICACIÓN UI/UX

Utiliza:

`ESPECIFICACION_UI_UX_PAGINA_POR_PAGINA.md`

como referencia funcional, visual y estructural.

La especificación describe:

- páginas;
- patrones;
- componentes;
- estados;
- acciones;
- permisos;
- responsive;
- accesibilidad;
- operaciones financieras;
- criterios de aceptación.

No ignores las partes que actualmente no estén implementadas.

Precisamente debes detectar esas brechas.

---

## FUENTE 3 — MOCKUPS / POSIBLES VISTAS

Utiliza las vistas entregadas como referencia de:

- estructura;
- jerarquía;
- densidad;
- estilo;
- navegación;
- composición;
- intención visual.

No copies literalmente la maqueta.

Extrae sus principios.

---

## FUENTE 4 — LOGO

El logo ya está incorporado en el frontend.

NO necesitas proponer volver a integrarlo.

Evalúa cómo el frontend actual utiliza la identidad visual derivada del logo.

---

# 6. PRIMERA REGLA: NO MODIFICAR CÓDIGO DURANTE ESTA ETAPA

Durante esta etapa:

NO:

- editar archivos;
- eliminar archivos;
- crear archivos;
- cambiar componentes;
- hacer commits;
- modificar backend;
- modificar lógica financiera;
- modificar base de datos.

Primero:

**INSPECCIONAR → COMPRENDER → AUDITAR → COMPARAR → PRIORIZAR → PLANIFICAR**

La implementación se hará en una fase posterior.

---

# 7. AUDITORÍA DE TODO EL REPOSITORIO

Antes de evaluar visualmente las páginas:

comprende la arquitectura completa.

Analiza:

- framework;
- estructura;
- routing;
- layouts;
- componentes;
- composables;
- stores;
- middleware;
- servicios;
- llamadas API;
- estados;
- permisos;
- estilos;
- variables;
- utilidades;
- manejo de errores;
- loading;
- responsive.

Identifica:

### CORRECTAMENTE ESTRUCTURADO

### MEJORABLE

### DUPLICADO

### FRÁGIL

### OBSOLETO

### INCONSISTENTE

### CÓDIGO MUERTO

### CÓDIGO CON RIESGO

### OPORTUNIDAD DE REFACTORIZACIÓN

No elimines nada durante esta auditoría.

Solo documenta.

---

# 8. AUDITORÍA VISUAL COMPLETA

Evalúa:

## Layout

- sidebar;
- header;
- contenido;
- breadcrumbs;
- anchuras;
- márgenes;
- espaciado;
- alineación.

## Tipografía

- jerarquía;
- tamaños;
- pesos;
- legibilidad.

## Color

- identidad;
- estados;
- acciones;
- contraste.

## Componentes

- botones;
- inputs;
- selects;
- tablas;
- cards;
- badges;
- tabs;
- modales;
- alertas.

## Densidad

Determina si existe:

- saturación;
- exceso de tarjetas;
- espacios desperdiciados;
- exceso de botones;
- demasiada información simultánea.

No evalúes únicamente "si se ve bonito".

Evalúa si facilita trabajar.

---

# 9. AUDITORÍA UX

Para cada módulo responde:

### ¿El usuario sabe dónde está?

### ¿Entiende qué está viendo?

### ¿Sabe cuál es la acción principal?

### ¿Sabe qué ocurrirá al ejecutarla?

### ¿Puede cometer errores?

### ¿El sistema previene esos errores?

### ¿Recibe feedback?

### ¿Puede recuperarse de un error?

### ¿Puede entender el estado actual?

### ¿Puede llegar rápidamente a la siguiente acción?

### ¿La cantidad de pasos es razonable?

### ¿Existe una forma mejor de realizar la misma tarea?

---

# 10. AUDITORÍA DE ARQUITECTURA DE INFORMACIÓN

Compara:

### Arquitectura actual

vs.

### Arquitectura propuesta por la especificación

vs.

### Arquitectura que consideres óptima después de analizar el dominio.

No asumas que la especificación debe copiarse literalmente.

Pero tampoco descartes una pantalla simplemente porque actualmente la funcionalidad está fusionada.

Determina para cada módulo:

- mantener;
- fusionar;
- separar;
- reorganizar;
- rediseñar;
- reemplazar.

Y explica por qué.

---

# 11. AUDITORÍA DE NAVEGACIÓN

Analiza:

- menú;
- agrupaciones;
- nombres;
- rutas;
- jerarquía;
- contexto;
- navegación entre entidades;
- navegación hacia operaciones.

Evalúa si existe una navegación más intuitiva.

No te limites a comparar nombres.

Evalúa la **experiencia completa de navegación**.

---

# 12. AUDITORÍA DE TABLAS

Revisar todas las tablas.

Para cada una:

- columnas;
- orden;
- densidad;
- filtros;
- búsqueda;
- paginación;
- ordenamiento;
- estados;
- acciones;
- responsive;
- empty;
- loading;
- error.

Determina si:

- sobran columnas;
- faltan columnas;
- las acciones están bien ubicadas;
- se pueden mejorar;
- conviene usar una vista de detalle;
- conviene utilizar acciones contextuales.

---

# 13. AUDITORÍA DE ACCIONES

Las acciones deben analizarse por entidad y estado.

No basta con verificar que exista "Acciones".

Determina:

- qué acciones existen;
- cuáles faltan;
- cuáles sobran;
- cuáles deberían ser primarias;
- cuáles secundarias;
- cuáles deberían estar en menú contextual;
- cuáles deberían mostrarse directamente;
- cuáles deben estar deshabilitadas;
- cuáles nunca deberían existir.

Especialmente:

- Ver;
- Editar;
- Recaudar;
- Anular;
- Reversar;
- Terminar;
- Reactivar;
- Resolver;
- Pagar;
- Liquidar;
- Devolver.

---

# 14. AUDITORÍA DE OPERACIONES FINANCIERAS

Estas operaciones reciben revisión especial:

- Recaudo;
- Recibo;
- Obligaciones;
- Cartera;
- Gastos;
- Depósitos;
- Caja;
- Transferencias.

Para cada una evalúa:

### Datos

### Revisión

### Confirmación

### Resultado

Y además:

- claridad;
- prevención de errores;
- impacto;
- trazabilidad;
- feedback;
- consistencia.

La especificación establece el patrón:

**Datos → revisión → confirmación → resultado.**

Debes comprobar no solo si existe, sino si la experiencia puede mejorarse.

---

# 15. RECAUDO

Auditar específicamente:

- selección;
- deuda;
- obligaciones;
- valor recibido;
- medio;
- referencia;
- aplicación;
- excedente;
- preview;
- confirmación;
- resultado;
- recibo;
- saldo posterior.

La lógica de negocio de aplicación debe mantenerse.

Pero la UX puede y debe mejorarse si existe una solución superior.

Analiza especialmente si:

- Canon;
- Novedad;
- Mora;

se entienden inmediatamente.

---

# 16. AUDITORÍA DE ESTADOS

Revisar:

- estados existentes;
- estados faltantes;
- estados innecesarios;
- etiquetas;
- colores;
- transiciones;
- acciones disponibles por estado.

No inventar estados durante la implementación.

Si detectas un posible estado adicional necesario, clasifícalo como:

**DECISIÓN DE PRODUCTO PENDIENTE**

y no como cambio automático.

---

# 17. AUDITORÍA DE PERMISOS

Revisa:

- middleware;
- navegación;
- botones;
- formularios;
- acciones;
- rutas;
- estados.

Comprueba que:

- un usuario no vea acciones que no le corresponden;
- pueda hacer lo que sí le corresponde;
- no existan inconsistencias entre ruta y UI.

Pero recuerda:

**la seguridad real sigue siendo responsabilidad del backend.**

---

# 18. AUDITORÍA RESPONSIVE

No considerar responsive simplemente porque la página "cabe".

Analiza:

### Desktop

### Tablet

### Mobile

Revisa:

- sidebar;
- header;
- tablas;
- filtros;
- formularios;
- modales;
- acciones;
- tarjetas;
- dinero;
- navegación.

Determina exactamente cómo debería mejorar cada uno.

---

# 19. AUDITORÍA DE ACCESIBILIDAD

Revisa:

- contraste;
- labels;
- foco;
- teclado;
- icon buttons;
- aria-label;
- mensajes de error;
- estados;
- navegación.

Determina qué cumple y qué puede mejorar.

---

# 20. AUDITORÍA DE COMPONENTES

Analiza si existen patrones que deberían centralizarse:

- PageHeader;
- Breadcrumbs;
- SearchBar;
- FilterBar;
- DataTable;
- StatusBadge;
- MoneyValue;
- SummaryCard;
- Tabs;
- DetailSection;
- ConfirmDialog;
- OperationWizard;
- OperationSummary;
- AuditTimeline;
- EmptyState;
- ErrorState;
- SkeletonTable;
- FormSection;
- MoneyInput;
- DateInput;
- ReferenceInput;
- ExportButton.

No debes crearlos ahora.

Debes determinar:

- si hacen falta;
- cuáles ya existen con otro nombre;
- cuáles están duplicados;
- cuáles deben refactorizarse;
- cuáles no vale la pena crear.

---

# 21. AUDITORÍA DE MANTENIBILIDAD

Buscar:

- duplicación;
- funciones repetidas;
- estilos repetidos;
- mapas de estados repetidos;
- lógica de filtros duplicada;
- componentes demasiado grandes;
- responsabilidades mezcladas;
- stores sin uso;
- composables infrautilizados;
- código muerto;
- nombres inconsistentes.

Pero no hacer refactor simplemente por "limpiar".

Toda refactorización debe tener un beneficio claro.

---

# 22. AUDITORÍA DE EXPERIENCIA FINANCIERA

Cada pantalla que muestre dinero debe facilitar entender:

- cuánto;
- concepto;
- obligación;
- medio;
- impacto;
- saldo;
- usuario.

Determina si la presentación actual:

### Excelente

### Buena

### Mejorable

### Confusa

Y explica por qué.

---

# 23. AUDITORÍA DE FEEDBACK

Revisar:

- loading;
- éxito;
- error;
- advertencia;
- confirmación;
- operaciones largas;
- mensajes vacíos;
- reintentos.

No conformarse con que exista un mensaje.

Evaluar si el usuario realmente entiende qué ocurrió.

---

# 24. AUDITORÍA DE FORMULARIOS

Revisar:

- agrupación;
- etiquetas;
- orden;
- dependencias;
- validación;
- campos condicionales;
- defaults;
- formatos;
- errores;
- preview.

Determinar si existen formularios que deberían transformarse en:

- wizard;
- pasos;
- secciones;
- formularios progresivos.

---

# 25. CLASIFICACIÓN DE CADA HALLAZGO

Cada hallazgo debe clasificarse como uno de estos:

### CONSERVAR

Funciona bien y no requiere cambio significativo.

### MEJORAR

Funciona, pero existe una experiencia mejor.

### REFACTORIZAR

Funciona, pero su implementación es innecesariamente duplicada o frágil.

### REESTRUCTURAR

Funciona, pero la ubicación o arquitectura no es óptima.

### REEMPLAZAR

La solución actual no es suficientemente buena.

### CREAR

La funcionalidad todavía no existe.

### DECISIÓN DE PRODUCTO

No puede resolverse técnicamente sin una decisión del negocio.

IMPORTANTE:

**"CONSERVAR" no significa "NO TOCAR".**

Significa que su comportamiento es correcto y debe preservarse mientras se evalúan mejoras de UI/UX cuando correspondan.

---

# 26. MATRIZ DE AUDITORÍA

Crear:

| ID | Módulo | Elemento | Situación actual | Problema | Tipo | Prioridad | Riesgo | Recomendación |
|---|---|---|---|---|---|---|---|---|

Prioridades:

### P0
Crítico.

### P1
Alto impacto.

### P2
Mejora importante.

### P3
Pulido.

---

# 27. AUDITORÍA POR PÁGINA

Para cada página utilizar:

## Página

### 1. Objetivo actual

### 2. Estado actual

### 3. Qué funciona bien

### 4. Qué puede mejorar

### 5. Qué falta

### 6. Qué sobra

### 7. Problemas de UX

### 8. Problemas de UI

### 9. Arquitectura

### 10. Responsive

### 11. Accesibilidad

### 12. Permisos

### 13. Acciones

### 14. Recomendación de diseño futuro

### 15. Tipo de cambio

Conservar / Mejorar / Refactorizar / Reestructurar / Reemplazar / Crear

### 16. Prioridad

P0 / P1 / P2 / P3

---

# 28. MUY IMPORTANTE SOBRE EL MOCKUP

No asumir:

"El mockup tiene una tarjeta → debemos copiar esa tarjeta."

Analiza:

- qué problema resuelve;
- qué información comunica;
- cómo organiza el espacio;
- cuál es la jerarquía;
- qué patrón de interacción propone.

Después determina cómo implementar la misma intención de forma aún mejor en el frontend real.

---

# 29. MUY IMPORTANTE SOBRE LA ESPECIFICACIÓN

No convertir automáticamente cada punto de la especificación en trabajo obligatorio.

Para cada diferencia determinar:

### ¿Es una deuda real?

### ¿Es una mejora UX?

### ¿Es una decisión diferente pero válida?

### ¿Es una decisión de producto?

### ¿Es algo que debería cambiarse?

La especificación es una fuente fundamental, pero la auditoría debe aplicar criterio de producto.

---

# 30. PLAN DE ACCIÓN FINAL

Después de completar toda la auditoría, crear un plan de acción.

No ordenarlo solamente por páginas.

Ordenarlo por:

1. dependencias;
2. impacto;
3. riesgo;
4. arquitectura;
5. experiencia;
6. estabilidad.

---

# 31. FASE 0 — BASE

Proponer primero todas las mejoras que afectan transversalmente:

- layout;
- navegación;
- header;
- sidebar;
- responsive;
- componentes globales;
- estados;
- permisos;
- sistema visual.

---

# 32. FASE 1 — EXPERIENCIA PRINCIPAL

Priorizar:

- Dashboard;
- Contratos;
- Clientes;
- Inmuebles;
- Novedades.

---

# 33. FASE 2 — DETALLES

Determinar el orden óptimo de:

- Contrato;
- Cliente;
- Inmueble;
- Obligación;
- Recibo;
- Depósito;
- Usuario.

No asumir automáticamente el orden de la especificación.

Justificar el orden.

---

# 34. FASE 3 — FINANZAS

Determinar la arquitectura definitiva de:

- Obligaciones;
- Recaudo;
- Cartera;
- Gastos;
- Depósitos;
- Caja;
- Transferencias;
- Movimientos;
- Recibos.

Aquí debes decidir si conviene:

- mantener módulos fusionados;
- separarlos;
- crear vistas complementarias;
- reorganizar la navegación.

Si existe una decisión que requiere aprobación del negocio:

marcarla como **BLOQUEANTE**.

---

# 35. FASE 4 — CONSISTENCIA

Luego:

- componentes;
- estilos;
- tablas;
- filtros;
- estados;
- dinero;
- formularios;
- mensajes.

---

# 36. FASE 5 — RESPONSIVE Y ACCESIBILIDAD

Aplicar al conjunto estable de pantallas:

- móvil;
- tablet;
- teclado;
- accesibilidad;
- lectores;
- foco;
- interacción táctil.

---

# 37. FASE 6 — REFINAMIENTO

Finalmente:

- microinteracciones;
- espaciados;
- tipografía;
- iconografía;
- densidad;
- rendimiento;
- detalles visuales.

---

# 38. PARA CADA ACCIÓN DEL PLAN INDICAR

### Qué cambiar

### Por qué

### Beneficio

### Archivos/componentes afectados

### Dependencias

### Riesgo

### Prioridad

### Validación

---

# 39. NO HACER UNA REESCRITURA SIN JUSTIFICACIÓN

Aunque todo pueda mejorarse:

NO recomendar:

"rehacer todo desde cero"

simplemente porque existe código antiguo.

Solo proponer reemplazo cuando:

- la arquitectura actual impide avanzar;
- el mantenimiento es demasiado costoso;
- existe riesgo real;
- una nueva arquitectura reduce complejidad de forma significativa.

Si es posible mejorar incrementalmente:

**preferir mejora incremental.**

---

# 40. PROTEGER LA INTEGRIDAD DEL SISTEMA

Si identificas una solución visual que podría alterar:

- cálculo;
- estado;
- autorización;
- aplicación financiera;
- trazabilidad;

NO la propongas como cambio automático.

Marca:

**RIESGO DE NEGOCIO — REQUIERE VALIDACIÓN**

---

# 41. RESULTADO FINAL

Quiero recibir un informe estructurado así:

# 1. Resumen ejecutivo

# 2. Diagnóstico general

# 3. Arquitectura actual

# 4. Arquitectura recomendada

# 5. Auditoría visual

# 6. Auditoría UX

# 7. Auditoría de navegación

# 8. Auditoría responsive

# 9. Auditoría de accesibilidad

# 10. Auditoría de permisos

# 11. Auditoría financiera

# 12. Auditoría página por página

# 13. Auditoría de componentes

# 14. Auditoría de acciones y estados

# 15. Hallazgos P0

# 16. Hallazgos P1

# 17. Hallazgos P2

# 18. Hallazgos P3

# 19. Decisiones de producto pendientes

# 20. Matriz completa de hallazgos

# 21. Arquitectura objetivo

# 22. Plan de acción

# 23. Dependencias

# 24. Riesgos

# 25. Criterios de validación

# 26. Orden recomendado de implementación

---

# 42. PRINCIPIO FINAL

Quiero que pienses de esta forma:

> **"No estoy auditando para decidir qué partes dejar como están. Estoy auditando para descubrir cómo llevar este frontend a una versión significativamente mejor."**

Por lo tanto:

- una implementación correcta puede tener una UX mejorable;
- una UX buena puede tener una arquitectura mejorable;
- una arquitectura correcta puede tener componentes duplicados;
- una pantalla funcional puede necesitar una mejor organización;
- un flujo financiero seguro puede tener una presentación superior.

Todo eso debe detectarse.

Pero también:

> **Una mejora visual nunca debe romper una regla de negocio.**

La meta final es llevar el frontend desde su estado actual a una versión:

**más profesional + más clara + más rápida + más intuitiva + más consistente + más accesible + más responsive + más mantenible + más segura para operar.**

No quiero que el resultado sea simplemente "cumplir la documentación".

Quiero que el resultado sea:

> **la mejor versión posible del frontend, utilizando la documentación, los mockups y el código existente como punto de partida.**

---

# 43. INSTRUCCIÓN DE CIERRE

Recuerda:

### EN ESTA ETAPA NO PROGRAMES.

Primero entrega:

**AUDITORÍA COMPLETA → DIAGNÓSTICO → ARQUITECTURA OBJETIVO → PLAN DE ACCIÓN**

Después de que el plan sea revisado y aprobado se iniciará la implementación por fases.

No tomes decisiones de producto importantes silenciosamente.

Cuando una decisión afecte arquitectura, flujo financiero, permisos o estructura de módulos:

**márcala claramente como DECISIÓN PENDIENTE.**

Tu trabajo ahora es construir la hoja de ruta más precisa posible para transformar el frontend actual en una versión de nivel profesional.