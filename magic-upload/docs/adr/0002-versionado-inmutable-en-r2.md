# ADR-0002 — Versionado inmutable en R2 con puntero atómico

**Estado:** Aceptada · **Fecha:** 2026-08-09

## Contexto

Una publicación escribe entre uno y varios miles de objetos en R2. R2 no tiene
transacciones ni escrituras multiobjeto atómicas.

Si escribiéramos sobre el prefijo del sitio en sitio (`sites/{siteId}/…`), durante
varios segundos el sitio estaría mezclando archivos nuevos y viejos. Para el caso de
uso principal del producto — **una agencia enseñando una propuesta a su cliente** —
eso significa que el cliente puede recargar justo entonces y ver el CSS antiguo con el
HTML nuevo. Es un fallo peor que no publicar: destruye la impresión que el usuario
estaba pagando por causar.

Además queremos historial y rollback, y no queremos construir un subsistema aparte
para ello.

## Decisión

**Cada publicación escribe un prefijo nuevo e inmutable. Solo al terminar se mueve un
puntero.**

```
sites/{siteId}/{versionId}/index.html
sites/{siteId}/{versionId}/assets/app.css
```

- `versionId` es un **ULID**: ordenable por tiempo, sin coordinación, sin colisiones.
- **Nada se sobrescribe nunca.** Un prefijo de versión, una vez escrito, no se toca.
- La conmutación es un `UPDATE sites SET active_version_id = …` en una transacción.
  Hasta ese `COMMIT`, el visitante ve la versión anterior **íntegra**.
- Tras el commit se reescribe el registro en KV y se purga la caché de borde.
- Las versiones anteriores **se conservan**.

## Consecuencias

**A favor**

- **La publicación es atómica de cara al visitante.** Nunca se ve el sitio a medias.
- **Historial y rollback salen gratis.** "Restaurar" es apuntar el puntero a un
  `versionId` anterior: es instantáneo, no re-sube nada y no puede fallar a medias.
- **La URL es estable entre re-subidas.** El `siteId` y el subdominio no cambian
  aunque cambie la versión. Es nuestra ventaja frente a Vercel Drop, que crea un
  proyecto nuevo en cada arrastre; no la regalamos.
- **Cacheo agresivo sin riesgo de contaminación.** Los assets bajo un prefijo
  versionado son inmutables por construcción, así que pueden ir con
  `Cache-Control: max-age=31536000, immutable`. Al publicar, la URL del asset cambia,
  así que no hay que invalidar nada.
- Una publicación fallida no deja el sitio roto: simplemente no se conmuta el puntero.
- Deduplicación posible por checksum: re-subir lo mismo puede reutilizar la versión.

**En contra**

- **El almacenamiento crece con cada publicación.** Es el coste real de esta decisión
  y hay que gestionarlo, no ignorarlo (ver política de retención abajo).
- El documento HTML no puede cachearse de forma inmutable: se sirve con `no-cache` y
  revalidación, porque su URL sí es estable. Solo los assets versionados van
  inmutables.
- KV es *eventually consistent*: puede haber unos segundos en los que un borde sirva
  aún la versión anterior. Es aceptable — la versión anterior es un estado válido y
  completo, no un estado roto. Es exactamente el fallo que queríamos.

## Política de retención de versiones

`TODO: confirmar con product owner.` Propuesta de partida, coherente con
[ADR-0007](0007-degradacion-sin-destruccion.md) (nunca destruimos trabajo sin avisar):

| Plan | Versiones conservadas |
|---|---|
| Gratis | últimas 5 |
| Básico | últimas 20 |
| Pro | últimas 100 |
| Agencia | ilimitadas, o por antigüedad |

La versión activa **nunca** se purga, y la purga solo afecta a versiones que ya no son
la activa. Se ejecuta desde `apps/jobs`, con registro.

## Qué invalidaría esta decisión

- Que el coste de almacenamiento en R2 se desmadrara por sitios con miles de
  publicaciones. La respuesta correcta sería endurecer la retención, no volver a
  escribir en sitio.
- Que R2 ofreciera algún día conmutación atómica de prefijos, lo que simplificaría la
  implementación pero no cambiaría el modelo.
