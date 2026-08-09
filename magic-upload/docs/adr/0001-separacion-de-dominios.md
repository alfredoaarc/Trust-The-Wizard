# ADR-0001 — Separación de dominios y cuentas: app frente a contenido de usuario

**Estado:** Aceptada · **Fecha:** 2026-08-09

## Contexto

Magic Upload permite publicar HTML arbitrario en segundos. Eso lo convierte en un
imán para el phishing, y el riesgo no es hipotético: el fundador de Tiiny Host ha
declarado públicamente que **su cuenta de AWS ha estado al borde de la suspensión por
usuarios maliciosos**, y que *"un par de enlaces malos pero muy difundidos pueden
meter tu dominio en miles de listas de bloqueo"*. Por eso ellos sirven la aplicación
en `tiiny.host` y el contenido de usuario en `tiiny.site`.

El daño de un dominio en listas de bloqueo no es un incidente pasajero: los correos
transaccionales dejan de entregarse, los navegadores muestran interstitials rojos, y
salir de esas listas depende de terceros y tarda semanas.

## Decisión

**Dos dominios y dos cuentas de proveedor, separados de arriba abajo.**

| | Dominio | Cuenta Cloudflare | Bucket R2 |
|---|---|---|---|
| App, marketing, panel, API, MCP | `magicupload.es` | cuenta *app* | `mu-app-*` |
| Contenido de usuario y dominios propios de cliente | `*.mgup.site` | cuenta *content* | `mu-sites` |

Reglas duras que se derivan:

1. **El contenido de usuario nunca se sirve desde un subdominio del dominio
   corporativo.** Ni siquiera "temporalmente para una demo".
2. **Cuentas de Cloudflare separadas**, no solo zonas separadas. Una suspensión por
   abuso en la cuenta de contenido no puede llevarse por delante el panel, el
   checkout ni el correo.
3. **Buckets de R2 separados**, con credenciales distintas. El bucket de contenido no
   guarda nada de la aplicación.
4. **El correo transaccional sale de un tercer dominio o subdominio de envío**, nunca
   del dominio de contenido.
5. Las cookies de sesión de la app tienen `Domain=magicupload.es`. Al vivir el
   contenido de usuario en un dominio distinto, **ningún HTML subido por un usuario
   puede leer ni escribir cookies de la aplicación**, ni siquiera con un subdominio
   comodín mal configurado. Esta es la segunda razón, y es de seguridad, no de
   reputación.
6. El dominio de contenido es **deliberadamente desechable**. Se elige corto y barato
   precisamente porque puede acabar quemado; sustituirlo debe ser cambiar una variable
   en `packages/config` y migrar registros DNS, no un refactor.

## Consecuencias

**A favor**

- Una crisis de abuso queda contenida en el plano de datos. El negocio sigue en pie.
- Aislamiento de origen entre el HTML del usuario y la sesión del usuario, gratis.
- Podemos aplicar CSP y cabeceras agresivas en el dominio de contenido sin
  condicionar lo que necesita la aplicación.

**En contra**

- Dos dominios que registrar, renovar y vigilar.
- Dos cuentas de Cloudflare que administrar, con facturación y credenciales separadas.
- El despliegue toca dos cuentas; CI necesita dos juegos de secretos.
- No podemos compartir sesión entre `magicupload.es` y el contenido servido. La
  contraseña de sitio usa su propia cookie firmada por sitio, en el dominio de
  contenido. Es una consecuencia buscada, no un efecto colateral.

## Qué invalidaría esta decisión

Prácticamente nada dentro del alcance del MVP. Lo que sí conviene revisar en su
momento:

- Si el coste de Cloudflare for SaaS por hostname resultara prohibitivo **solo** en
  una configuración multicuenta, habría que medirlo antes de tocar nada. Aun así, la
  respuesta correcta sería renegociar el plan, no unificar dominios.

## Nota para quien venga después

Esta es exactamente la clase de decisión que alguien intentará "simplificar" dentro
de seis meses: *"¿para qué dos dominios, si podemos servirlo todo desde
`sites.magicupload.es`?"*. La respuesta está arriba y el precio de equivocarse es el
dominio corporativo en listas de bloqueo. **No se unifica.**
