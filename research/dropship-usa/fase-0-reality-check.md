# Fase 0 — Reality check

**Fecha del análisis:** 8 de agosto de 2026
**Objeto:** validar si la táctica de Google Shopping hacia EE. UU. es ejecutable con 300 € totales.

---

## Nota metodológica sobre la fiabilidad de los datos (léela antes que nada)

El entorno donde se ha hecho esta investigación tiene un proxy de red que **bloquea el acceso directo a casi todos los dominios externos**. He podido usar el buscador, pero **no he podido abrir ni una sola de las páginas fuente** para leerlas con mis propios ojos. Intentos bloqueados: `federalregister.gov`, `congress.gov`, `support.google.com`, `zonos.com`, `tariffstool.com`, `foundrycro.com`.

Esto significa que la información de abajo procede de **resúmenes del buscador**, no de lectura de fuente primaria. En consecuencia uso tres etiquetas y no dos:

| Etiqueta | Significado |
|---|---|
| `[CONCORDANTE]` | Coincide en 2 o más resultados de búsqueda independientes. Alta confianza, pero **no verificado en fuente primaria por mí**. |
| `[SIN CONFIRMAR]` | Aparece en un solo resultado. Trátalo como pista, no como dato. |
| `[ESTIMACIÓN]` | Cálculo o supuesto mío. Explico de dónde sale. |

**Ninguna cifra de este documento merece la etiqueta "verificado".** Antes de mover un euro, abre tú las URLs citadas y confirma. Especialmente las aduaneras: el régimen arancelario de EE. UU. ha cambiado **cuatro veces en 18 meses** y la última vez fue hace 15 días.

---

## 1. Aranceles USA: qué pasó realmente

### Cronología `[CONCORDANTE]`

| Fecha | Qué pasó |
|---|---|
| 2 may 2025 | Se suspende el de minimis de 800 $ para China y Hong Kong. |
| 29 ago 2025 | Se extiende la suspensión a **todos los países**. El umbral de 800 $ deja de existir para cualquier origen. |
| 4 jul 2025 | La *One Big Beautiful Bill Act* deroga el de minimis **por ley**, con efecto 1 jul 2027. Al ser ley del Congreso, no depende de que aguante ninguna orden ejecutiva. |
| **20 feb 2026** | **El Tribunal Supremo tumba los aranceles IEEPA** (6-3, ponente Roberts): ilegales tanto los "recíprocos" como los de China/Canadá/México. |
| 24 feb 2026 | La Casa Blanca reimpone un recargo del 10 % bajo **Sección 122** (máximo legal: 15 %, duración máxima: 150 días). |
| **24 jul 2026** | **Expira la Sección 122 por plazo legal.** El USTR la sustituye con nuevos aranceles **Sección 301 por trabajo forzoso**: 10 % o 12,5 % sobre ~60 economías. |
| 24 jun 2026 | CBP publica las reglas finales interinas que suspenden el de minimis **indefinidamente** y crean un **proceso nuevo de entrada postal informal**. |

### Situación hoy (8 ago 2026)

- **El de minimis no existe.** Todo paquete comercial que entra en EE. UU., sea del valor que sea, del origen que sea, por el medio que sea, necesita entrada aduanera formal o informal, clasificación HTS a 10 dígitos y pago de derechos. `[CONCORDANTE]`
- **Nuevo proceso postal, efectivo 24 jul 2026:** envíos de ≤ 2.500 $ que llegan por red postal internacional necesitan entrada informal. El declarante debe **tener una fianza aduanera (bond)** antes de que se acepte la entrada, y transmitir código de declarante, número de fianza, país de origen, HTSUS a 10 dígitos, valor, tipo arancelario, derechos totales, transportista y tracking. **Fecha límite de cumplimiento: 22 oct 2026.** `[CONCORDANTE]`
- **Aranceles Sección 301 trabajo forzoso (desde 24 jul 2026):** China paga **12,5 %**. La UE (y por tanto España) paga **10 %, neto del arancel MFN del producto**. El tipo depende del régimen de cada país contra importaciones de trabajo forzoso. `[CONCORDANTE]`
- Estos se **suman** a lo que ya había: MFN, Sección 232 (acero/aluminio/cobre, ampliado el 6 abr 2026) y las listas Sección 301 preexistentes contra China (7,5 %–25 % según partida). `[CONCORDANTE]`

### El coste que mata: no es el arancel, es la tasa de entrada

Esto es lo que nadie menciona en los vídeos. Ahora **cada paquete es una operación aduanera**:

- Tasa CBP de entrada informal: 2,69 $ automatizada / 8,06 $ manual / 12,09 $ si la tramita CBP. `[SIN CONFIRMAR]`
- **Honorarios de agente de aduanas: 75–150 $ por entrada informal.** `[CONCORDANTE]`
- Fianza: 75–275 $ por entrada única, o 400–1.200 $ una continua anual. `[CONCORDANTE]`

Los consolidadores y transportistas agrupan esto y lo abaratan mucho, pero **no lo hacen gratis**. Un ejemplo citado en las fuentes calcula ~50 $ de agente por paquete en un lote de 100. `[SIN CONFIRMAR]`

En el modelo de abajo asumo **10 $ por paquete** de coste de despacho agregado, que es **el supuesto más optimista defendible**. Si el real es 25 $ o 50 $, todo lo que sigue empeora.

### ¿Quién es el importador de registro?

Punto crítico. Si tu proveedor chino te vende "DDP" y se declara importador de registro, **verifica por escrito su código de fianza y su EIN**. Varias fuentes advierten de proveedores DDP que se declaran IOR con fianzas y EIN que no tienen; cuando CBP detecta la declaración falsa, **la responsabilidad recae en el vendedor**. Tú, español, sin entidad en EE. UU., no puedes ser IOR sin montar estructura. `[CONCORDANTE]`

### Veredicto del punto 1

**El dropshipping directo China→consumidor USA como modelo de bajo ticket está muerto en 2026.** No por el arancel porcentual, sino por el coste fijo por paquete del despacho aduanero, que es regresivo: destroza los pedidos pequeños. Las alternativas (importar a granel a un 3PL en EE. UU., o abastecerse fuera de China) exigen capital de inventario, lo que choca frontalmente con un presupuesto de 300 € totales.

---

## 2. Google Merchant Center: duplicar listados

**No he podido abrir la política oficial** (`support.google.com` bloqueado por el proxy). Lo de abajo procede de resúmenes del buscador y de fuentes especializadas. **Lee tú las dos URLs oficiales antes de tocar el feed.**

### Lo que dicen las fuentes `[CONCORDANTE]`

Crear múltiples variantes del mismo producto cambiando título e imagen entra en conflicto con la política de **abuso de la red publicitaria**, establecida precisamente para impedir ventajas competitivas injustas. Listar el mismo producto varias veces para ganar ventaja se considera abuso de la red y acaba en **suspensión de cuenta**.

La suspensión es **a nivel de cuenta**: Google retira todos los productos de todos los destinos, no solo los infractores. Ocurre cuando la infracción es sistemática, repetida o lo bastante grave como para sugerir abuso intencionado. **Reactivar una cuenta suspendida no es fácil, y aun resolviendo todas las infracciones la aprobación no está garantizada.**

Hay además un aviso sectorial reciente: una moda en LinkedIn promoviendo justamente esta técnica de duplicación ha recibido críticas de especialistas por violar la política y arriesgar suspensiones. **La táctica que te vendieron ya está en el radar de Google.** `[CONCORDANTE]`

### La línea, dibujada con claridad

| ✅ Legítimo | ❌ Manipulación |
|---|---|
| **Variantes reales** con `item_group_id`: mismo modelo en distintos colores, tallas o materiales, cada uno con su GTIN/MPN y su propia URL de variante. | **Mismo SKU clonado** varias veces con imagen y precio distintos apuntando **a la misma URL**. Esto es exactamente lo que describe tu paso 5 original. |
| **Productos distintos** de la misma línea: referencias diferentes, con stock, GTIN y página propios. | Precios inflados artificialmente en los clones para que el "barato" parezca chollo dentro de tu propio feed. |
| **Un título optimizado** por producto, redactado según la intención de búsqueda dominante de ese producto. | **Varios títulos** para el mismo producto con el fin de ocupar más subastas. |
| **Packs y bundles reales** que el cliente puede comprar como tal, con su propia página y precio. | Bundles ficticios que resuelven al mismo producto individual. |
| **Imágenes de estilo de vida generadas con IA**, si muestran el producto real fielmente. | Imágenes que muestran un producto distinto, mejor o con accesorios que no se incluyen. Eso es *misrepresentation of product*. |

### Reescritura del paso 5 de tu táctica

> **Original (te suspende la cuenta):** "En vez de subir presupuesto en un producto, duplicar el listado con distintas imágenes y precios para cubrir más subastas."

> **Versión que no te suspende:** El escalado horizontal se hace **ampliando el catálogo real**, no clonando el feed. Un SKU nuevo solo cuenta si tiene: producto físicamente distinto o variante real, GTIN/MPN propio, página de producto propia con su URL, stock propio y precio que se corresponde con lo que cobra el checkout. La cobertura adicional de subastas se consigue con (a) más referencias reales dentro de la línea, (b) `item_group_id` bien montado para variantes legítimas, y (c) **un** título por producto optimizado para su intención de búsqueda dominante — no varios títulos por producto.

Sobre las imágenes IA: son válidas mientras representen fielmente el producto real. En cuanto la imagen sugiere algo que la caja no contiene, has cruzado a *misrepresentation of product*, que es la vía rápida a la suspensión.

---

## 3. Suspensión de GMC en tiendas nuevas

Las tiendas nuevas son el perfil de riesgo máximo. La política sanciona con **suspensión sin aviso previo** al detectar la infracción. `[CONCORDANTE]`

### Los dos tipos de *misrepresentation* `[CONCORDANTE]`

- **De uno mismo:** información falsa o engañosa sobre el negocio o la identidad — dirección o nombre comercial falsos.
- **Del producto:** información falsa o engañosa sobre precios, disponibilidad o características.

### Checklist obligatorio ANTES de enviar el feed `[CONCORDANTE]`

1. **Identidad coherente en todas las superficies.** Nombre legal, dirección física, teléfono y email de soporte **idénticos** en web, GMC, WHOIS y pasarela de pago. Google los cruza.
2. **Datos de producto completos.** Cada producto necesita título, descripción, precio, disponibilidad, GTIN/MPN, marca y condición. Sin GTIN real, banderas rojas.
3. **Páginas de política visibles y coherentes.** Devoluciones, envíos, privacidad, términos, contacto. Google comprueba que la política sea **internamente coherente**, que **coincida con lo que promete la ficha de producto** y que **coincida con los datos del feed**.
4. **Alineación envío/checkout.** Google **llega hasta el checkout** para comprobar que impuestos y gastos de envío coinciden con GMC y con tu página. Si la política dice envío gratis y el checkout suma 5 $, es *misrepresentation* y suspensión inmediata.
5. **Sin escasez falsa.** Nada de contadores falsos ni niveles de stock inventados.
6. **Claims sustanciados.** "Certificado oficialmente", "ecológico" y similares requieren documentación.

### Riesgo específico de tu perfil

Eres español, vendiendo a EE. UU., sin marca, sin historial, con dominio recién registrado y probablemente con dropshipping desde Asia. Ese conjunto es **exactamente** el patrón que los filtros antifraude de GMC buscan. Los plazos de envío que declares deben ser los reales — y con el nuevo despacho aduanero postal, los reales son largos.

**Corrección de un dato erróneo:** una fuente afirmaba que GMC exige estar ubicado en EE. UU. para vender allí. **Es falso.** GMC permite un país de venta distinto del país del negocio, siempre que cumplas los requisitos del país objetivo: divisa USD, landing pages en el mismo idioma que el feed, y declarar plazos y costes de envío a EE. UU. `[CONCORDANTE]`. Del mismo modo, **Shopify Payments sí está disponible en España** `[CONCORDANTE]`. Ninguno de los dos es el cuello de botella.

---

## 4. Los números del vídeo frente a los reales

### Lo que asume el caso original

- Conversión: **5 %**
- Margen neto: **30 %**

### Benchmarks reales 2026 `[CONCORDANTE]`

| Métrica | Valor |
|---|---|
| Conversión media Google Shopping | **1,4 % – 1,91 %** |
| Percentil 75 (tiendas buenas) | 2,6 % |
| Conversión media campañas de Búsqueda | 3,17 % |
| CPC medio Shopping | **0,88 $** |
| CPC Shopping estándar vs Performance Max | 0,68 $ vs 0,82 $ |
| Subida interanual de CPC ecommerce 2025→2026 | +8 % |
| Rango global de conversión ecommerce | 1,8 % – 3 % |

Por categorías: alimentación y bebidas lideran con 4,9–6,2 %; artesanía 4–5,1 %; **lujo y joyería en el fondo con 0,5–1 %**; productos de bebé 0,5–0,7 %.

### El rango honesto para tu caso

Estos benchmarks son de **tiendas establecidas, con marca, con historial y con tráfico mixto**. Una tienda nueva, sin marca, sin reseñas, sin señales de confianza y con dominio de días, convierte **por debajo de la media**, no en la media.

**Rango honesto para una tienda nueva sin marca: 0,5 % – 1,5 %.** `[ESTIMACIÓN]` — extrapolado de que la media general es 1,4–1,91 % y de que la ausencia de señales de confianza es uno de los factores conocidos de caída de conversión. Usar 2 % ya es optimista. Usar 5 % es ficción.

**El 5 % del vídeo es 3 veces la media del canal.** No es un supuesto agresivo: es un supuesto falso, y es el que sostiene toda la aritmética del caso.

---

## 5. La aritmética que decide

Modelo por unidad. Reserva de devoluciones 5 %, pasarela 2,9 % + 0,30 $, despacho aduanero **10 $/paquete (supuesto optimista)**. `[ESTIMACIÓN]`

### Escenario A — dropship directo China, arancel sobre el valor de transacción (precio retail)

Producto a 60 $, COGS 12 $, envío 8 $, arancel ~27 % (MFN + lista 301 + 12,5 % trabajo forzoso).

```
coste total 51,24 $  →  margen de contribución 8,76 $  →  CPA máx 4,38 $
CPC break-even @2 % conversión:  0,175 $  (con techo de CPA: 0,088 $)
CPC de mercado: 0,68 – 0,88 $
```

**El CPC de mercado es 4 a 10 veces el break-even. Producto muerto.**

> Ojo al supuesto clave: en una venta directa al consumidor, el "precio realmente pagado por la mercancía vendida para exportación a EE. UU." es **el precio retail**, no el precio mayorista. Si CBP valora sobre los 60 $, es el escenario A. Confírmalo con un agente de aduanas: es la variable individual más destructiva del modelo.

### Escenario B — el mismo, pero asumiendo arancel solo sobre el COGS (optimista)

```
coste total 38,28 $  →  margen de contribución 21,72 $  →  CPA máx 10,86 $
CPC break-even @2 %:  0,434 $  (con techo de CPA: 0,217 $)
CPC de mercado: 0,68 – 0,88 $
```

**Sigue muerto.** Incluso regalándote la interpretación aduanera más favorable.

### Escenario C — el mundo de 2024, sin aranceles ni despacho

```
coste total 25,04 $  →  margen de contribución 34,96 $  →  CPA máx 17,48 $
CPC break-even @2 %:  0,699 $  (con techo de CPA: 0,350 $)
```

**Aquí está la clave de todo.** Incluso **sin aranceles y sin coste de despacho**, un producto de 60 $ a 2 % de conversión apenas empata con el CPC de mercado, y suspende en cuanto quieres quedarte la mitad del margen. La táctica del vídeo no falla solo por los aranceles de 2026: **falla porque sustituye el 2 % real por un 5 % inventado.** A 5 % el CPA sale 13,6 $ y cabe en un margen de 18 $. A 2 % el CPA sale 34 $ y no cabe en ningún sitio. Todo el caso vive o muere en ese único número.

### Escenario D — ticket alto, stock propio en España, origen UE

Producto a 150 $, COGS 30 $, envío 20 $, arancel UE 10 %.

```
coste total 87,15 $  →  margen de contribución 62,85 $  →  CPA máx 31,42 $
CPC break-even @2 %:  1,257 $  (con techo de CPA: 0,628 $)
CPC de mercado: 0,68 – 0,88 $
```

**Este es el único que respira.** Y exige comprar inventario por adelantado — lo que se come los 300 € antes de gastar un euro en publicidad. Ahí está la trampa: el régimen arancelario de 2026 te empuja a ticket alto, el ticket alto te empuja a inventario, y el inventario devora el presupuesto.

### El presupuesto, al euro

300 € ≈ 330 $ `[ESTIMACIÓN]`, tipo de cambio aproximado.

| Concepto | Coste |
|---|---|
| Shopify Basic (1 mes) | 39 $ |
| Dominio (1 año) | 12 $ |
| Muestra de producto + envío a España | 40 $ |
| **Queda para publicidad** | **239 $** |

Con CPC de 0,68 $ → **351 clics**. Con CPC de 0,88 $ → 272 clics.

### Y aquí está el golpe final: significancia estadística

| Clics | Ventas esperadas @1 % | @2 % | Si salen 0 ventas, solo puedes descartar… |
|---|---|---|---|
| 351 | 3,5 | 7,0 | conversión > 0,85 % |
| 272 | 2,7 | 5,4 | conversión > 1,10 % |

Con 351 clics y una conversión real del 2 %, esperas 7 ventas con un intervalo de confianza del 95 % de aproximadamente **3 a 15**. **No puedes distinguir un 1 % de un 3 %.** Para separar esas dos hipótesis con potencia razonable harían falta del orden de 2.000–3.000 clics. `[ESTIMACIÓN]` — cálculo estándar de tamaño muestral para proporciones.

Traducción: **tus 300 € no compran un experimento. Compran una anécdota.** Salga lo que salga, no sabrás si el producto funciona o si tuviste suerte.

---

## VEREDICTO

> ## ❌ NO VIABLE CON 300 €
>
> 1. El de minimis está eliminado y cada paquete es ahora una operación aduanera con coste fijo. Ese coste fijo es regresivo y aniquila el ticket bajo.
> 2. A un precio de 60 $, el CPC de break-even sale entre 0,09 $ y 0,43 $ según el supuesto arancelario. El CPC de mercado en Shopping es 0,68–0,88 $. Pierdes dinero en cada clic, no en cada venta.
> 3. El caso original solo cuadra porque asume un 5 % de conversión. La media real del canal es 1,4–1,91 %, y una tienda nueva sin marca está por debajo. Corregido ese número, el modelo se cae aunque los aranceles no existieran (escenario C).
> 4. Tras plataforma, dominio y muestra quedan ~239 $, que compran ~350 clics. Con 350 clics no alcanzas significancia estadística: no distingues un 1 % de un 3 %.
> 5. El único escenario con margen sano exige ticket de ~150 $ y stock propio — es decir, capital de inventario que no tienes.
> 6. El paso 5 de la táctica, tal y como está escrito, es abuso de la red publicitaria y provoca suspensión de cuenta sin aviso.
> 7. Tu perfil (España→EE. UU., sin marca, dominio nuevo, sin historial) es el de máximo riesgo de suspensión por *misrepresentation* en GMC.
>
> **No es que sea difícil. Es que la aritmética se cierra en negativo antes de empezar.**

### Las 3 asunciones que, si fallan, matan el plan

1. **Que el CPC de mercado esté por debajo del break-even.** No lo está en ningún escenario a 60 $. Es la asunción rota, y es la que decide.
2. **Que la conversión sea del 5 %.** El benchmark del canal es 1,4–1,91 % y tú estarás por debajo. Un factor de 3x de error en el input más sensible del modelo.
3. **Que el coste aduanero por paquete sea absorbible.** He asumido 10 $, el mejor caso defendible. Las fuentes apuntan a 75–150 $ por entrada informal sin agrupar. Si el real es 25 $, el margen del escenario A es negativo.

---

## Alternativas, ordenadas por probabilidad de no perder los 300 €

Ninguna es "el mismo plan pero mejor". Si algo he aprendido de la aritmética de arriba es que no hay versión de este plan que funcione con este presupuesto.

**A. Cambiar el producto, no el canal.** Mantener Google Shopping pero ir a ticket 120–200 $ con margen bruto ≥ 60 %, abastecido en la UE o en EE. UU. (sin arancel de importación al consumidor final, o con el 10 % UE neto de MFN). Requiere inventario mínimo: los 300 € se van en 4–6 unidades y **no queda para publicidad**. Es un plan de 800–1.200 €, no de 300 €.

**B. Cambiar el modelo: producto digital o print-on-demand con impresión en EE. UU.** Elimina de un plumazo aranceles, aduanas, fianzas y plazos de envío. Margen del 60–90 %, sin inventario. Los 300 € van casi íntegros a publicidad. El hueco de mercado y las tres palancas de Shopping (imagen, título, precio) siguen aplicando. **Es la alternativa más cercana a tu táctica que sobrevive a la aritmética.**

**C. Cambiar el mercado: vender en España o la UE.** Sin aranceles, sin aduanas, envío de 4–6 €, CPC significativamente más barato que en EE. UU., y tú entiendes al cliente y el idioma. El mismo presupuesto compra bastantes más clics. Renuncias al tamaño del mercado americano a cambio de que las cuentas salgan.

**D. Gastar los 300 € en aprender en vez de en vender.** Si lo que quieres es que el dinero maximice lo que aprendes: ~50 $ en dominio y plataforma un mes, ~50 $ en una herramienta de keywords de pago un mes para tener datos de volumen y CPC **reales** en vez de estimados, y ~200 $ en una campaña de Búsqueda de una sola keyword midiendo intención de compra real antes de comprar producto alguno. Sales sin tienda pero con datos propios, que es más de lo que tendrías tras quemarlos en Shopping.

---

## Fuentes

Todas consultadas vía buscador el 8 ago 2026. **Ninguna abierta y leída directamente** (proxy de red).

**Aranceles y de minimis**
- https://www.cbsnews.com/news/de-minimis-exemption-end-date-tariff/
- https://www.ghy.com/trade-compliance/us-to-end-de-minimis-exemption-for-low-value-imports-on-august-29/
- https://www.federalregister.gov/documents/2026/06/24/2026-12669/indefinite-suspension-of-the-de-minimis-exemption-for-mail-shipments-and-new-postal-informal-entry
- https://www.federalregister.gov/documents/2026/06/24/2026-12670/indefinite-suspension-of-the-de-minimis-exemption-for-merchandise-arriving-through-all-modes-other
- https://www.bdo.com/insights/tax/cbp-suspends-de-minimis-exemption-and-introduces-new-postal-entry-requirements
- https://diaztradelaw.com/postal-de-minimis-rule/
- https://www.thompsonhinesmartrade.com/2026/06/cbp-issues-interim-final-rules-indefinitely-suspending-the-de-minimis-exemption-for-imports/

**Tribunal Supremo e IEEPA**
- https://www.wilmerhale.com/en/insights/client-alerts/20260220-supreme-court-strikes-down-ieepa-tariffs-what-now
- https://www.ropesgray.com/en/insights/alerts/2026/02/supreme-court-strikes-down-ieepa-tariffs-key-takeaways-and-implications-for-importers
- https://www.congress.gov/crs-product/LSB11398
- https://taxfoundation.org/blog/supreme-court-trump-tariffs-ruling/
- https://globaltradealert.org/blog/from-ieepa-to-section-122

**Sección 122 y Sección 301 trabajo forzoso**
- https://www.fennemorelaw.com/new-u-s-tariffs-replace-expiring-section-122-tariffs/
- https://www.industrialsage.com/section-122-tariff-expires-july-2026/
- https://globaltradealert.org/blog/forced-labour-section-301-final-action
- https://www.hklaw.com/en/insights/publications/2026/07/and-the-tariff-beat-goes-on
- https://www.akerman.com/en/perspectives/section-301-forced-labor-tariffs-set-to-cover-most-imports-into-the-u-s-starting.html
- https://www.chrobinson.com/en-us/resources/blog/section-301-forced-labor-tariffs/

**Costes de despacho aduanero**
- https://www.freightamigo.com/en/blog/logistics/navigating-customs-clearance-fees-in-the-usa-2026-complete-guide/
- https://customsbrokerindex.com/blog/how-much-does-a-customs-broker-cost/
- https://www.greenwich-mercantile.com/resources/guides/customs-broker-cost
- https://customscity.com/cbp-user-fee-increases-type-11-entry-updates-effective-october-2025/

**Dropshipping tras el de minimis**
- https://www.china-fulfillment.com/us-de-minimis-ended-2026-china-sellers-guide.html
- https://www.junfengfast.com/en/us-de-minimis-removal-impact.html
- https://www.dailyfulfill.com/dropshipping-in-usa-2026-all-you-should-know/

**Políticas de Google Merchant Center** (bloqueadas por el proxy — ábrelas tú)
- https://support.google.com/merchants/answer/6150118?hl=en — Abuso de la red
- https://support.google.com/merchants/answer/12077185 — Abuso de free listings
- https://support.google.com/merchants/answer/6150127?hl=en — Misrepresentation
- https://support.google.com/merchants/answer/11915823?hl=en — Restricciones por país
- https://support.google.com/merchants/answer/12652277?hl=en — País de venta objetivo
- https://ppc.land/google-shopping-duplication-tactic-sparks-policy-compliance-warnings/
- https://feedarmy.com/kb/the-dangers-of-duplicate-listings-in-google-shopping-dont-fall-for-the-hype/
- https://keycommerce.com/google-merchant-center-misrepresentation/
- https://stubgroup.com/blog/fix-your-google-merchant-center-misrepresentation-suspension/

**Benchmarks de conversión y CPC**
- https://www.koongo.com/blog/google-shopping-statistics-2026-users-revenue-ctr-cpc-and-performance-benchmarks/
- https://foundrycro.com/blog/google-shopping-benchmarks-by-category-2026/
- https://coreppc.com/blog/google-ads-benchmarks-ecommerce-2026/
- https://www.skailama.com/blog/ecommerce-conversion-rate-by-industry

**Plataforma y pagos**
- https://help.shopify.com/en/manual/payments/shopify-payments/supported-countries/spain/payment-methods
