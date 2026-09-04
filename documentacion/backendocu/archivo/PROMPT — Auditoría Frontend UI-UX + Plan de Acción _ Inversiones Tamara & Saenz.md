# AUDITORÍA PROFESIONAL DEL FRONTEND Y PLAN DE ACCIÓN
## Inversiones Tamara & Saenz S. E. N. C.

Actúa como **Frontend Senior + UI/UX Senior + Auditor de producto digital**, especializado en aplicaciones administrativas, financieras y sistemas internos empresariales.

## IMPORTANTE

**NO comiences modificando código.**

**NO rediseñes todavía.**

**NO reemplaces componentes.**

**NO hagas una migración masiva.**

La primera etapa de este trabajo es exclusivamente:

> **AUDITAR → COMPARAR → DETECTAR → PRIORIZAR → PLANIFICAR**

Después de terminar la auditoría quiero un **plan de acción técnico y visual claro**, ordenado por prioridad, para posteriormente ejecutar los cambios de manera segura.

---

# 1. MATERIAL QUE DEBES ANALIZAR

Te voy a proporcionar:

1. El frontend actual del sistema.
2. La especificación UI/UX página por página.
3. Las posibles vistas/mockups de referencia.
4. El logo ya incorporado actualmente en el frontend.

## REGLA

El logo **ya está implementado**.

No debes proponer volver a incorporarlo ni reconstruir la identidad de marca desde cero.

Tu trabajo es determinar si el frontend actual utiliza correctamente esa identidad visual y si está alineado con la especificación.

La documentación define que la interfaz debe priorizar claridad operativa, control financiero, trazabilidad, reducción de errores, rapidez, coherencia y permisos.

---

# 2. OBJETIVO DE LA AUDITORÍA

Quiero saber exactamente:

### A. Qué está bien

Qué partes del frontend actual:

- cumplen las especificaciones;
- tienen buena UX;
- son reutilizables;
- están bien estructuradas;
- no deberían tocarse.

### B. Qué está mal

Detecta:

- inconsistencias visuales;
- inconsistencias de navegación;
- componentes duplicados;
- pantallas incompletas;
- acciones incorrectas;
- acciones faltantes;
- estados faltantes;
- permisos mal reflejados;
- tablas deficientes;
- formularios inconsistentes;
- problemas responsive;
- problemas de accesibilidad;
- problemas de jerarquía visual;
- exceso de elementos;
- componentes que contradicen la especificación.

### C. Qué falta

Identifica funcionalidades o elementos visuales definidos en la especificación que todavía no existen en el frontend.

### D. Qué está implementado pero debería cambiarse

No asumas que porque algo existe está correcto.

Comprueba:

- comportamiento;
- ubicación;
- acción;
- estado;
- jerarquía;
- consistencia;
- responsive;
- permisos.

### E. Qué NO debe tocarse

Identifica explícitamente aquello que funciona correctamente y que no necesita modificación.

Esto es importante porque NO quiero una reescritura innecesaria.

---

# 3. COMPARACIÓN QUE DEBES HACER

Debes comparar tres fuentes:

### FUENTE 1
Frontend actual.

### FUENTE 2
Especificación UI/UX.

### FUENTE 3
Posibles vistas/mockups.

La comparación debe determinar:

**ACTUAL → ESPECIFICACIÓN → REFERENCIA → DIFERENCIA → ACCIÓN**

No copies literalmente las vistas.

Las vistas son una **referencia de intención visual y estructura**, mientras que la especificación define la funcionalidad y comportamiento esperado.

---

# 4. AUDITORÍA DE ARQUITECTURA FRONTEND

Antes de evaluar pantallas, analiza la arquitectura actual.

Revisa:

- estructura de carpetas;
- rutas;
- layouts;
- componentes globales;
- componentes compartidos;
- hooks;
- servicios;
- manejo de estado;
- manejo de formularios;
- manejo de errores;
- loading;
- tablas;
- modales;
- dialogs;
- badges;
- inputs monetarios;
- manejo de fechas;
- permisos;
- responsive;
- sistema de estilos;
- duplicaciones.

Determina:

### REUTILIZABLE

Qué está bien diseñado.

### DUPLICADO

Qué existe varias veces y debería centralizarse.

### INCONSISTENTE

Qué hace lo mismo pero visualmente se comporta diferente.

### FRÁGIL

Qué podría provocar problemas futuros.

### RIESGOSO

Qué podría afectar operaciones sensibles.

---

# 5. AUDITORÍA VISUAL

Evalúa el frontend actual contra la referencia visual.

Analiza:

## Layout

- sidebar;
- header;
- ancho de contenido;
- espaciado;
- alineación;
- jerarquía.

## Tipografía

- tamaños;
- pesos;
- jerarquía;
- legibilidad.

## Colores

Comprobar que el sistema utilice correctamente la identidad existente.

La especificación define:

- dorado/mostaza como primario;
- navegación oscura;
- blanco/gris claro como superficies;
- verde, amarillo, rojo y gris para estados.

## Componentes

Auditar:

- botones;
- inputs;
- selects;
- badges;
- cards;
- tablas;
- tabs;
- modales;
- alertas;
- tooltips.

## Densidad visual

Determinar si existe:

- exceso de tarjetas;
- exceso de información;
- espacios desperdiciados;
- botones innecesarios;
- saturación visual.

---

# 6. AUDITORÍA DE NAVEGACIÓN

Comprueba que la navegación real corresponda con la navegación definida.

Debe contemplarse:

## INICIO

Dashboard

## OPERACIÓN

- Inmuebles
- Propietarios
- Contratos
- Clientes
- Obligaciones
- Novedades

## FINANZAS

- Recaudo
- Cartera
- Gastos
- Depósitos
- Caja
- Transferencias

## CONTROL

- Reportes
- Auditoría

## ADMINISTRACIÓN

- Usuarios
- Configuración

La especificación establece esta separación de módulos.

Determina:

- faltantes;
- sobrantes;
- nombres inconsistentes;
- rutas incorrectas;
- módulos mal agrupados;
- navegación redundante;
- navegación confusa.

---

# 7. AUDITORÍA PÁGINA POR PÁGINA

Para cada pantalla existente, realiza una auditoría individual.

Utiliza esta estructura:

## PÁGINA: [nombre]

### Estado actual
Describe qué existe actualmente.

### Cumplimiento
- Cumple
- Cumple parcialmente
- No cumple

### Problemas encontrados
Lista cada problema.

### Elementos faltantes
Lista lo que debería existir y no existe.

### Elementos incorrectos
Lista lo que existe pero está mal implementado.

### UX
Evalúa:

- claridad;
- facilidad;
- flujo;
- feedback;
- errores;
- acciones.

### UI
Evalúa:

- jerarquía;
- espaciado;
- consistencia;
- componentes;
- colores;
- tipografía.

### Responsive
Evalúa:

- desktop;
- tablet;
- móvil.

### Permisos
Evalúa si las acciones corresponden al rol.

### Recomendación
Indica exactamente qué debe hacerse.

### Prioridad
Clasificar como:

P0 — Crítico
P1 — Alto
P2 — Medio
P3 — Bajo

---

# 8. AUDITA ESPECIALMENTE LAS OPERACIONES FINANCIERAS

Estas pantallas deben recibir un nivel de auditoría superior:

- Obligaciones;
- Recaudo;
- Recibo;
- Cartera;
- Gastos;
- Depósitos;
- Caja;
- Transferencias.

La especificación define que las operaciones financieras importantes deben seguir:

**Datos → revisión → confirmación → resultado**.

Comprueba si el frontend actual realmente sigue ese patrón.

---

# 9. AUDITORÍA DEL RECAUDO

Revisar específicamente:

1. selección de cliente;
2. selección de contrato;
3. obligaciones;
4. valor recibido;
5. medio de pago;
6. referencia;
7. aplicación;
8. preview;
9. confirmación;
10. resultado;
11. recibo;
12. saldo posterior;
13. impacto financiero.

La aplicación debe mostrar claramente el orden:

**Canon → Novedad → Mora**.

Si el frontend actual hace algo diferente, marcarlo como diferencia crítica.

---

# 10. AUDITORÍA DE ESTADOS

Verifica que los estados visuales y funcionales coincidan con los definidos.

Por ejemplo:

CONTRATOS:

- ACTIVO
- TERMINADO

OBLIGACIONES:

- PENDIENTE
- PARCIAL
- PAGADA
- ANULADA

GASTOS:

- PENDIENTE
- APROBADO
- PAGADO

No inventar estados adicionales.

La especificación explícitamente indica que no deben inventarse estados de negocio.

---

# 11. AUDITORÍA DE ACCIONES

Esta parte es MUY importante.

Comprueba las acciones por fila y por estado.

No basta con verificar que exista una columna "Acciones".

Hay que comprobar que aparezcan únicamente las acciones válidas.

Por ejemplo:

### Contrato ACTIVO

- Ver
- Registrar recaudo
- Registrar novedad
- Terminar

### Contrato TERMINADO

- Ver
- Reactivar
- Historial

### Obligación

Las acciones deben depender de:

- PENDIENTE;
- PARCIAL;
- PAGADA;
- ANULADA.

También revisar que NO exista un botón genérico "Eliminar" donde el negocio exige trazabilidad.

La documentación existente ya identifica esta necesidad y señala que las acciones deben depender del estado del registro.

---

# 12. AUDITORÍA DE COMPONENTES

Identifica componentes que deberían ser globales.

Por ejemplo:

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
- AuditTimeline;
- EmptyState;
- ErrorState;
- SkeletonTable;
- FormSection;
- MoneyInput;
- DateInput;
- ReferenceInput;
- ExportButton.

No necesariamente tienes que crear estos nombres exactos.

Lo importante es determinar si el concepto ya existe y si está correctamente reutilizado.

---

# 13. AUDITORÍA DE RESPONSIVE

No asumir que responsive = "la pantalla se hace pequeña".

Comprobar realmente:

### Desktop

- sidebar;
- tablas;
- formularios;
- acciones.

### Tablet

- densidad;
- navegación;
- columnas.

### Mobile

- menú;
- tablas;
- formularios;
- acciones;
- modales;
- dinero;
- lectura.

Indicar problemas concretos.

---

# 14. AUDITORÍA DE ACCESIBILIDAD

Comprobar:

- contraste;
- foco;
- teclado;
- labels;
- botones;
- errores;
- estados;
- lectura.

Verificar que un estado no dependa únicamente del color.

---

# 15. AUDITORÍA DE UX

Evaluar cada flujo con estas preguntas:

### ¿El usuario sabe dónde está?

### ¿Sabe qué está viendo?

### ¿Sabe qué puede hacer?

### ¿Sabe qué ocurrirá si pulsa el botón?

### ¿Puede cometer un error fácilmente?

### ¿El sistema le muestra feedback?

### ¿Puede recuperarse de un error?

### ¿Puede rastrear lo que ocurrió?

---

# 16. CLASIFICACIÓN DE HALLAZGOS

Utiliza:

## P0 — CRÍTICO

Puede causar:

- error financiero;
- pérdida de información;
- operación incorrecta;
- violación grave de permisos;
- pérdida de trazabilidad.

Debe corregirse antes de seguir.

## P1 — ALTO

Afecta significativamente:

- operación;
- UX;
- navegación;
- consistencia;
- funcionalidad.

## P2 — MEDIO

Mejora:

- calidad;
- consistencia;
- comodidad;
- mantenibilidad.

## P3 — BAJO

Detalles visuales o mejoras futuras.

---

# 17. MATRIZ FINAL DE AUDITORÍA

Al finalizar crea una matriz como:

| Módulo | Problema | Tipo | Severidad | Impacto | Acción recomendada |
|---|---|---|---|---|---|

Y otra:

| Módulo | Cumplimiento | Faltantes | Incorrectos | Prioridad |
|---|---|---|---|---|

---

# 18. PLAN DE ACCIÓN

Después de auditar NO empieces a programar.

Primero crea un plan de acción.

Debe estar dividido:

## FASE 0 — Preparación

- correcciones estructurales;
- componentes globales;
- tokens;
- estilos;
- navegación;
- patrones.

## FASE 1 — Correcciones críticas

P0.

## FASE 2 — Correcciones de operación

P1.

## FASE 3 — Finanzas

P1/P2.

## FASE 4 — Consistencia visual

P2.

## FASE 5 — Responsive y accesibilidad

P2/P3.

## FASE 6 — Pulido final

P3.

---

# 19. CADA ACCIÓN DEL PLAN DEBE INDICAR

Para cada cambio:

### Qué
Qué debe modificarse.

### Por qué
Por qué es necesario.

### Dónde
Qué archivo/componente/módulo probablemente afecta.

### Impacto
Qué puede verse afectado.

### Prioridad
P0/P1/P2/P3.

### Dependencias
Qué debe hacerse antes.

### Riesgo
Bajo / Medio / Alto.

### Validación
Cómo comprobar que quedó correctamente.

---

# 20. ORDEN DE EJECUCIÓN

No quiero un plan basado simplemente en el orden de las páginas.

El orden debe considerar dependencias.

Por ejemplo:

Primero:

- arquitectura compartida;
- layout;
- navegación;
- componentes globales;
- sistema visual.

Después:

- listados;
- detalles.

Después:

- operaciones financieras.

Después:

- reportes;
- auditoría;
- administración.

---

# 21. REGLA MUY IMPORTANTE

NO propongas reescribir una pantalla completa simplemente porque su diseño podría ser más bonito.

Primero determina:

- qué funciona;
- qué está correcto;
- qué necesita corrección;
- qué falta.

La prioridad es **mejorar lo existente**, no reemplazarlo sin necesidad.

---

# 22. NO TOCAR SIN JUSTIFICACIÓN

Durante la auditoría identifica explícitamente:

- archivos que funcionan;
- componentes correctos;
- lógica correcta;
- integraciones correctas;
- funcionalidades que deben conservarse.

La meta es reducir riesgo.

---

# 23. RESULTADO FINAL QUE QUIERO RECIBIR

No quiero código todavía.

Quiero recibir un documento de auditoría con esta estructura:

# 1. Resumen ejecutivo

¿Qué tan cerca está el frontend actual del objetivo?

# 2. Estado general

- UI
- UX
- Arquitectura
- Responsive
- Finanzas
- Permisos
- Accesibilidad

# 3. Hallazgos críticos

P0.

# 4. Hallazgos importantes

P1.

# 5. Mejoras medias

P2.

# 6. Mejoras menores

P3.

# 7. Auditoría página por página

Cada pantalla.

# 8. Auditoría de componentes

Qué reutilizar, qué corregir y qué falta.

# 9. Auditoría de navegación

# 10. Auditoría financiera

# 11. Auditoría responsive

# 12. Auditoría de permisos

# 13. Matriz de acciones por estado

# 14. Matriz de hallazgos

# 15. Plan de acción

Ordenado por dependencias.

# 16. Riesgos

Qué NO debe tocarse sin cuidado.

# 17. Orden recomendado de implementación

Paso a paso.

# 18. Criterios de validación

Cómo sabremos que cada fase está correctamente terminada.

---

# 24. REGLA FINAL

Durante esta primera etapa:

**NO MODIFIQUES EL CÓDIGO.**

**NO CREES COMMITS.**

**NO ELIMINES ARCHIVOS.**

**NO CAMBIES LA LÓGICA.**

**NO REESCRIBAS COMPONENTES.**

Solo:

**INSPECCIONA → COMPARA → AUDITA → DOCUMENTA → PRIORIZA → PLANIFICA**

Una vez presentado y aprobado el plan de acción, podremos pasar a la implementación por fases.

El objetivo de esta auditoría es obtener una fotografía real del frontend actual y una hoja de ruta segura para llevarlo al nivel definido por las especificaciones y las vistas de referencia.