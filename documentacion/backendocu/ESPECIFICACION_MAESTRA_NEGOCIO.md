# ESPECIFICACIÓN MAESTRA DE NEGOCIO
## Sistema interno de administración y control de arrendamientos

**Documento base para auditoría técnica y funcional**

### 1. Propósito

Este documento consolida las reglas de negocio definidas para el sistema y constituye la **fuente de verdad funcional** para la siguiente auditoría del código.

El sistema es una herramienta interna para administrar arrendamientos, contratos, obligaciones, recaudo, cartera, caja, novedades y trazabilidad.

No debe interpretarse como un ERP inmobiliario completo de intermediación.

### 2. Fuera de alcance

Actualmente están fuera del alcance:

- Comisiones a propietarios.
- Liquidación al propietario.
- Cuentas por pagar al propietario.
- DIAN / IVA como módulo tributario.
- Condonación de deuda.
- Funcionalidades de intermediación inmobiliaria que no estén expresamente definidas en este documento.
- Cualquier funcionalidad detectada en auditorías históricas que no forme parte de esta definición final.

Una auditoría histórica no constituye por sí misma un requisito actual.

---

# 3. Actores y permisos

## 3.1 Administrador

El Administrador tiene control total sobre el sistema y puede ejecutar las operaciones administrativas, operativas y financieras permitidas por las reglas de negocio.

## 3.2 Recepcionista

El Recepcionista puede:

- crear clientes;
- crear codeudores;
- crear inmuebles;
- crear contratos;
- terminar contratos;
- registrar novedades.

Las acciones financieras sensibles que corresponden al Administrador deben permanecer protegidas por reglas de autorización en backend.

### Regla crítica

El sistema no debe depender del frontend para garantizar permisos. La autorización debe verificarse también en backend.

---

# 4. Propietarios

Todo inmueble debe quedar asociado a una entidad Propietario.

Se crea inicialmente un propietario especial denominado **INMOBILIARIA**, que representa los inmuebles propios de la inmobiliaria.

Relación:

**1 Propietario → N Inmuebles**

**1 Inmueble → 1 Propietario**

No existen copropietarios dentro del modelo actual.

No se implementan actualmente:

- comisión;
- liquidación al propietario;
- cuentas por pagar al propietario.

---

# 5. Inmuebles

Un inmueble pertenece a un único propietario registrado.

Reglas principales:

- Un inmueble ocupado por un contrato ACTIVO no puede aparecer disponible para otro contrato.
- Cuando el contrato termina, el inmueble queda liberado.
- La disponibilidad del inmueble debe ser consistente con el estado del contrato.

---

# 6. Contratos

## 6.1 Datos fundamentales

Un contrato relaciona como mínimo:

- inmueble;
- cliente;
- codeudor;
- fecha de inicio;
- fecha de pago del canon;
- canon;
- depósito;
- condiciones de mora;
- estado.

La fecha de inicio es obligatoria.

La fecha de pago del canon puede ser diferente de la fecha de inicio.

Si no se especifica una fecha de pago distinta, la fecha de pago del canon será igual a la fecha de inicio.

La fecha de pago del canon es la referencia para vencimiento y cálculo de mora.

## 6.2 Estados

Solo existen dos estados contractuales:

- ACTIVO
- TERMINADO

No deben existir como estados de negocio:

- INACTIVO
- SUSPENDIDO
- EN_TERMINACION
- otros estados equivalentes que dupliquen la lógica.

## 6.3 Contrato ACTIVO

Un contrato ACTIVO:

- representa un arrendamiento vigente;
- mantiene ocupado el inmueble;
- genera las obligaciones contractuales correspondientes.

## 6.4 Contrato TERMINADO

Un contrato TERMINADO:

- tiene fecha real de terminación;
- libera el inmueble;
- no genera nuevas obligaciones contractuales;
- conserva las obligaciones históricas pendientes;
- permite continuar cobrando las deudas existentes.

**Contrato terminado NO significa deuda eliminada.**

## 6.5 Terminación con deuda

Un contrato puede terminarse aunque exista saldo pendiente.

La terminación no elimina ni anula automáticamente la deuda.

La deuda continúa existiendo y puede ser cobrada.

## 6.6 Reactivación

La transición permitida es:

**TERMINADO → ACTIVO**

Condiciones:

- solamente Administrador;
- motivo obligatorio;
- trazabilidad obligatoria;
- el inmueble debe volver a quedar ocupado;
- la fecha histórica de terminación no debe desaparecer de la trazabilidad.

La reactivación no debe borrar el historial anterior.

---

# 7. Generación y obligaciones del canon

El contrato genera obligaciones contractuales de acuerdo con su periodicidad y fecha de pago definida.

La fecha de pago del canon es la referencia funcional del vencimiento.

La auditoría debe comprobar que el mecanismo real del código respete esta regla y no genere obligaciones fuera del ciclo contractual.

Cuando el código requiera interpretar un detalle de implementación que no esté expresamente definido, no debe inventarse una regla de negocio.

---

# 8. Obligaciones

## 8.1 Concepto

Una obligación representa lo que el cliente debe.

## 8.2 Estados

Flujo principal:

**PENDIENTE → PARCIAL → PAGADA**

Flujo excepcional:

**PENDIENTE → ANULADA**

## 8.3 ANULADA

Una obligación puede pasar a ANULADA únicamente cuando corresponda invalidarla según la regla definida.

La anulación:

- exige motivo;
- no borra el registro;
- no debe usarse como mecanismo para ocultar una deuda que simplemente no se desea cobrar.

Si la obligación ya tiene abonos, no debe anularse simulando que esos movimientos nunca existieron; debe utilizarse el flujo financiero de reverso correspondiente.

## 8.4 Condonación

La condonación no existe en el negocio actual.

---

# 9. Pagos y abonos

## 9.1 Separación conceptual

El sistema debe distinguir claramente:

1. **Obligación**: lo que el cliente debe.
2. **Pago recibido**: dinero realmente entregado.
3. **Aplicación del pago**: a qué obligación/concepto se destinó el dinero.
4. **Cambio**: diferencia devuelta inmediatamente cuando se recibe efectivo superior al valor aplicado.

## 9.2 Abono

Un abono:

- no crea una obligación nueva;
- afecta una obligación existente;
- puede dejarla parcialmente pagada;
- debe conservar aplicación y trazabilidad.

## 9.3 Exceso de pago en efectivo

Ejemplo conceptual:

Deuda: $450.000  
Dinero recibido: $500.000  
Aplicado: $450.000  
Cambio: $50.000

El cambio es una consecuencia de la operación de pago en efectivo.

**No constituye un módulo independiente de caja.**

---

# 10. Orden de aplicación del dinero

El orden oficial es:

**1. Canon**
**2. Novedad**
**3. Mora**

La interpretación genérica de FIFO se reemplaza por esta regla de negocio concreta.

Ejemplo:

- Canon: $400.000
- Novedad: $150.000
- Mora: $50.000
- Pago: $500.000

Resultado:

- Canon aplicado: $400.000
- Novedad aplicada: $100.000
- Mora aplicada: $0
- Novedad pendiente: $50.000
- Mora pendiente: $50.000

---

# 11. Mora

## 11.1 Referencia temporal

La secuencia es:

**Fecha de pago del canon → días de gracia → días de mora**

Los días de gracia empiezan a contar desde la fecha de pago del canon.

Ejemplo:

Fecha de pago: 10 de agosto  
Días de gracia: 5

Período de gracia:

10, 11, 12, 13 y 14

La mora inicia el:

15 de agosto.

Si el pago ocurre dentro del período de gracia, los días de mora son 0.

## 11.2 Fórmula

La fórmula definida es:

**Mora = saldo de capital pendiente × porcentaje mensual / 30 × días de mora**

La fórmula debe ser reproducible y auditable.

## 11.3 Reglas

- La mora se calcula únicamente sobre capital pendiente.
- La mora nunca genera nueva mora.
- La mora acumulada no genera mora.
- Si el porcentaje de mora es 0, la mora es 0.
- La mora debe aparecer separada del canon.
- El cálculo debe poder reconstruirse para una fecha determinada.

---

# 12. Cartera

La cartera es una **vista operativa**, no un motor financiero independiente.

Flujo:

**Cartera → seleccionar cliente/contrato → Recaudo → pago/abono → Recibo**

La fuente de verdad financiera permanece en:

- obligaciones;
- pagos/recaudos;
- aplicaciones de pago.

No deben crearse cálculos financieros paralelos e inconsistentes únicamente para la pantalla de cartera.

---

# 13. Recaudo

Flujo general:

**Pago recibido**
→ identificar medio
→ efectivo o transferencia
→ aplicar dinero
→ canon
→ novedad
→ mora
→ registrar aplicación
→ generar recibo
→ actualizar saldo
→ actualizar caja o control de transferencia.

Cada etapa debe mantener trazabilidad.

---

# 14. Efectivo y transferencias

## 14.1 Efectivo

Un ingreso en efectivo:

**aumenta caja física.**

Un egreso en efectivo:

**disminuye caja física.**

Una devolución en efectivo:

**disminuye caja física.**

## 14.2 Transferencia

Un ingreso por transferencia:

**afecta el control bancario/transferencias.**

Un egreso por transferencia:

**afecta el control bancario/transferencias.**

Una devolución por transferencia:

**disminuye el control bancario/transferencias.**

Las transferencias no modifican la caja física.

Cuando corresponda, debe conservarse la referencia o número de transacción.

## 14.3 Conceptos que no deben confundirse

**RECAUDO** = cuánto dinero recibió la inmobiliaria.

**CAJA** = cuánto efectivo físico debería existir.

**TRANSFERENCIAS/BANCO** = cuánto dinero entró o salió por medios bancarios.

Regla:

**Recaudo total = efectivo + transferencias**

pero:

**Recaudo total ≠ caja física**

---

# 15. Caja

La caja debe permitir controlar:

- saldo inicial;
- ingresos en efectivo;
- egresos en efectivo;
- devoluciones en efectivo;
- saldo esperado;
- conteo físico real;
- eventual diferencia entre saldo esperado y saldo contado.

La fórmula conceptual del saldo esperado es:

**Saldo esperado = saldo inicial + ingresos efectivo - egresos efectivo - devoluciones efectivo**

El sistema no debe crear un concepto independiente llamado “cambios de caja”.

El cambio es solamente una consecuencia de un pago en efectivo cuyo dinero recibido supera el dinero aplicado.

---

# 16. Devoluciones posteriores

Una devolución posterior es diferente de un cambio inmediato.

Una devolución posterior:

- nunca modifica ni borra el pago original;
- se registra como un nuevo movimiento financiero;
- debe estar relacionada con el movimiento original;
- debe registrar monto;
- medio;
- fecha;
- motivo;
- usuario;
- trazabilidad.

La devolución afecta únicamente el canal utilizado:

**Efectivo → disminuye caja física**

**Transferencia → disminuye control bancario/transferencias**

---

# 17. Novedades

Flujo:

**Recepcionista registra → PENDIENTE → Administrador decide**

Una novedad puede convertirse en:

### A. Cargo al cliente

Se transforma en una obligación.

### B. Gasto de la inmobiliaria

Se convierte en gasto aprobado y queda pendiente de pago.

Regla fundamental:

**APROBADO ≠ PAGADO**

El movimiento financiero aparece únicamente cuando se registra el pago real.

---

# 18. Egresos

Flujo:

**Novedad**
→ Administrador determina gasto de inmobiliaria
→ Gasto APROBADO
→ pendiente de pago
→ PAGO REAL
→ efectivo o transferencia
→ movimiento financiero.

Solamente el pago real impacta financieramente:

- efectivo → caja;
- transferencia → control bancario/transferencia.

---

# 19. Depósito

El depósito no debe convertirse automáticamente en una obligación ni en un pago gigante.

Flujo:

**Depósito recibido → saldo → liquidación → descuentos → devolución**

El Administrador determina los descuentos.

Cada descuento debe conservar:

- concepto/motivo;
- valor.

La devolución del saldo debe seguir el medio financiero correspondiente y conservar trazabilidad.

---

# 20. Recibo

El recibo debe explicar claramente cómo se aplicó el dinero.

Debe mostrar, cuando corresponda:

- concepto;
- período;
- valor aplicado;
- mora separada;
- total;
- saldo posterior;
- medio de pago;
- referencia de transferencia.

La información técnica interna como UUID, IDs internos, usuario técnico y otros datos de auditoría debe permanecer principalmente en la trazabilidad interna y no necesariamente como información visible principal del recibo.

---

# 21. Correcciones financieras

Un movimiento financiero no puede editarse silenciosamente.

Si existe una equivocación:

**Editar → motivo obligatorio → modificación → auditoría**

Debe conservarse:

- valor anterior;
- valor nuevo;
- usuario;
- fecha/hora;
- motivo;
- trazabilidad.

Nunca debe utilizarse una edición silenciosa para alterar la historia financiera.

---

# 22. Integridad financiera e invariantes

La auditoría debe verificar al menos las siguientes invariantes:

1. Un inmueble asociado a contrato ACTIVO no puede estar disponible.
2. Un contrato TERMINADO no debe generar nuevas obligaciones contractuales.
3. Terminar un contrato no elimina sus obligaciones pendientes.
4. Una obligación ANULADA no debe seguir apareciendo como deuda cobrable.
5. Una obligación con abonos no debe eliminarse como si nunca hubiera tenido movimientos.
6. Un abono no crea una nueva obligación.
7. La aplicación del dinero debe respetar Canon → Novedad → Mora.
8. La mora nunca genera nueva mora.
9. El porcentaje 0 debe producir mora 0.
10. El efectivo modifica caja.
11. La transferencia no modifica caja física.
12. Una devolución no borra el movimiento original.
13. Una aprobación de gasto no genera movimiento financiero hasta que exista pago real.
14. Toda mutación financiera debe ser trazable.
15. Las correcciones financieras requieren motivo.
16. El frontend nunca debe ser la única barrera de autorización.
17. Recaudo, caja y transferencias deben conservarse como conceptos distintos.
18. Un recibo debe reflejar la aplicación real del dinero.
19. El historial de terminación/reactivación debe conservarse.
20. Los reportes financieros definidos deben poder exportarse a XLSX.

---

# 23. Reportes y Excel

Los reportes financieros y de control definidos por el sistema deben poder exportarse a:

**.xlsx**

Deben tener estructura profesional, consistente y utilizable.

La librería técnica utilizada para generar Excel es una decisión de implementación y no debe convertirse en una regla de negocio.

---

# 24. Reglas de auditoría

La nueva auditoría debe tratar esta especificación como **fuente de verdad funcional**.

Las auditorías anteriores son histórico.

Claude Code debe:

- verificar el estado real del código actual;
- rastrear cada regla hasta su implementación;
- identificar discrepancias;
- comprobar backend y frontend;
- comprobar base de datos;
- comprobar API;
- comprobar permisos;
- comprobar estados y transiciones;
- comprobar cálculos monetarios;
- comprobar trazabilidad;
- comprobar pruebas;
- comprobar casos límite.

No debe asumir que algo está correcto porque exista un endpoint, componente, entidad o README.

No debe asumir que un hallazgo antiguo sigue vigente.

No debe implementar cambios durante la auditoría inicial.

---

# 25. Clasificación de hallazgos

Usar como mínimo:

### P0 — Riesgo crítico
Corrupción financiera, pérdida de datos, vulnerabilidad grave, operación financiera inválida con impacto material.

### P1 — Violación de regla de negocio
El código permite o produce un comportamiento contrario a esta especificación.

### P2 — Funcionalidad requerida ausente
Existe una regla de negocio que el sistema no implementa.

### P3 — Integración / UX operativa
La regla existe, pero el flujo de usuario se rompe o queda incompleto.

### P4 — Deuda técnica
Problemas de diseño, duplicación, mantenimiento, arquitectura o consistencia que no violan directamente una regla crítica.

### P5 — Mejora
Optimización, limpieza o mejora no esencial.

---

# 26. Regla contra la invención

Cuando exista una contradicción o ambigüedad que no pueda resolverse utilizando esta especificación:

**NO INVENTAR UNA REGLA DE NEGOCIO.**

Clasificarla como:

**REQUIERE_DECISION_DE_NEGOCIO**

y explicar:

- qué hace actualmente el código;
- qué interpretaciones posibles existen;
- qué partes del negocio están documentadas;
- cuál es el impacto.

---

# 27. Resultado esperado de la auditoría

La auditoría final debe producir:

1. Reconstrucción del sistema actual.
2. Matriz de entidades y relaciones.
3. Matriz de roles y permisos.
4. Matriz de estados y transiciones.
5. Matriz de invariantes financieras.
6. Mapa de flujo de dinero.
7. Discrepancias entre negocio y código.
8. Hallazgos clasificados por severidad.
9. Evidencia exacta de archivos, funciones, clases, entidades, endpoints y líneas.
10. Riesgo e impacto de cada hallazgo.
11. Dependencias entre hallazgos.
12. Criterios de aceptación.
13. Plan de acción priorizado.
14. Orden recomendado de corrección.
15. Pruebas necesarias.
16. Riesgos de regresión.
17. Lista de elementos fuera de alcance detectados.
18. Lista de decisiones de negocio que realmente requieran intervención humana.

---

# 28. Principio final

El objetivo no es “arreglar las tres auditorías”.

El objetivo es comprobar:

> **¿El código actual implementa exactamente el negocio definido en esta especificación?**

Si algo aparece como faltante en una auditoría histórica pero está fuera del alcance actual, debe clasificarse como **FUERA_DE_ALCANCE**, no como bug.

Si algo parece técnicamente mejorable pero no viola una regla, debe distinguirse de un incumplimiento funcional.

Si existe una ambigüedad real, debe señalarse y no inventarse.

**Esta especificación es la base funcional para la auditoría de segunda generación y para el plan de acción posterior.**
