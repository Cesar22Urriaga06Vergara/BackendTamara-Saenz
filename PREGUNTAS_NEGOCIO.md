# Preguntas para el dueño del negocio — Sistema de arriendos Tamara & Saenz

## Para qué es este documento

Estamos construyendo el sistema que va a manejar los arriendos, contratos, recaudo y cartera
de Inversiones Tamara & Saenz. El "motor" ya está casi completo, pero varias reglas dependen de
**cómo ustedes manejan el negocio hoy** y no las podemos inventar.

Este documento reúne esas preguntas en lenguaje sencillo. En cada tema decimos primero **qué está
asumiendo el sistema hoy**; usted solo tiene que confirmar si eso es correcto o corregirlo.

Con sus respuestas ajustamos el sistema para que funcione tal como ustedes trabajan, y seguimos
programando sin frenar.

## Cómo responder

- No hace falta saber de sistemas. Responda como le explicaría el negocio a un empleado nuevo.
- Si algo "depende del caso", dígalo — eso también es una respuesta.
- Si tiene un ejemplo real (un contrato, un cliente), úselo.
- Puede escribir la respuesta debajo de cada pregunta.

**Las secciones marcadas 🔴 son las que necesitamos primero para seguir programando.**

---

## 🔴 A. El pago del arriendo: fechas

> **Hoy el sistema asume:** cada contrato tiene su propio "día de pago" del arriendo. Si no se
> indica otro, toma el día en que arrancó el contrato. Ese día es la referencia para saber si un
> pago llegó a tiempo o tarde.

1. ¿El arriendo se paga siempre **una vez al mes**, o hay contratos con otra frecuencia
   (quincenal, cada dos meses, trimestral)?

2. ¿Cada contrato tiene su propio día de pago, o usan **un mismo día para todos** (por ejemplo,
   todos pagan el 5)?

3. Ya con el contrato firmado, ¿se puede **cambiar el día de pago** acordado? ¿En qué situaciones
   y quién lo autoriza?

4. Si el día de pago cae **sábado, domingo o festivo**, ¿el inquilino tiene plazo hasta el
   siguiente día hábil, o cuenta igual como ese día?

---

## 🔴 B. Recargo por mora (pago atrasado)

> **RESUELTO (2026-09-01):** el dueño confirmó que NO se cobra mora / interés por retraso. Toda
> la lógica de mora se retiró del backend; los cobros son netos por canon de arrendamiento. Las
> preguntas 5–13 quedan cerradas. El resto de este documento se conserva como referencia.

> **Hoy el sistema asume:** se cobra un recargo por mora, calculado **por cada día de atraso**,
> después de un período de gracia, sobre lo que el inquilino queda debiendo. El porcentaje y los
> días de gracia son iguales para **todos** los contratos.

5. ¿Cobran algún recargo, interés o multa cuando el inquilino paga tarde el arriendo?
   **(Sí / No)**

6. Si es Sí: ¿dan unos **días de gracia** antes de empezar a cobrar mora? **¿Cuántos días?**

7. ¿A partir de **qué día exacto** empieza a correr la mora? Ejemplo: si el arriendo vence el 5
   y dan 5 días de gracia —
   - ¿La mora arranca el día **10**?
   - ¿O el día **11**?
   - ¿O el mismo día **6** (sin gracia)?

8. El recargo, ¿es un **valor fijo** (por ejemplo $30.000) o se **calcula**?
   - Si se calcula: ¿es un porcentaje **por cada día** de atraso, o un porcentaje **mensual**
     repartido entre los días?
   - ¿Cuál es ese porcentaje hoy?

9. ¿Sobre qué monto se calcula la mora?
   - ¿Sobre el **valor total** del arriendo del mes?
   - ¿O sobre lo que **quede debiendo**, si el inquilino ya abonó una parte?

10. El porcentaje de mora y los días de gracia, ¿son iguales para **todos** los contratos, o hay
    inquilinos/contratos con condiciones distintas pactadas?

11. Ese porcentaje, ¿ha cambiado alguna vez o podría cambiar (por ejemplo, si suben las tasas)?
    - Si cambia, ¿a los contratos que ya venían se les **respeta el porcentaje anterior**, o se
      les aplica el nuevo de una vez?

12. ¿Alguna vez **perdonan (condonan)** la mora, total o parcialmente, para llegar a un acuerdo?
    - ¿Quién puede autorizarlo?
    - ¿Se deja por escrito el motivo?

13. Si el inquilino tampoco paga la mora, ¿esa mora acumulada genera **más mora** encima?
    (normalmente no, pero queremos confirmarlo)

---

## 🔴 C. Cómo se reparte el dinero cuando el inquilino debe varias cosas

> **Hoy el sistema asume:** si un inquilino debe arriendo (canon) + un cargo por una reparación,
> y el dinero no alcanza para todo, lo aplica en este orden: **1° arriendo (canon), 2° cargos por
> novedades.** (El recargo por mora fue retirado — ver B.)

14. ¿Ese orden (primero el arriendo, luego los cargos) es como lo manejan
    ustedes? Si no, ¿cuál es el orden correcto? (La mora ya no aplica; se conserva la pregunta
    por si el orden canon/novedad debe invertirse.)

15. Cuando un inquilino paga de más — por ejemplo debía $450.000 y entrega $500.000 en efectivo:
    - ¿Le devuelven los $50.000 **de una** (como vuelto)?
    - ¿O le dejan ese **saldo a favor** para el próximo mes?
    - ¿Lo decide el inquilino en el momento?

16. ¿Reciben pagos en **efectivo, transferencia, o ambos**? ¿Algún otro medio (consignación,
    datáfono)?

17. ¿Aceptan que un inquilino pague **una parte en efectivo y otra por transferencia** en el
    mismo pago?

---

## 🔴 D. Terminación de contratos

> **Hoy el sistema asume:** un contrato solo puede estar **activo** o **terminado**. Al terminar
> se pide fecha y motivo, se libera el inmueble, y lo que el inquilino todavía deba **sigue
> siendo cobrable** (no se borra).

18. Cuando se termina un contrato y el inquilino aún debe plata, ¿se le **sigue cobrando** esa
    deuda con normalidad? ¿O en la práctica se deja así?

19. ¿Existe la figura de **"suspender" o "congelar"** un contrato temporalmente (que no esté ni
    activo ni terminado)? ¿O siempre es lo uno o lo otro?

20. Si el contrato se termina antes de tiempo y ya se había registrado el arriendo de los meses
    siguientes, ¿ese arriendo futuro se **anula automáticamente**, o lo revisan caso por caso?

21. ¿Manejan **preaviso obligatorio** (por ejemplo, avisar con 30 días de anticipación)?

22. ¿Cobran **multa o penalización** por terminar el contrato antes de tiempo? Si sí, ¿cómo se
    calcula (un mes de arriendo, un porcentaje, etc.)?

---

## E. Reactivación de contratos

> **Hoy el sistema asume:** se puede volver a activar un contrato ya terminado. Solo lo hace el
> administrador y debe escribir un motivo.

23. ¿Con qué frecuencia pasa que se reactive un contrato ya terminado? ¿En qué situaciones reales
    ocurre (el inquilino decide quedarse, un error, etc.)?

24. ¿Está bien que esto sea **exclusivo del administrador**, o la recepción también debería poder
    hacerlo?

---

## 🟡 F. Depósito / garantía

> **Hoy el sistema asume:** se guarda un valor de depósito por contrato. Al terminar, se
> "liquida": se le restan descuentos (cada uno con su concepto y valor) y se devuelve el resto.

25. ¿Piden **depósito o mes(es) de garantía** al firmar? ¿De cuánto normalmente (un mes de
    arriendo, dos)?

26. Al devolver el depósito, ¿qué cosas suelen **descontar** (daños, servicios públicos
    pendientes, arriendo debido, aseo)? ¿Quién revisa y **aprueba** esos descuentos?

27. ¿La devolución la hacen en **efectivo o por transferencia**?

28. ¿En cuánto tiempo, más o menos, se devuelve el depósito después de que el inquilino entrega
    el inmueble?

---

## 🟡 G. Reparaciones y novedades

> **Hoy el sistema asume:** la recepción registra la novedad (un daño, una reparación, un
> reclamo) **sin ponerle valor**. Después el administrador decide: o se le cobra al inquilino
> (se vuelve una deuda del inquilino), o lo asume la inmobiliaria (queda como gasto aprobado, y
> el dinero **solo sale cuando de verdad se paga** la reparación).

29. Cuando pasa algo en un inmueble, ¿cómo deciden si lo paga el **inquilino** o la
    **inmobiliaria**? ¿Hay una regla clara o es caso por caso?

30. ¿Quién toma esa decisión?

31. Cuando el inquilino pide arreglar algo urgente, ¿la recepción puede autorizarlo o siempre
    espera al administrador?

32. ¿Está bien que el gasto de la inmobiliaria se registre en **dos pasos** — primero "aprobado"
    (sin mover plata) y luego "pagado" (cuando de verdad se paga) — o prefieren un solo paso?

---

## 🟡 H. Gastos e ingresos generales de la inmobiliaria

> **Hoy el sistema asume:** solo registra gastos que **nacen de una novedad** de un inmueble.
> No hay forma de registrar un gasto o un ingreso "suelto".

33. ¿Necesitan registrar en el sistema **gastos de la oficina** que no tienen que ver con un
    inmueble puntual (arriendo de la oficina, sueldos, servicios, papelería, honorarios del
    contador)?

34. ¿Alguna vez reciben **dinero que no sea un pago de arriendo** y que necesiten registrar?

---

## 🔴 I. Propietarios de los inmuebles  *(esto define un módulo grande)*

> **Hoy el sistema asume:** guarda un directorio de propietarios y a qué propietario pertenece
> cada inmueble — **y nada más**. No calcula comisiones ni lleva la cuenta de lo que hay que
> entregarle a cada propietario.

35. ¿La inmobiliaria administra inmuebles de **terceros** (propietarios externos), inmuebles
    **propios**, o ambos? ¿Más o menos en qué proporción?

36. Si administra de terceros: ¿cobran una **comisión de administración**?
    - ¿De cuánto (un porcentaje del arriendo, un valor fijo)?
    - ¿Se calcula solo sobre el arriendo, o también sobre la mora y otros cargos?

37. ¿Cada cuánto le **entregan/consignan al propietario** su dinero (mensual)? ¿Cómo llevan esa
    cuenta **hoy** (Excel, cuaderno, el contador)?

38. ¿Al propietario le entregan algún **estado de cuenta** o informe de su inmueble?

39. ¿El propietario **asume algunos gastos** que ustedes le descuentan de lo que le entregan
    (reparaciones, administración del edificio, predial, seguro)?

> **Con estas respuestas decidimos si construimos ahora un módulo completo de "cuenta del
> propietario" (comisiones, liquidación mensual, estado de cuenta) o si eso queda para después.**

---

## 🟡 J. Inquilinos y codeudores

> **Hoy el sistema asume:** un contrato tiene un inquilino y uno o más codeudores, definidos al
> firmar. Después no se pueden cambiar sin rehacer el contrato.

40. ¿**Todo** contrato exige codeudor? ¿Puede tener **más de uno**?

41. ¿Pasa que un codeudor se **retire y entre otro** durante la vigencia del contrato? ¿Seguido?

42. ¿Necesitan poder **corregir datos** de un contrato ya firmado (el valor del arriendo, el día
    de pago, el depósito) sin tener que terminarlo y volver a crearlo?

---

## K. Quién usa el sistema

> **Hoy el sistema asume:** dos tipos de usuario. El **administrador** ve y maneja todo el dinero
> (recaudo, caja, reportes). La **recepción** hace lo operativo (clientes, inmuebles, contratos,
> novedades) pero no toca dinero ni ve reportes contables.

43. ¿Cuántas personas van a usar el sistema y qué hace cada una?

44. ¿La(s) persona(s) de recepción **reciben pagos** de los inquilinos, o eso siempre lo hace el
    administrador?

45. ¿Hay alguien más (el contador, un socio, el dueño) que deba poder entrar **solo a mirar**
    reportes y cartera, sin modificar nada?

---

## 🟡 L. Reportes y avisos

> **Hoy el sistema asume:** exporta a Excel reportes de contratos, cartera, recaudo e inmuebles
> por barrio. El tablero de inicio muestra contratos activos, novedades abiertas, cartera total
> y recaudo del mes.

46. ¿Qué reportes sacan hoy, **cada cuánto**, y **para quién** (el dueño, el contador, un
    propietario)?

47. ¿Necesitan ver la cartera **"por antigüedad"** — cuánto está entre 0 y 30 días de atraso,
    cuánto entre 30 y 60, cuánto de más de 90?

48. ¿Quieren que el sistema **avise automáticamente al inquilino** cuando se atrasa? ¿Por qué
    medio (correo, WhatsApp, mensaje de texto)? Hoy el sistema no cobra mora (retirada
    2026-09-01) y no envía avisos de atraso.

49. Cuando el dueño abre el sistema en la mañana, ¿qué es **lo primero** que querría ver?

---

## M. Inmuebles

50. ¿Manejan distintos **tipos de inmueble** (apartamento, casa, local, bodega, parqueadero)?
    ¿Necesitan poder filtrarlos y agruparlos por tipo en los reportes?

---

## Resumen de prioridad

| | Temas | Por qué |
|---|---|---|
| 🔴 **Ahora** | A · C · D · I (B resuelta) | El sistema no puede terminar el motor de recaudo y contratos sin estas respuestas. |
| 🟡 **Siguientes semanas** | F · G · H · J · L | Se necesitan para las próximas pantallas y reportes. |
| ⚪ Cuando se pueda | E · K · M | Útiles, no urgentes. |
