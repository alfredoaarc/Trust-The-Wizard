# Facturación española

> ⚠️ **Borrador pendiente de revisión por asesoría fiscal.** Este documento recoge el
> diseño del módulo de facturación y las referencias normativas manejadas. Ningún
> importe, tipo impositivo, plazo ni fecha de aquí debe darse por bueno sin
> confirmación de asesor. Las incógnitas están marcadas `TODO: verificar con asesor`.
>
> **Este es el segundo punto de parada del plan de entrega.** La matriz de la §2 se
> implementa como tabla de tests y se valida con el product owner y su asesoría
> **antes** de escribir código que cobre dinero.

Ver también [ADR-0004](adr/0004-modulo-de-facturacion-verifactu-ready.md).

## 1. Por qué esto es el producto y no una función

Sin el NIF del cliente en la factura, un autónomo español **no puede deducir el IVA**
(art. 97 Ley 37/1992, requisitos formales de la deducción) y su gestoría se la rechaza.
Una gestoría española documenta que con las herramientas extranjeras *"hay que
configurar el NIF en el portal de cada plataforma, un paso que la mayoría de autónomos
se salta"* — y luego no pueden deducir.

Ese es el foso. Un competidor extranjero no puede replicarlo sin constituir una
sociedad en España.

## 2. Matriz de casos fiscales

**Premisa: Magic Upload será una sociedad española.** Eso determina todo lo que sigue,
y es lo que corrige el error habitual de aplicar inversión del sujeto pasivo en
operaciones interiores.

| # | Cliente | Zona | Tratamiento | `tax_regime` | Mención en factura |
|---|---|---|---|---|---|
| 1 | Particular (B2C) | España peninsular + Baleares | **21 % IVA** | `es_standard` | — |
| 2 | Empresa o autónomo (B2B) | España peninsular + Baleares | **21 % IVA.** La inversión del sujeto pasivo **NO** aplica a operaciones interiores | `es_standard` | — |
| 3 | Empresa con NIF-IVA válido en VIES | Otro estado UE | **0 %** | `eu_b2b_reverse` | «Inversión del sujeto pasivo — art. 69 LIVA / art. 44 Directiva 2006/112/CE» |
| 4 | Empresa **sin** NIF-IVA válido en VIES | Otro estado UE | Se trata como particular → caso 5 | `eu_b2c_oss` | — |
| 5 | Particular | Otro estado UE | IVA del **país del cliente**, vía ventanilla única (**OSS**) | `eu_b2c_oss` | — |
| 6 | Cualquiera | Fuera de la UE | **No sujeto** a IVA español | `non_eu_out_of_scope` | «Operación no sujeta a IVA español» |
| 7 | Cualquiera | **Canarias** | **Fuera del ámbito del IVA.** Aplica **IGIC** | `es_igic_ipsi` | `TODO: verificar con asesor` la mención exacta |
| 8 | Cualquiera | **Ceuta y Melilla** | **Fuera del ámbito del IVA.** Aplica **IPSI** | `es_igic_ipsi` | `TODO: verificar con asesor` |

### El caso que siempre se olvida

**Canarias, Ceuta y Melilla no son territorio IVA** (art. 3 LIVA). Un cliente en Las
Palmas **no** lleva 21 % de IVA. Tratarlos como "España peninsular" porque el
`country_code` es `ES` es el bug clásico que genera facturas mal emitidas, y como las
facturas son inmutables ([ADR-0004](adr/0004-modulo-de-facturacion-verifactu-ready.md)),
corregirlo significa emitir rectificativas.

Por eso `billing_profiles.tax_zone` es una columna propia y **no se deriva del país en
tiempo de consulta**: se resuelve al guardar el perfil, a partir del código postal y la
provincia, y se congela en la factura.

Códigos postales: Las Palmas `35xxx`, Santa Cruz de Tenerife `38xxx`, Ceuta `51xxx`,
Melilla `52xxx`. `TODO: verificar con asesor` que el CP es criterio suficiente o si
debe primar el domicilio declarado.

### Incógnitas abiertas de esta matriz

- **Umbral OSS.** Existe un umbral anual de facturación transfronteriza a
  consumidores UE por debajo del cual se puede repercutir IVA español en lugar de
  darse de alta en OSS. `TODO: verificar con asesor` el importe vigente, si conviene
  renunciar al umbral desde el principio, y en qué momento hay que registrarse.
- **Caso 4.** Tratar como consumidor a una empresa cuyo NIF-IVA no valida es lo
  prudente, pero conviene que lo confirme la asesoría.
- **Caso 7/8.** Si Magic Upload no está establecida en Canarias, lo probable es que la
  operación quede no sujeta a IVA sin repercutir IGIC, correspondiendo la
  autoliquidación al cliente. **No lo damos por bueno.** `TODO: verificar con asesor`.

### Cómo se valida — **ya implementado, listo para revisar**

`packages/billing` expone una función pura:

```ts
resolveTaxTreatment(subject: TaxSubject, context: TaxContext): TaxTreatment
```

Los ocho casos de la tabla son las ocho filas de la constante `MATRIZ` en
[`packages/billing/src/tax-treatment.test.ts`](../packages/billing/src/tax-treatment.test.ts),
que se lee de izquierda a derecha como una hoja de cálculo: cliente → zona → qué se le
cobra. Alrededor hay 30 casos más de contorno: VIES caído frente a VIES que rechaza,
los cuatro territorios fuera del IVA, con y sin alta en OSS, y el Reino Unido.

**Esa tabla verde es el entregable del punto de parada.** Ejecútala con
`pnpm test packages/billing`.

Tres salvaguardas que hacen que el aviso no sea decorativo:

- Toda operación en Canarias, Ceuta o Melilla devuelve `requiresAdvisorReview: true`,
  que **debe impedir la emisión automática** hasta que la asesoría confirme el
  tratamiento.
- Toda operación OSS devuelve también `requiresAdvisorReview: true` mientras la tabla
  de tipos por país no esté verificada.
- Si el país del cliente no tiene tipo configurado, la función **lanza** en lugar de
  caer a un valor por defecto. Emitir con un tipo inventado sería peor que parar.

Y `validateSpanishTaxId` valida NIF, CIF y NIE **con dígito de control**: un test
comprueba que de las 26 letras posibles para `12345678` solo se acepta la correcta.

## 3. Requisitos de la factura (RD 1619/2012)

Campos obligatorios, todos:

- [ ] **Número y serie**, correlativos dentro de la serie
- [ ] **Fecha de expedición**
- [ ] **Nombre o razón social y NIF del emisor**
- [ ] **Nombre o razón social y NIF del destinatario**
- [ ] **Domicilio completo de ambos**
- [ ] **Descripción de la operación**, con precio unitario sin IVA y descuentos
- [ ] **Tipo impositivo aplicado**
- [ ] **Cuota de IVA consignada por separado**
- [ ] **Fecha de la operación**, si difiere de la de expedición
- [ ] **Mención de exención, no sujeción o inversión del sujeto pasivo** cuando proceda

Referencia: art. 6 RD 1619/2012 (Reglamento de facturación).
`TODO: verificar con asesor` que la lista está completa para nuestro caso y si aplica
factura simplificada en algún supuesto.

**Conservación:** `TODO: verificar con asesor` el plazo aplicable (prescripción
tributaria y obligaciones mercantiles apuntan a plazos distintos). Hasta confirmarlo,
no se purga ninguna factura.

## 4. Verifactu — preparado ahora, activado después

Según el Real Decreto-ley 15/2025 (BOE de 3 de diciembre de 2025, ya convalidado),
Verifactu se aplaza un año:

| Obligado | Fecha de aplicación |
|---|---|
| **Sociedades** (nuestro caso) | **1 de enero de 2027** |
| Autónomos | 1 de julio de 2027 |

`TODO: verificar con asesor` estas dos fechas y la referencia normativa antes de
comunicarlas a clientes o de fijarlas en el calendario de producto.

**No se implementa entero ahora.** Lo que sí existe desde la primera factura es la
estructura del registro de facturación, en `invoice_registry`:

- Encadenamiento por **huella digital** de cada registro con el anterior (`prev_hash`).
- Campos del registro de **alta** y de **anulación** (`kind`, `payload`).
- Hueco para el **código QR** de la factura (`qr_payload`).
- Hueco para la **remisión a la AEAT** y su acuse (`aeat_status`, `aeat_response`).

Activar Verifactu debe ser: fijar el algoritmo de huella exacto publicado por la AEAT,
ajustar el formato del `payload`, generar el QR y encender el envío. **Configuración y
un adaptador, no una reescritura.**

Lo que **no** está fijado aquí y hay que tomar de la especificación oficial cuando se
implemente: algoritmo y formato exacto de la huella, estructura del `payload`,
contenido codificado en el QR, endpoint y autenticación de la remisión.

## 5. Comportamiento en el producto

### NIF en el checkout, no escondido en ajustes

**El campo de NIF/CIF es obligatorio y se valida en el checkout, antes del primer
cobro.** No en una pantalla de "ajustes de facturación" que nadie visita. Ese es el
paso que la mayoría de autónomos se salta con las herramientas extranjeras, y luego no
pueden deducir.

### Validación con dígito de control, no con expresión regular

`packages/billing` valida **NIF, CIF y NIE comprobando el dígito de control**, no solo
el formato. Un regex acepta `12345678Z` con la letra equivocada; el dígito de control
no. Cada tipo tiene su algoritmo propio, y los tres van con tests.

### VIES

- Validación automática del NIF-IVA para clientes de otros estados UE.
- **Se guarda el resultado y su fecha** (`vies_valid`, `vies_checked_at`,
  `vies_request_id`): es la prueba de diligencia debida.
- **Si VIES está caído, no se bloquea la venta.** Se cobra con IVA y se regulariza
  después. Perder una venta por un servicio de terceros indisponible es peor que
  emitir una rectificativa.
- Revalidación periódica desde `apps/jobs` para suscripciones activas.

### Presentación de precios

Convención española, y no es un detalle estético: mostrar `$9 + tax` se lee como
extranjero y el extranjero es justo de quien nos estamos diferenciando.

| Cliente | Cómo se muestra |
|---|---|
| Particular | **«8,99 €/mes, IVA incluido»** |
| Empresa / autónomo | Desglosado: base + 21 % IVA + total |

Formato: `1.234,56 €`, símbolo detrás y con espacio, decimales con coma, miles con
punto, fechas `dd/mm/aaaa`.

### PDF y entrega

- **Factura en PDF, en español**, generada automáticamente al emitir.
- Descargable desde el panel **y** enviada por email.
- El PDF se genera del snapshot congelado, no de los datos actuales del cliente.

### Rectificativas autoservicio

El usuario puede pedir una **factura rectificativa** desde el panel, referenciando la
original. Se emite en su propia serie. **Nunca se edita la factura original.**
`TODO: verificar con asesor` qué motivos de rectificación admitimos en autoservicio y
cuáles exigen intervención (art. 15 RD 1619/2012).

## 6. Pagos

| Medio | Uso | Notas |
|---|---|---|
| **Tarjeta** (Visa, Mastercard) vía Stripe | Suscripciones y pagos puntuales | Base |
| **SEPA Direct Debit** vía Stripe | Suscripciones | La domiciliación bancaria es el instrumento recurrente cultural en España. No es opcional |
| **Bizum** vía Stripe | **Solo pago anual anticipado y compras puntuales** | **No soporta pagos recurrentes.** Límite de 5.000 € por transacción. `TODO: verificar` ambos datos con la documentación vigente de Stripe |
| **PayPal** | Si sale barato de añadir | Baja prioridad |

**El logo de Bizum en la página de precios es una señal de confianza fuerte en
España**, incluso para quien luego pague con tarjeta. Su valor es tanto de conversión
como de medio de pago, y por eso entra pese a no servir para suscripciones.

## 7. Series de facturación

| Serie | Uso |
|---|---|
| `A{año}` | Facturas ordinarias |
| `R{año}` | Facturas rectificativas |

Una fila por serie en `invoice_sequences`, numeración desde 1 cada año.
`TODO: verificar con asesor` si conviene reiniciar por año o mantener correlativo
indefinido, y si hacen falta series separadas por régimen fiscal (p. ej. OSS).

**La numeración no puede tener huecos.** Mecanismo en
[`DATA-MODEL.md` §4](DATA-MODEL.md#numeración-sin-huecos).

## 8. Resumen de lo que hay que verificar antes de cobrar

| # | Qué | Dónde |
|---|---|---|
| 1 | Los 8 casos de la matriz fiscal | §2 |
| 2 | Tratamiento exacto de Canarias, Ceuta y Melilla | §2 |
| 3 | Umbral OSS y momento de registro | §2 |
| 4 | Lista completa de campos de factura para nuestro caso | §3 |
| 5 | Plazo de conservación de facturas | §3 |
| 6 | Fechas de Verifactu y referencia del RDL 15/2025 | §4 |
| 7 | Motivos de rectificación admitidos en autoservicio | §5 |
| 8 | Bizum: ausencia de recurrencia y límite de 5.000 € | §6 |
| 9 | Reinicio anual de series y necesidad de series por régimen | §7 |
| 10 | **Tabla de tipos generales de IVA de los 27 estados** (OSS) | `tax-treatment.ts` |
| 11 | **Regla de «uso y disfrute efectivo»** (art. 70.Dos LIVA): puede volver a sujetar al IVA español servicios prestados fuera de la UE | `tax-treatment.ts` |
| 12 | **El código postal como criterio de zona fiscal**, o si prima el domicilio declarado cuando discrepan | `tax-zone.ts` |
| 13 | **Territorios especiales de otros estados UE** (Åland, DOM franceses, Livigno, Büsingen): hoy tratados como UE normal | `tax-zone.ts` |
| 14 | **Longitudes de NIF-IVA por país** usadas en la comprobación de formato | `tax-id.ts` |

Los cinco últimos han salido al implementar la matriz y no estaban en el análisis
inicial. El 11 y el 13 son los que más pueden doler: ambos producen facturas mal
emitidas en casos que hoy pasan silenciosamente por la rama genérica.
