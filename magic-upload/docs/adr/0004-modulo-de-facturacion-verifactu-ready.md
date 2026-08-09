# ADR-0004 — Módulo de facturación preparado para Verifactu desde el día uno

**Estado:** Aceptada · **Fecha:** 2026-08-09

## Contexto

La facturación española conforme no es una función del producto: **es la razón de
existir del producto**. Sin NIF del cliente en la factura, un autónomo español no
puede deducir el IVA (art. 97 Ley 37/1992) y su gestoría se la rechaza. Ese es el foso
frente a Tiiny Host y demás competidores extranjeros.

Además hay una fecha en el calendario. Según el Real Decreto-ley 15/2025 (BOE de 3 de
diciembre de 2025), Verifactu se aplaza a **1 de enero de 2027 para sociedades** y
**1 de julio de 2027 para autónomos** (`TODO: verificar con asesor` estas fechas y la
referencia antes de comunicarlas a clientes).

Verifactu exige que los registros de facturación estén **encadenados por huella
digital**, sean inalterables y puedan remitirse a la AEAT. Un sistema de facturación
diseñado sin eso no se adapta: se reescribe. Y reescribir el módulo que cobra dinero,
con facturas ya emitidas en producción, es exactamente el proyecto que nadie quiere.

## Decisión

**Se implementa ahora la facturación conforme al RD 1619/2012, y se construye desde el
principio con la estructura de registro de facturación que Verifactu exigirá. Verifactu
se activa por configuración, no por reescritura.**

Cuatro piezas, todas presentes desde la primera factura:

### 1. Numeración sin huecos, con secuencia transaccional

Una tabla `invoice_sequences` con una fila por serie. El número se obtiene con
`UPDATE … RETURNING`, que toma el bloqueo de fila y lo mantiene hasta el `COMMIT` de
la transacción que inserta la factura. Dos emisiones concurrentes se serializan; si
una hace rollback, su número vuelve atrás con ella.

**Nunca un contador en la aplicación.** Un salto en la numeración es un problema con
Hacienda, no un bug estético.

### 2. Inmutabilidad en dos capas

- RLS: solo `SELECT` sobre `invoices`, `invoice_lines`, `invoice_registry`.
- Trigger `forbid_mutation()`: bloquea `UPDATE` y `DELETE` **también para
  `service_role`**, porque el rol de servicio esquiva RLS y es el que usaría un futuro
  script de "arreglar una factura".

Corregir significa **emitir una factura rectificativa** en su propia serie, que
referencia la original (`rectifies_invoice_id`). Nunca editar la existente.

### 3. Datos congelados en el momento de emitir

`issuer_snapshot` y `customer_snapshot` son JSON con la razón social, NIF y domicilio
tal y como estaban al emitir. Si el cliente cambia luego su razón social, **la factura
emitida no cambia**. Sin esto, una factura de hace un año se reimprimiría con datos
que no son los que se declararon.

### 4. Registro de facturación encadenado (el hueco de Verifactu)

Tabla `invoice_registry`, escrita en la misma transacción que la factura:

| Campo | Para qué |
|---|---|
| `kind` | `alta` o `anulacion` |
| `prev_hash` | huella del registro anterior de la cadena; `null` solo en el primero |
| `hash` | huella del registro actual, calculada incluyendo `prev_hash` |
| `payload` | campos del registro de alta/anulación |
| `qr_payload` | hueco para el código QR de la factura |
| `aeat_status`, `aeat_response` | hueco para la remisión y su acuse |

Hoy la cadena se calcula y se guarda, pero **no se remite nada a la AEAT**. Activar
Verifactu será: fijar el algoritmo de huella exacto que publique la AEAT, rellenar el
`payload` con su formato, generar el QR y encender el envío. Configuración y un
adaptador, no una reescritura.

## Consecuencias

**A favor**

- El día que Verifactu entre en vigor no hay proyecto de migración con facturas vivas.
- La inmutabilidad y la ausencia de huecos son propiedades del esquema, no
  convenciones que alguien pueda saltarse con un `UPDATE` de urgencia.
- La cadena de huellas es una prueba de integridad útil desde ya, aunque no se remita.

**En contra**

- Se paga complejidad hoy por un requisito que no es exigible hasta 2027.
- El algoritmo exacto de huella y el formato del `payload` **no están fijados aquí**:
  se toman de la especificación de la AEAT cuando se implemente. Lo que fijamos es la
  estructura, no el detalle. Marcado `TODO: verificar con asesor`.
- Emitir una factura es una transacción con más pasos, y por tanto más lenta. Es
  irrelevante: se emiten pocas y no están en un camino de latencia.
- No se puede "arreglar" una factura mal emitida. Es intencionado, pero significa que
  **la lógica fiscal tiene que estar bien antes de emitir la primera**. De ahí el
  punto de parada del plan de entrega: la matriz de casos fiscales se valida como
  tabla de tests **antes** de que exista código que cobre.

## Qué invalidaría esta decisión

Nada del alcance del producto. Solo un cambio normativo: si Verifactu se derogara o
se aplazara indefinidamente, la estructura seguiría siendo útil (integridad y
auditoría) y no habría motivo para desmontarla.
