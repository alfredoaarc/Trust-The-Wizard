# ADR-0005 — Analítica cookieless con hash de visitante y sal rotada

**Estado:** Aceptada · **Fecha:** 2026-08-09

## Contexto

La analítica por visitante es la palanca de precio del producto: es lo que convierte
*"hosting a 9 €"* en *"seguimiento de propuestas a clientes a 39 €"*, que es otra
categoría de disposición a pagar. Necesitamos saber que **el mismo** visitante volvió
tres veces, no solo que hubo tres visitas.

La forma habitual de conseguirlo es una cookie. Y una cookie tiene un coste que aquí
es prohibitivo: **obliga al sitio del usuario a llevar banner de consentimiento**. Un
freelance que publica una propuesta de una página no va a montar un banner de cookies,
y un banner en la propuesta de una agencia es exactamente la impresión que no quiere
dar.

## Decisión

**Analítica sin cookies y sin nada almacenado en el navegador, desde el diseño y no
como opción.**

```
visitor_hash = HMAC(sal_del_día, IP ‖ user-agent ‖ site_id)
```

- La **sal rota cada 24 horas**. Vive como secreto del Worker, nunca en la base de
  datos junto a los hashes.
- **La sal anterior no se conserva.** Pasadas 24 h, reidentificar a un visitante a
  partir de su hash es irreversible incluso para nosotros.
- El `site_id` entra en el hash, de modo que **el mismo visitante en dos sitios
  distintos produce hashes distintos**. No hay seguimiento entre sitios, ni podemos
  construirlo después.
- Sin cookies, sin `localStorage`, sin `sessionStorage`, sin fingerprinting de canvas
  ni nada equivalente.
- El evento se emite con `ctx.waitUntil()` a una Queue; **la respuesta al visitante
  nunca espera** a la analítica.
- La IP en crudo **no se persiste nunca**. Entra en el HMAC y se descarta.

## Consecuencias comerciales, y la línea que no se cruza

Esto habilita una afirmación fuerte y verdadera para la web:

> **Un sitio alojado en Magic Upload, sin cookies ni scripts de terceros, no necesita
> banner de cookies.**

Y obliga a una honestidad igual de explícita en la documentación:

> El hash de IP sigue siendo **dato personal seudonimizado** bajo el RGPD. Requiere
> base jurídica, información en la política de privacidad y cobertura en el DPA.

**Se vende como "sin cookies y sin banner". Nunca como "sin datos personales".** La
segunda afirmación sería falsa, y en un producto cuyo argumento de venta es el
cumplimiento, una afirmación falsa sobre cumplimiento es el peor fallo posible.
`TODO: verificar con asesor` la redacción exacta antes de publicarla.

## Consecuencias técnicas

**A favor**

- Cero fricción para el visitante y cero obligación de banner para el usuario.
- Superficie de datos personales mínima y con caducidad estructural.
- Sin dependencia de un tercero de analítica: menos subencargados en la lista pública.

**En contra**

- **La identidad de visitante se pierde a las 24 h.** Un cliente que abre la propuesta
  el lunes y el jueves cuenta como dos visitantes salvo que unamos sesiones. La unión
  entre días se hace por continuidad de sesión dentro de la ventana de la sal, y más
  allá se **estima**, no se afirma. La interfaz tiene que decir "visitas" donde no
  podemos afirmar "visitante único".
- **IP compartida = colisión.** Dos personas en la misma oficina con el mismo
  navegador y versión producen el mismo hash. Es una limitación real y se documenta;
  no se compensa añadiendo señales de fingerprinting, que es justo lo que evitamos.
- **IP móvil cambiante = doble conteo.** El mismo efecto en sentido contrario.
- La profundidad de scroll y el tiempo en página exigen un script en el sitio servido.
  Ese script lo inyecta el Worker, es propio, no es de terceros, y **es desactivable
  por sitio**.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Cookie de primera parte | Obliga a banner de consentimiento. Mata el argumento de venta. |
| Plausible / Fathom autoalojados | Solo dan agregados; no dan la vista por visitante, que **es** el producto. |
| Fingerprinting de navegador | Más invasivo que una cookie y peor defendible ante la AEPD. Contradice el posicionamiento. |
| Sal permanente en vez de rotada | Permitiría seguimiento indefinido. La rotación es lo que hace la seudonimización defendible. |

## Qué invalidaría esta decisión

- Un criterio de la AEPD o del CEPD que considerara insuficiente la rotación de 24 h.
  Respuesta: acortar la ventana o pedir consentimiento explícito, **no** volver a
  cookies por defecto.
- Que la pérdida de identidad a las 24 h resultara inaceptable para el caso de uso de
  seguimiento de propuestas. Respuesta: un enlace con identificador por destinatario
  (`?p=…`) que el usuario genera y comparte a sabiendas — con consentimiento del
  emisor y sin rastreo pasivo. Sería una función nueva, no un cambio de este diseño.
