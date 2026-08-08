# Recomendación — qué hacer con los 300 €

**Fecha:** 8 de agosto de 2026
**Objetivo revisado del usuario:** (1) encontrar un producto ganador, (2) no perder los 300 €, (3) recuperarlos, (4) maximizar beneficio después, alimentando al ganador.

Mismas etiquetas de fiabilidad que en `fase-0-reality-check.md`. El proxy de red sigue impidiendo abrir fuentes directamente: todo `[CONCORDANTE]` significa "coincide en ≥2 resultados de búsqueda", no "leído en fuente primaria".

---

## Primero: corrijo mi recomendación anterior

En la Fase 0 te propuse como mejor alternativa el **print-on-demand / producto digital**. He pasado ambos por la misma aritmética que usé para matar el plan original y **no sobreviven**. Los datos:

**Producto digital descargable:** los eBooks y libros digitales (PDF, ePub, MOBI) son **contenido no admitido en Google Shopping**. `[CONCORDANTE]` No es que convierta mal: es que no puedes anunciarlo en el canal. Muerto por política, no por números.

**Print-on-demand**, con costes base reales de Printful/Printify 2026 `[CONCORDANTE]` y CPC de mercado USA de 0,68 $:

| Producto | Coste base | Precio | Margen contrib. | CPA máx | CPA real @2 % | Resultado |
|---|---|---|---|---|---|---|
| Camiseta (Printify) | 8,00 $ + 3,99 envío | 28 $ | 13,50 $ | 6,75 $ | 34,00 $ | ❌ |
| Camiseta (Printful) | 12,00 $ + 3,99 | 28 $ | 9,50 $ | 4,75 $ | 34,00 $ | ❌ |
| Taza (Printify) | 3,68 $ + 4,50 | 19,99 $ | 9,93 $ | 4,97 $ | 34,00 $ | ❌ |
| Camiseta premium | 8,00 $ + 3,99 | 45 $ | 29,15 $ | 14,58 $ | 34,00 $ | ❌ |

**El POD falla por 5x.** Me equivoqué al recomendarlo sin pasarlo por el modelo. Lo corrijo aquí.

---

## La ley general del canal (esto es lo que hay que entender)

Toda la decisión se reduce a una identidad:

```
CPA = CPC ÷ tasa de conversión
```

No es una opinión ni depende del producto. Si el CPC es 0,68 $ y conviertes al 2 %, cada venta te cuesta 34 $ en publicidad. Punto. De ahí sale el **suelo de facturación que el canal exige**:

| Mercado | CPC | Conversión | CPA | AOV para **empatar** | AOV para **ganar** |
|---|---|---|---|---|---|
| USA | 0,68 $ | 1 % | 68 $ | 124 $ | 247 $ |
| USA | 0,68 $ | 2 % | 34 $ | 62 $ | 124 $ |
| USA | 0,88 $ | 1 % | 88 $ | 160 $ | 320 $ |
| USA | 0,88 $ | 2 % | 44 $ | 80 $ | 160 $ |
| **España/UE** | **0,36 €** | 1 % | 36 € | **65 €** | 131 € |
| **España/UE** | **0,36 €** | 2 % | 18 € | **33 €** | 65 € |
| España/UE | 0,41 € | 2 % | 20,50 € | 37 € | 75 € |

(AOV calculado a 55 % de margen bruto. "Empatar" = margen de contribución ≥ CPA. "Ganar" = te quedas la mitad.)

**El dato que decide todo:** el CPC de Shopping en ecommerce europeo ronda **0,36–0,41 €**, frente a **0,66–0,88 $** en EE. UU. `[CONCORDANTE]` **Aproximadamente la mitad.** Y esto sin contar que en la UE no hay aranceles, ni entrada aduanera, ni fianzas, ni un envío de 8–20 $ por paquete.

---

## RECOMENDACIÓN

> ## Mantén Google Shopping. Cambia el mercado a España/UE. No compres stock. Testea 4 productos en serie.
>
> **España no es renunciar a Estados Unidos. Es el laboratorio barato donde encuentras el ganador que luego llevas a Estados Unidos** — cuando tengas margen validado y capital para stock en un 3PL americano. Buscar el ganador en el mercado más caro del mundo, con aduanas de por medio y con presupuesto para un solo intento, es el error de secuencia.

### Por qué, en datos

| | EE. UU. | España/UE |
|---|---|---|
| CPC Shopping | 0,66–0,88 $ | 0,36–0,41 € |
| AOV mínimo para empatar @2 % | 62–80 $ | **33–37 €** |
| Arancel al consumidor | 10–27 % según origen | **0 % intra-UE** |
| Despacho aduanero por paquete | 10–150 $ + fianza | **ninguno** |
| Envío | 8–42 $ | 4–6 € |
| Clics que compran 300 € | ~350 | **~667** |
| **Productos que puedes testear** | **1** | **4–5** |
| Riesgo de suspensión GMC | Alto (perfil extranjero sin marca) | Bajo (negocio local, dirección real) |

Con el mismo dinero pasas de **un** intento a **cuatro o cinco**. Si la probabilidad de que un producto cualquiera funcione es del 20 %, un intento te da un 20 % de encontrar ganador; cinco intentos te dan un 67 %. `[ESTIMACIÓN]` — probabilidad compuesta, el 20 % es ilustrativo, no medido.

Y el riesgo de suspensión baja mucho: pasas de ser "un extranjero sin marca vendiendo a EE. UU. desde un dominio de tres días" a un negocio español con dirección física real vendiendo en su propio país, que es justo lo que los filtros antifraude de GMC quieren ver.

---

## Cómo se protege el dinero

**La regla que más protege los 300 € no es de marketing, es de inventario: nunca compres stock por adelantado.**

Comprando stock, el 100 % del capital está en riesgo si el producto falla. Sin stock, pagando el COGS solo después de que entre una venta, **lo único en riesgo es el gasto publicitario**. Ese es el cambio estructural que convierte "puedo perder 300 €" en "puedo perder 255 € en el peor caso, y bastante menos si mato rápido".

Necesitas por tanto proveedor **dentro de la UE, sin pedido mínimo**, que envíe unidad a unidad. Eso descarta comprar contenedores y descarta la mayoría de proveedores chinos.

### Reparto del presupuesto

| Concepto | Coste | Nota |
|---|---|---|
| Dominio .com (1 año) | 12 € | |
| Plataforma, 3 meses | 3 € | Shopify suele ofrecer promo de 1 €/mes los 3 primeros. Si no la pillas, son ~90 € y hay que recortar publicidad. Verifícalo antes. |
| Reserva COGS primera venta | 45 € | **No se gasta si no vendes.** Y si vendes, lo cubre la propia venta. |
| **Publicidad** | **240 €** | |
| **Total** | **300 €** | |

**Peor caso realista: 255 € perdidos** (240 € de publicidad + 15 € de fijos), no 300 €. Y solo si los cuatro productos fallan y agotas el presupuesto sin matar antes.

### Protocolo de test: 4 disparos secuenciales, no en paralelo

Regla de tres estadística: si tras **N** clics no hay ninguna venta, puedes descartar con 95 % de confianza que la conversión supere **3/N**.

- **150 clics por producto** → descarta conversión > 2 %. A 0,36 € de CPC son **54 € por test**.
- 240 € ÷ 54 € = **4,4 productos testeados**.

**Regla de muerte:** 150 clics sin venta → producto muerto, se corta, se pasa al siguiente. Sin excepciones, sin "démosle un poco más".

**Regla de vida:** primera venta antes de los 150 clics → el producto pasa a la ronda siguiente y recibe el resto del presupuesto.

Secuencial y no en paralelo por una razón concreta: en paralelo, 240 € repartidos entre 4 productos dan 60 clics a cada uno, y 60 clics no descartan nada (solo conversión > 5 %). Cuatro tests inconcluyentes valen menos que uno concluyente.

### Gratis y desde el día 1: free listings

Google mantiene los **listados orgánicos gratuitos** en la pestaña Shopping, Búsqueda, Imágenes y YouTube — sin coste por clic. `[CONCORDANTE]` Solo requiere el feed bien montado en Merchant Center, que ya vas a hacer. Es tráfico gratis que alarga la vida del presupuesto. Configúralo aunque no te traiga mucho al principio.

---

## Criterios de producto, recalculados para España

Estos sustituyen a los de tu Fase 1 original. Un producto pasa solo si cumple **todos**:

1. **PVP entre 35 € y 75 €.** Por debajo de 33 € no cubres el CPA ni empatando. Por encima de 75 € la conversión cae y necesitas más clics para validar.
2. **Margen bruto ≥ 55 %.** Es lo que exige la tabla del suelo del canal.
3. **Proveedor en la UE sin pedido mínimo.** Innegociable: es lo que impide que pierdas el capital.
4. **Demanda de búsqueda transaccional en España**, evergreen o con la estación a favor en 90 días.
5. **Anuncios de Shopping actuales mediocres.** Sigue siendo válido: es el hueco, y sin hueco no hay tesis.
6. **Ligero, sin talla, sin batería de litio, sin ingesta, sin normativa, sin marca registrada.** Los mismos filtros de riesgo de tu brief original — siguen siendo correctos.

---

## Lo que 300 € NO compran, dicho claro

**Compran un cribado, no una medición.**

150 clics te permiten **eliminar** productos malos con confianza. No te permiten **confirmar** que uno es bueno: con 150 clics y una venta, tu estimación de conversión tiene un intervalo tan ancho que no distingues un 0,7 % de un 4 %. Para medir de verdad harían falta del orden de 2.000–3.000 clics por producto. `[ESTIMACIÓN]` — cálculo estándar de tamaño muestral para proporciones.

Así que el resultado honesto que puedes esperar de estos 300 €:

- **Escenario probable (los 4 mueren):** pierdes ~255 €, y sales con datos propios de CPC y conversión reales de tu nicho, que valen más que cualquier estimación de este documento.
- **Escenario bueno (uno sobrevive el cribado):** tienes un candidato, no un ganador confirmado. Confirmarlo exige una segunda ronda de 300–500 €.
- **Escenario improbable (uno vende con CM > CPA desde el test):** las ventas del propio test devuelven parte del gasto y tienes un producto que se autofinancia.

**"No perder los 300 €" no es un resultado que yo pueda garantizarte,** y desconfía de quien te lo garantice. Lo que sí puedo hacer es lo que hay arriba: bajar el coste fijo de 150 € a 15 €, eliminar por completo el riesgo de inventario, y multiplicar por cuatro los intentos que compra el mismo dinero.

---

## La secuencia completa, hasta EE. UU.

1. **Ahora (300 €):** cribado de 4 productos en España. Salida: un candidato y datos propios reales.
2. **Si sale candidato (300–500 €):** confirmarlo en España con volumen suficiente para medir de verdad la conversión. Salida: un ganador con margen conocido.
3. **Escalado horizontal legítimo (reinvirtiendo beneficio):** ampliar catálogo real dentro de la misma línea — referencias nuevas con su GTIN, su página y su stock. **Nunca clonando SKUs**, que es abuso de red publicitaria y suspensión sin aviso.
4. **Entonces sí, EE. UU.:** con margen validado y capital para stock en un 3PL americano, el AOV de 62–80 $ que exige aquel mercado deja de ser un obstáculo, porque ya sabes que tu producto convierte y cuánto margen aguanta. La barrera de EE. UU. no era el producto: era intentar descubrirlo allí.

---

## Fuentes nuevas de este documento

Consultadas vía buscador el 8 ago 2026, ninguna abierta directamente (proxy de red).

**Política de productos digitales en Shopping**
- https://support.google.com/merchants/answer/6150006?hl=en — Contenido no admitido
- https://support.google.com/merchants/answer/6149970?hl=en — Políticas de Shopping ads

**Costes print-on-demand**
- https://podvector.ai/articles/printful/costs-and-charges/printful-printify-t-shirt-base-cost-full-breakdown-for-pod-sellers
- https://podvector.ai/articles/printful/costs-and-charges/the-complete-guide-to-printful-costs-and-fees-for-pod-sellers
- https://inkandpxl.com/blogs/feature/print-on-demand-2026-printify-vs-printful-the-definitive-profit-guide
- https://www.ecommerceceo.com/printful-pricing/

**CPC España / UE frente a EE. UU.**
- https://www.organikmarketing.es/cuanto-cuesta-google-ads-espana/
- https://azur360.com/blog/cuanto-cuesta-google-ads-en-espana-en-2026/
- https://misterads.es/cuanto-cuesta-google-ads/
- https://www.trackbee.io/blog/google-ads-cost
- https://coreppc.com/blog/google-ads-benchmarks-ecommerce-2026/
- https://www.koongo.com/blog/google-shopping-statistics-2026-users-revenue-ctr-cpc-and-performance-benchmarks/

**Free listings**
- https://feedops.com/feedops/google-shopping-free-listings/
- https://searchengineland.com/organic-shopping-insights-google-free-listings-458062
- https://feedonomics.com/blog/what-you-should-know-about-free-listings-on-google-shopping/
