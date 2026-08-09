# Magic Upload se ha mudado

Magic Upload ya no vive en este repositorio. Está en:

**<https://github.com/alfredoaarc/magic-upload>** (privado)

## Qué pasó

Nació aquí, en `magic-upload/`, porque este repositorio ya contenía la landing de
Conjure y su `docs/` se publica en `trustthewizard.com`: escribir ahí la arquitectura y
la tabla de precios las habría dejado servidas en abierto.

Se movió a su propio repositorio en cuanto llegó el momento de tener secretos de
despliegue y configuración de producción, que es mucho más limpio que nazcan donde
pertenecen. El razonamiento completo está en el `docs/adr/0008-repositorio-propio.md`
del repositorio nuevo.

## El historial no se ha perdido

La migración se hizo con `git subtree split`, así que los 11 commits originales están
en el repositorio nuevo con sus fechas, autores y mensajes intactos. Los commits de
esta rama siguen siendo válidos como archivo, pero **el trabajo continúa allí**.

## Este repositorio

Sigue siendo el de **Conjure**: la landing en `docs/`, publicada por GitHub Pages en
`trustthewizard.com`. No se ha tocado nada de eso.
