# ESPECIFICACIÓN UI/UX — SISTEMA DE GESTIÓN INMOBILIARIA
## Inversiones Tamara & Saenz S. E. N. C.

**Versión:** 1.0  
**Propósito:** definir página por página el frontend, sus componentes, comportamiento, acciones, estados y criterios de experiencia de usuario.

## 1. Objetivo

Esta especificación convierte la propuesta visual y funcional del frontend en una guía concreta para diseño e implementación.

El sistema es una herramienta interna para administrar inmuebles, propietarios, clientes, codeudores, contratos, obligaciones, recaudo, cartera, novedades, gastos, depósitos, caja, transferencias, reportes, usuarios, configuración y auditoría.

La interfaz debe priorizar:

1. claridad operativa;
2. control financiero;
3. trazabilidad;
4. reducción de errores;
5. rapidez;
6. coherencia;
7. permisos y seguridad.

Las reglas de negocio establecen, entre otros puntos, que los contratos utilizan ACTIVO/TERMINADO, que la reactivación es una operación controlada y que el dinero se aplica Canon → Novedad → Mora. También separan recaudo, caja y transferencias.

---

# 2. Principios generales de UX

## 2.1 Una acción debe tener una consecuencia visible

En operaciones importantes mostrar:

- qué se está haciendo;
- monto;
- concepto;
- cómo se aplicará;
- saldo posterior;
- medio;
- resultado.

## 2.2 Operaciones financieras con confirmación

Patrón:

**Datos → revisión → confirmación → resultado**

## 2.3 El frontend no es la seguridad

La UI debe ocultar o deshabilitar acciones no permitidas, pero la autorización real debe verificarse en backend.

## 2.4 Tabla para localizar; detalle para comprender

Listados: búsqueda, filtros, orden y acciones.

Detalles: contexto, información completa, historial y acciones.

## 2.5 No mezclar conceptos financieros

Distinguir visualmente:

- recaudo;
- caja;
- transferencias;
- obligaciones;
- aplicaciones;
- devoluciones.

---

# 3. Identidad visual

## 3.1 Marca

Usar el lenguaje del logo de Inversiones Tamara & Saenz.

## 3.2 Paleta

**Primario:** dorado/mostaza de la marca.  
**Navegación:** gris carbón/azul muy oscuro.  
**Fondos:** blanco y gris muy claro.

### Estados

- Verde: ACTIVO, PAGADA, disponible, éxito.
- Amarillo: PENDIENTE, advertencia, revisión.
- Rojo: error, ANULADA, acciones destructivas, diferencias críticas.
- Gris: TERMINADO, histórico.

Los colores nunca deben ser la única forma de identificar un estado.

---

# 4. Layout global

En escritorio:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Breadcrumb / título                              Usuario / perfil   │
├───────────────┬─────────────────────────────────────────────────────┤
│ Sidebar       │                                                     │
│               │                    CONTENIDO                        │
│ Inicio        │                                                     │
│ Inmuebles     │                                                     │
│ Propietarios  │                                                     │
│ Contratos     │                                                     │
│ Clientes      │                                                     │
│ Obligaciones  │                                                     │
│ Novedades     │                                                     │
│               │                                                     │
│ Recaudo       │                                                     │
│ Cartera       │                                                     │
│ Gastos        │                                                     │
│ Depósitos     │                                                     │
│ Caja          │                                                     │
│ Transferencias│                                                     │
│               │                                                     │
│ Reportes      │                                                     │
│ Auditoría     │                                                     │
│ Usuarios      │                                                     │
│ Configuración │                                                     │
└───────────────┴─────────────────────────────────────────────────────┘
```

El sidebar debe ser fijo en escritorio y drawer en móvil.

---

# 5. Navegación

## Inicio
- Dashboard

## Operación
- Inmuebles
- Propietarios
- Contratos
- Clientes
- Obligaciones
- Novedades

## Finanzas
- Recaudo
- Cartera
- Gastos
- Depósitos
- Caja
- Transferencias

## Control
- Reportes
- Auditoría

## Administración
- Usuarios
- Configuración

---

# 6. Página 01 — Login

### Objetivo
Acceso al sistema interno.

### Componentes
- logo;
- usuario/email;
- contraseña;
- Ingresar;
- mensajes de error.

### Estados
- cargando;
- error;
- sesión expirada;
- éxito.

No mostrar información técnica interna.

---

# 7. Página 02 — Dashboard / Inicio

### Objetivo
Responder: **¿Cómo está el negocio hoy?**

### Indicadores principales
- Contratos activos.
- Cartera.
- Recaudo del período.
- Caja.

### Indicadores secundarios
- obligaciones pendientes;
- obligaciones parciales;
- novedades pendientes;
- gastos aprobados pendientes de pago.

### Visualizaciones
- ingresos vs egresos;
- cartera por antigüedad: 0–30, 31–60, 61–90, +90.

### Acciones rápidas
- Nuevo contrato.
- Nuevo cliente.
- Nuevo inmueble.
- Registrar recaudo.
- Registrar novedad.
- Registrar gasto.

### Alertas
Solo alertas accionables:
- obligaciones vencidas;
- novedades pendientes;
- gastos aprobados pendientes de pago;
- operaciones que requieren revisión.

Las tarjetas deben ser accionables, no decorativas.

---

# 8. Página 03 — Listado de Inmuebles

### Encabezado
**Inmuebles** + **Nuevo inmueble**

### Filtros
- búsqueda;
- estado;
- propietario;
- tipo.

### Tabla
Código | Dirección | Propietario | Tipo | Estado | Contrato | Acciones

### Acciones
- Ver;
- Editar;
- Ver contrato.

No ofrecer un cambio manual de "ocupado/disponible" cuando ese estado dependa del contrato.

---

# 9. Página 04 — Detalle de Inmueble

### Tabs
- Información;
- Propietario;
- Contrato;
- Historial.

### Información
Dirección, tipo, características, descripción y datos relevantes.

### Propietario
Mostrar la entidad propietaria actual.

### Contrato
Mostrar contrato activo, cliente y fechas cuando exista.

### Historial
Historial de ocupación y cambios relevantes.

---

# 10. Página 05 — Listado de Propietarios

### Tabla
Nombre | Documento | Teléfono | Correo | Inmuebles | Estado | Acciones

### Registro especial
**INMOBILIARIA** debe identificarse como propietario interno.

### No incluir
- comisión;
- liquidación;
- cuentas por pagar.

---

# 11. Página 06 — Detalle de Propietario

### Tabs
- Información;
- Inmuebles;
- Historial.

Mostrar datos de contacto y todos los inmuebles asociados.

---

# 12. Página 07 — Listado de Clientes

### Tabla
Nombre | Tipo | Identificación | Teléfono | Contratos | Cartera | Estado | Acciones

### Acciones
- Ver;
- Editar;
- Crear contrato;
- Ir a cartera/recaudo cuando exista saldo.

---

# 13. Página 08 — Detalle de Cliente

### Tabs
- Información;
- Codeudores;
- Contratos;
- Obligaciones;
- Recaudo;
- Historial.

### Resumen financiero
Cuando corresponda:
- saldo total;
- obligaciones pendientes;
- obligaciones parciales.

No crear un segundo motor financiero dentro del detalle.

---

# 14. Página 09 — Codeudores

Los codeudores deben gestionarse principalmente dentro del contexto del cliente.

### Datos
- nombre;
- documento;
- teléfono;
- correo;
- relación.

Acciones:
- agregar;
- editar;
- retirar relación.

---

# 15. Página 10 — Listado de Contratos

### Tabla
Código | Cliente | Inmueble | Inicio | Fin | Canon | Estado | Acciones

### Estados
- ACTIVO;
- TERMINADO.

No usar estados adicionales de negocio.

### Filtros
- búsqueda;
- estado;
- cliente;
- inmueble;
- fechas.

---

# 16. Página 11 — Crear Contrato

Formulario por bloques.

### Partes
- inmueble;
- cliente;
- codeudor.

### Fechas
- fecha inicio;
- fecha de pago del canon.

Si no se define una fecha de pago diferente, usar fecha de inicio.

### Canon
- valor;
- periodicidad.

### Depósito
- valor.

### Mora
- días de gracia;
- porcentaje mensual.

### Vista previa
Mostrar antes de guardar:
- inmueble;
- cliente;
- canon;
- inicio;
- pago;
- depósito;
- mora.

---

# 17. Página 12 — Detalle de Contrato

### Encabezado
Contrato + cliente + inmueble + estado.

### Acciones según estado

ACTIVO:
- Registrar recaudo;
- Registrar novedad;
- Terminar contrato.

TERMINADO:
- Ver obligaciones;
- Ver historial;
- Reactivar contrato.

### Tabs
- Resumen;
- Canon y fechas;
- Depósito;
- Obligaciones;
- Recaudo;
- Historial.

---

# 18. Modal — Terminar Contrato

Mostrar una advertencia clara:

> El inmueble será liberado. Las obligaciones pendientes permanecerán cobrables.

Campos:
- fecha de terminación;
- confirmación.

Resultado:
- contrato terminado;
- inmueble liberado;
- saldo pendiente conservado.

---

# 19. Modal — Reactivar Contrato

Visible solamente para Administrador.

Campos:
- motivo obligatorio.

Confirmación:

> La reactivación volverá a ocupar el inmueble y quedará registrada en auditoría.

Acciones:
- Cancelar;
- Reactivar.

---

# 20. Página 13 — Listado de Obligaciones

### Tabla
Código | Contrato | Cliente | Concepto | Período | Vencimiento | Total | Saldo | Estado

### Estados
- PENDIENTE;
- PARCIAL;
- PAGADA;
- ANULADA.

### Filtros
- búsqueda;
- estado;
- concepto;
- período;
- vencimiento;
- cliente/contrato.

---

# 21. Página 14 — Detalle de Obligación

### Resumen
- concepto;
- período;
- vencimiento;
- total;
- abonado;
- saldo;
- estado.

### Aplicaciones
Recibo | Fecha | Valor | Concepto | Usuario

### Historial
Cambios, reversos y movimientos relacionados.

Acción principal:
**Registrar recaudo**, cuando corresponda.

No ofrecer una edición directa del saldo.

---

# 22. Página 15 — Recaudo

Esta es una pantalla operativa de alta prioridad.

### Paso 1
Seleccionar cliente y contrato.

### Paso 2
Mostrar deuda:
- Canon;
- Novedad;
- Mora;
- saldo total.

### Paso 3
Ingresar:
- valor recibido;
- medio;
- referencia si transferencia.

### Paso 4 — Vista previa

```text
DINERO RECIBIDO   $500.000

APLICACIÓN
Canon             $400.000
Novedad           $100.000
Mora                    $0

Cambio                  $0
```

La aplicación debe respetar:

**Canon → Novedad → Mora**

### Paso 5
Confirmar.

### Paso 6
Mostrar:
- recibo;
- aplicación;
- saldo posterior;
- impacto en caja o transferencias.

---

# 23. Página 16 — Recibo

### Encabezado
RECIBO DE CAJA

Mostrar:
- número;
- fecha;
- cliente;
- contrato;
- inmueble;
- detalle;
- total;
- medio;
- referencia de transferencia;
- saldo posterior.

### Tabla
Concepto | Período | Valor aplicado | Mora | Total

No mostrar como información principal UUID, IDs técnicos u otra trazabilidad interna.

---

# 24. Página 17 — Cartera

Cartera es una vista operativa y no un motor financiero separado.

### Resumen
- cartera total;
- 0–30;
- 31–60;
- 61–90;
- +90.

### Tabla
Cliente | Contrato | Saldo | Vencimiento | Días mora | Acciones

### Acción principal
**Ver / Recaudar**

Flujo:

**Cartera → Cliente/Contrato → Obligaciones → Recaudo**

---

# 25. Página 18 — Novedades

### Tabla
Fecha | Cliente/Inmueble | Descripción | Tipo | Estado | Acciones

### Estado
PENDIENTE.

### Detalle
- descripción;
- inmueble;
- cliente;
- fecha;
- usuario;
- estado;
- historial.

---

# 26. Página 19 — Resolver Novedad

Solo Administrador cuando corresponda.

### Decisión
**¿Qué debe ocurrir con esta novedad?**

Opciones:

#### Cargo al cliente
- concepto;
- valor;
- preview de obligación.

#### Gasto de inmobiliaria
- concepto;
- valor aprobado;
- estado posterior: **APROBADO — PENDIENTE DE PAGO**.

Nunca mostrar "Pagado" al aprobar.

---

# 27. Página 20 — Gastos

### Tabla
Código | Fecha | Concepto | Origen | Valor | Estado | Medio | Acciones

### Estados
- Pendiente;
- Aprobado;
- Pagado.

---

# 28. Página 21 — Detalle de Gasto

Mostrar:
- concepto;
- origen;
- valor;
- estado;
- fecha aprobación;
- pago.

Si está aprobado:

**Registrar pago**

### Pago
- efectivo;
- transferencia;
- referencia si aplica.

Solo el pago real genera impacto financiero.

---

# 29. Página 22 — Depósitos

### Tabla
Contrato | Cliente | Valor recibido | Saldo | Estado | Acciones

La interfaz debe reflejar el flujo:

**Depósito recibido → saldo → liquidación → descuentos → devolución**

---

# 30. Página 23 — Liquidación de Depósito

### Resumen
- valor recibido;
- descuentos;
- saldo a devolver.

### Descuentos

Cada fila:
- concepto;
- motivo;
- valor.

### Devolución
- efectivo;
- transferencia.

### Confirmación
Mostrar claramente el impacto financiero.

---

# 31. Página 24 — Caja

### Resumen
- saldo inicial;
- ingresos;
- egresos;
- devoluciones;
- saldo esperado.

### Movimientos
Fecha | Tipo | Concepto | Monto | Usuario

### Cierre
Mostrar:

```text
Saldo esperado: $X
Efectivo contado: [________]
Diferencia: $X
```

Si existe diferencia, solicitar observación y confirmación.

No crear un módulo independiente de "cambios de caja".

---

# 32. Página 25 — Transferencias

### Resumen
- saldo/control;
- ingresos;
- egresos;
- devoluciones.

### Tabla
Fecha | Referencia | Tipo | Concepto | Monto | Usuario

Mostrar explícitamente que estas operaciones no modifican caja física.

---

# 33. Página 26 — Reportes

Usar un catálogo de tarjetas compactas:

- Recaudo por período;
- Cartera detallada;
- Obligaciones;
- Movimiento de caja;
- Transferencias;
- Novedades;
- Gastos;
- Contratos.

Cada tarjeta:
**Abrir reporte**

---

# 34. Página 27 — Reporte

### Encabezado
- nombre;
- descripción;
- rango.

### Filtros
Según reporte.

### Tabla
- encabezado fijo;
- búsqueda;
- filtros;
- orden;
- paginación;
- totales.

### Acción
**Exportar Excel**

---

# 35. Página 28 — Usuarios

### Tabla
Nombre | Usuario | Rol | Estado | Último acceso | Acciones

Acciones:
- crear;
- editar;
- activar/desactivar;
- ver detalle.

---

# 36. Página 29 — Detalle de Usuario

Mostrar:
- nombre;
- usuario;
- rol;
- estado;
- permisos efectivos;
- actividad relevante.

La interfaz no debe prometer permisos que el backend no otorgue.

---

# 37. Página 30 — Configuración

Secciones:

### Empresa
Datos de la inmobiliaria.

### Parámetros financieros
- porcentaje de mora;
- días de gracia.

### Preferencias
Solo funcionalidades realmente soportadas.

### Usuarios
Acceso al módulo de usuarios.

---

# 38. Página 31 — Auditoría

Solo para Administrador.

### Tabla
Fecha | Usuario | Módulo | Acción | Registro | Motivo

### Filtros
- usuario;
- módulo;
- fecha;
- tipo.

### Detalle
Mostrar:
- valor anterior;
- valor nuevo;
- motivo;
- usuario;
- fecha/hora;
- entidad;
- relación con la operación financiera.

---

# 39. Estados globales de UI

Todas las páginas deben manejar:

## Loading
Skeletons. Evitar bloquear toda la aplicación.

## Empty
Mensaje humano + acción útil cuando exista.

## Error
Mensaje comprensible + Reintentar.

## Success
Confirmación breve y visible.

---

# 40. Tablas

Todas las tablas deben compartir:

- búsqueda;
- filtros;
- orden;
- paginación;
- loading;
- vacío;
- error;
- acciones.

Las acciones principales deben estar visibles. Evitar menús de tres puntos innecesarios.

---

# 41. Formularios

Principios:

- etiquetas visibles;
- ayuda contextual;
- validación cercana;
- fechas consistentes;
- dinero con formato consistente.

### Campos condicionales

Si medio = Transferencia:
- mostrar Referencia.

Si medio = Efectivo:
- no pedir referencia.

---

# 42. Acciones destructivas

Antes de:

- anular;
- terminar;
- devolver;
- corregir;

mostrar:

1. operación;
2. impacto;
3. motivo requerido;
4. confirmación.

---

# 43. Responsive

## Escritorio
Prioridad principal; sidebar fijo y tablas amplias.

## Tablet
Sidebar compacto y columnas esenciales.

## Móvil
Priorizar:
- búsqueda;
- acciones;
- información esencial.

Las tablas pueden convertirse en tarjetas.

---

# 44. Accesibilidad

Mínimo:

- contraste;
- foco visible;
- teclado;
- labels;
- errores asociados;
- botones comprensibles;
- estados no dependientes solo de color.

---

# 45. Componentes reutilizables

Propuesta de biblioteca interna:

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

---

# 46. Componente MoneyValue

Debe mostrar moneda con formato consistente:

`$1.350.000`

Variantes:
- normal;
- positivo;
- negativo;
- total;
- saldo.

---

# 47. Componente StatusBadge

Debe soportar:

- ACTIVO;
- TERMINADO;
- PENDIENTE;
- PARCIAL;
- PAGADA;
- ANULADA;
- APROBADO;
- PAGADO.

Siempre texto + color.

---

# 48. Componente OperationSummary

Reutilizar en operaciones financieras:

- cliente;
- contrato;
- monto recibido;
- aplicación;
- medio;
- impacto;
- saldo posterior.

---

# 49. Componente AuditTimeline

Ejemplo:

```text
21/08/2026 14:33
Administrador

Modificó valor

Antes: $500.000
Después: $450.000

Motivo:
Error de digitación
```

---

# 50. Búsquedas

Permitir localizar por:

- nombre;
- documento;
- código;
- contrato;
- inmueble;
- referencia.

Las búsquedas financieras deben identificar claramente la entidad encontrada.

---

# 51. Errores financieros

Un error financiero debe ser muy visible.

Ejemplo:

> No fue posible registrar el recaudo. Ningún dato financiero ha sido modificado.

Cuando la arquitectura realmente lo garantice, ese mensaje debe reflejar la garantía transaccional.

---

# 52. Confirmación financiera

Patrón global:

```text
CONFIRMAR OPERACIÓN

Recibido: $500.000
Medio: EFECTIVO

Aplicación:
Canon      $400.000
Novedad    $100.000
Mora              $0

Cambio             $0

[Cancelar] [Confirmar]
```

---

# 53. Reglas de visualización de dinero

Cada pantalla que muestre dinero debe responder:

- cuánto;
- concepto;
- obligación afectada;
- medio;
- impacto;
- saldo;
- usuario.

La trazabilidad técnica completa puede quedar en Auditoría, pero el contexto financiero esencial debe ser visible durante la operación.

---

# 54. Menú según rol

## Administrador
Acceso a todos los módulos permitidos por el sistema.

## Recepcionista
Acceso principalmente a:
- Inicio;
- Inmuebles;
- Propietarios;
- Contratos;
- Clientes;
- consulta de obligaciones;
- Novedades;
- demás acciones expresamente permitidas.

La visibilidad de UI no sustituye autorización backend.

---

# 55. Orden recomendado de diseño

## Fase 1 — Sistema visual
1. Layout.
2. Sidebar.
3. Header.
4. Tipografía.
5. Colores.
6. Badges.
7. Tablas.
8. Formularios.
9. Modales.

## Fase 2 — Operación
10. Dashboard.
11. Inmuebles.
12. Clientes.
13. Contratos.
14. Novedades.

## Fase 3 — Finanzas
15. Obligaciones.
16. Recaudo.
17. Recibo.
18. Cartera.
19. Gastos.
20. Depósitos.
21. Caja.
22. Transferencias.

## Fase 4 — Control
23. Reportes.
24. Auditoría.

## Fase 5 — Administración
25. Usuarios.
26. Configuración.

---

# 56. Criterios de aceptación por página

Una página se considera terminada cuando:

- respeta el layout global;
- respeta permisos;
- tiene loading;
- tiene empty state;
- tiene error state;
- valida formularios;
- utiliza estados correctos;
- usa componentes reutilizables;
- es responsive;
- no duplica lógica financiera;
- no inventa estados;
- tiene acciones claras;
- confirma operaciones sensibles;
- mantiene trazabilidad cuando corresponde.

---

# 57. Criterios de aceptación financiera

Una operación financiera se considera terminada cuando:

- muestra monto;
- muestra concepto;
- muestra medio;
- muestra aplicación;
- muestra saldo posterior;
- respeta las reglas;
- confirma antes de ejecutar;
- informa resultado;
- actualiza la vista;
- bloquea operaciones inválidas;
- actualiza caja o transferencias correctamente;
- conserva trazabilidad.

---

# 58. Principio final

El frontend debe sentirse así:

> **“Sé dónde estoy, sé qué estoy viendo, sé cuánto dinero está involucrado, sé qué ocurrirá antes de confirmar y puedo rastrear lo que sucedió.”**

No debe sentirse como un ERP genérico ni como un dashboard saturado.

Debe ser una herramienta administrativa profesional, rápida, clara y confiable, con especial énfasis en contratos, obligaciones, recaudo, caja y trazabilidad.
