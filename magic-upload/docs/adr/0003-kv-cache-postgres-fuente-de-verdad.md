# ADR-0003 — KV como caché de servido, Postgres como fuente de verdad

**Estado:** Aceptada · **Fecha:** 2026-08-09

## Contexto

Para responder a una visita, el Worker necesita saber: qué versión está activa, si el
sitio existe, si ha caducado, si está suspendido, si tiene contraseña y qué banderas
de servido tiene.

Hay dos sitios donde puede leer eso:

- **Postgres (Supabase).** Es la fuente de verdad, pero está en una región concreta de
  la UE, exige una conexión de red desde el Worker, y **si se cae, se caen todos los
  sitios publicados con él**.
- **Cloudflare KV.** Replicado en el borde, latencia de lectura de milisegundos, pero
  *eventually consistent*.

El requisito de producto es que **los sitios servidos sobrevivan a una caída del
panel**. Un freelance que enseña una propuesta a su cliente un viernes a las 19:00 no
debe verse afectado porque nuestro Postgres esté en mantenimiento.

## Decisión

**Postgres es la fuente de verdad. KV es una caché derivada. El camino de servido lee
exclusivamente de KV y nunca consulta Postgres.**

- Clave `site:{host}`, una por subdominio y una por dominio propio. El contrato del
  registro está en [`DATA-MODEL.md` §9](../DATA-MODEL.md#9-contrato-del-registro-en-kv).
- KV se reescribe en cada publicación, cambio de banderas, suspensión, renombrado,
  caducidad y cambio de plan.
- **El registro en KV no contiene ningún dato personal**, solo identificadores y
  banderas. KV replica globalmente, incluso fuera de la UE, así que esta restricción
  es de cumplimiento, no de diseño.
- Si KV y Postgres divergen, **gana Postgres**. Un trabajo periódico en `apps/jobs`
  reconcilia y deja registro de la divergencia; una divergencia recurrente es un bug,
  no ruido.
- **Restricción de dependencias en el monorepo:** `apps/serve` no puede importar
  `packages/db`. Si un día puede, alguien acabará añadiendo "una consulta rapidita" a
  Postgres en el camino de servido y este ADR quedará muerto en la práctica sin que
  nadie lo derogue. Se hace cumplir en el linter, no con buena voluntad.

## Consecuencias

**A favor**

- Latencia de servido de milisegundos, sin conexiones a base de datos desde el borde.
- **Un panel caído no tumba los sitios publicados.** Es la propiedad que motiva toda
  la decisión.
- Sin límite práctico de conexiones: el Worker escala a cualquier volumen de visitas
  sin tocar el pool de Postgres.
- Superficie de datos personales en el borde: cero.

**En contra**

- **Existe una ventana de inconsistencia** tras publicar (segundos). Es aceptable:
  el estado obsoleto es la versión anterior completa, no un estado roto
  ([ADR-0002](0002-versionado-inmutable-en-r2.md)).
- **La suspensión por moderación no es instantánea.** Para el interruptor de
  emergencia, el retardo de KV importa: hay que escribir en KV **antes** de responder
  al operador, y confirmar la propagación. Si en la práctica resulta insuficiente, la
  respuesta es Durable Objects para el flag de suspensión, no consultar Postgres.
- Doble escritura en cada publicación. Si la escritura en KV falla tras el commit de
  Postgres, el sitio queda servido en la versión anterior — degradación aceptable —,
  pero **hay que reintentar y alertar**, no tragarse el error.
- Hay dos representaciones del estado de un sitio. El contrato de KV está
  documentado y versionado precisamente por eso.

## Qué invalidaría esta decisión

- Que el retardo de propagación de KV resultara inaceptable para la suspensión por
  abuso, con incidentes reales. Solución: Durable Objects para ese flag concreto.
- Que Cloudflare ofreciera un almacén de borde consistente y con precio razonable.
  Se reevaluaría el mecanismo, **no** el principio de que el camino de servido no
  toca la base de datos del panel.
