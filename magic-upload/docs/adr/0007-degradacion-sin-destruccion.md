# ADR-0007 — Degradación sin destrucción al cancelar

**Estado:** Aceptada · **Fecha:** 2026-08-09

## Contexto

Tiiny Host hace dos cosas que le han generado sus peores reseñas públicas:

1. Publica en **"modo preview"** el contenido que excede el plan gratuito y lo tira a
   los 60 minutos, sin avisar antes de subir.
2. **Borra permanentemente todos los proyectos** cuando cancelas la suscripción.

Las reseñas resultantes usan literalmente las palabras *"¡TRAMPA!"* y *"es una
ESTAFA"*. Ese es un regalo competitivo: el mercado ya nos ha dicho dónde duele.

Nuestro cliente objetivo es una agencia cuyo trabajo publicado **es** el entregable a
su cliente. Que desaparezca por dejar de pagar 9 € un mes no es una política de
producto: es una llamada de teléfono muy incómoda entre nuestro usuario y su cliente,
provocada por nosotros.

## Decisión

**Nunca destruimos el trabajo del usuario. Ni al exceder el plan, ni al cancelar.**

### Al exceder el límite del plan

- Se avisa **antes de subir**, con el tamaño exacto del archivo, el límite del plan
  actual y **qué plan concreto lo permitiría y a qué precio**.
- **No existe el modo preview destructivo.** No se publica nada que vayamos a tirar
  en una hora.

  > Tu PDF pesa 34 MB y tu plan permite 25 MB.
  > Con el plan Básico (8,99 €/mes) subirías hasta 100 MB.

### Al cancelar o caducar una suscripción

1. La cuenta pasa a plan **gratuito**.
2. **Se conserva activo el sitio principal**: el que elija el usuario, o por defecto
   el más visitado.
3. El resto se **archiva**: deja de servirse, pero **se conserva y es recuperable
   durante 12 meses**.
4. Se avisa por email **en el momento del archivado** y de nuevo **a los 11 meses**,
   antes de que expire la ventana.
5. Recuperar un sitio archivado es volver a suscribirse, o mover el sitio principal.
   Un clic, sin soporte de por medio.

En el esquema: `sites.archived_at` y `sites.purgeable_at = archived_at + 12 meses`.

## Consecuencias

**A favor**

- Es una promesa que se puede escribir en la home, y **la competencia no puede
  copiarla sin admitir que su política era mala**.
- Elimina el motivo más común de reseña de una estrella en esta categoría.
- Un usuario archivado es un usuario recuperable: la reactivación es un embudo real,
  el borrado no.

**En contra**

- **Pagamos almacenamiento por sitios que no generan ingresos**, hasta 12 meses. Es un
  coste real y aceptado. R2 es barato y estos sitios son pequeños; si algún día no lo
  fuera, la respuesta correcta es acortar la ventana **avisando**, no volver al
  borrado silencioso.
- Más estados que gestionar (`archived` frente a `deleted`) y trabajos periódicos de
  aviso.
- El borrado voluntario por el usuario sí es inmediato y definitivo, y así se le dice.
  Esta política protege del borrado **que no pidió**, no de su propia decisión.

## Nota deliberada para quien venga después

Esto **no es una ineficiencia pendiente de optimizar.** Va a parecerlo: alguien
mirará el coste de R2 en sitios archivados y propondrá purgar a los 30 días. Cuando
llegue ese momento, esta decisión es un argumento de marca cuantificado en reseñas de
la competencia, y cambiarla es una decisión de product owner, nunca de refactor.

El mismo comentario va escrito en el código que implemente el archivado, junto a
`purgeable_at`, y en `CLAUDE.md`.

## Qué invalidaría esta decisión

- Abuso: cuentas que suben terabytes, cancelan y usan el archivo de 12 meses como
  almacenamiento gratuito. Respuesta: tope de bytes archivados por cuenta en el plan
  gratuito, **avisado**, no acortar la ventana para todos.
- Una obligación legal de supresión (art. 17 RGPD, orden judicial, contenido ilícito).
  Prevalece siempre sobre esta política.
