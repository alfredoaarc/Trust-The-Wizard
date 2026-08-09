# CLAUDE.md — Magic Upload

Convenciones y reglas permanentes de este proyecto. Léelo al empezar cada sesión que
toque `magic-upload/`.

## Dónde estás

Magic Upload vive en `magic-upload/`, dentro del repositorio `Trust-The-Wizard`. La
raíz del repositorio contiene **otro** proyecto: la landing de Conjure, publicada por
GitHub Pages desde `../docs/`. **No la toques.** Ver
[ADR-0006](docs/adr/0006-monorepo-en-subdirectorio.md).

**Todos los comandos se ejecutan desde `magic-upload/`.** Es el error fácil de cometer.

## Estado actual

Fase 0 entregada, y adelantada la lógica pura que no depende de credenciales externas
ni de las decisiones abiertas del PO.

| Paquete | Estado |
|---|---|
| `packages/config` | Dominios, límites duros de seguridad, tabla MIME |
| `packages/i18n` | Formatos españoles, con tests |
| `packages/ingest` | **Pipeline de seguridad completo**, con fixtures maliciosos reales |
| `packages/billing` | **Matriz fiscal + validación de NIF/CIF/NIE**. Solo lógica pura |
| `packages/quotas` | Límites de plan y comprobación previa a la subida |
| `packages/db` | **Migraciones de cuentas, sitios y facturación**, verificadas contra PostgreSQL real |

`pnpm test` → 282 tests en verde. `tsc --noEmit` limpio en los seis paquetes.

Los 41 tests de `packages/db` necesitan un PostgreSQL; si no lo hay, se **saltan con un
aviso** en lugar de fallar. Arráncalo con `packages/db/scripts/start-test-db.sh`.

**Lo que NO existe todavía, y a propósito:** `apps/web` y `apps/serve`. Necesitan
cuentas de Supabase, Cloudflare y Stripe que aún no hay.

**Decidido por el PO:** región **Fráncfort**; ofimática **como descarga con portada**;
`.php` **rechazado con mensaje explícito**; dominios **con placeholders** hasta que se
registren.

**No implementes emisión de facturas, Stripe ni PDF** hasta que el PO valide la matriz
fiscal con su asesoría. Es el punto de parada nº 2.

## Idioma — no es una preferencia, es el producto

| Qué | Idioma |
|---|---|
| Interfaz, emails, **mensajes de error**, checkout, estados vacíos, centro de ayuda | **Español** |
| Documentación y comentarios de código de dominio | **Español** |
| Código, nombres de variables, funciones, tablas, ramas y commits | **Inglés** |

- **Español como idioma base de next-intl**, no como traducción del inglés. El inglés
  vendrá después, si viene.
- **Nunca un `TODO: translate` en un merge.** Si el texto no está en español, no está
  terminado.
- Formatos españoles: fechas `dd/mm/aaaa`, decimales con coma, miles con punto, moneda
  `1.234,56 €` con el símbolo detrás y espacio.
- **Los mensajes de error del pipeline de subida son producto, no plomería.** Dicen qué
  archivo, por qué y qué hacer:

  > Tu PDF pesa 34 MB y tu plan permite 25 MB.
  > Con el plan Básico (8,99 €/mes) subirías hasta 100 MB.

  No: `Upload failed: file too large`.

## Reglas que no se negocian

Cada una tiene su ADR. Si vas a contradecir una, escribe un ADR nuevo que la sustituya
y pregunta al PO antes; no la deshagas en silencio.

1. **Dos dominios y dos cuentas de Cloudflare.** App en `magicupload.es`, contenido de
   usuario en `*.mgup.site`. Nunca contenido de usuario bajo el dominio corporativo, ni
   "temporalmente para una demo". [ADR-0001](docs/adr/0001-separacion-de-dominios.md)
2. **Escrituras versionadas e inmutables en R2 + puntero atómico.** Nada se sobrescribe.
   El visitante nunca ve el sitio a medias. [ADR-0002](docs/adr/0002-versionado-inmutable-en-r2.md)
3. **`apps/serve` no toca Postgres.** Lee de KV. El linter lo impide; no lo desactives.
   [ADR-0003](docs/adr/0003-kv-cache-postgres-fuente-de-verdad.md)
4. **Numeración de facturas sin huecos** (secuencia transaccional en Postgres, nunca un
   contador en la aplicación) y **facturas inmutables** (corregir = rectificativa).
   [ADR-0004](docs/adr/0004-modulo-de-facturacion-verifactu-ready.md)
5. **Analítica sin cookies.** Hash con sal rotada cada 24 h; la IP nunca se persiste. Se
   dice "sin cookies y sin banner", **nunca** "sin datos personales".
   [ADR-0005](docs/adr/0005-analitica-cookieless.md)
6. **Nunca destruimos el trabajo del usuario.** No hay modo preview destructivo; al
   cancelar se archiva 12 meses, no se borra. Esto **va a parecer** una ineficiencia
   optimizable; no lo es, y cambiarlo es decisión del PO.
   [ADR-0007](docs/adr/0007-degradacion-sin-destruccion.md)
7. **RLS activado en todas las tablas.** Ninguna se queda sin RLS "de momento".
8. **Los límites de plan viven en `plan_limits`**, no en constantes del código.

## Fuera de alcance — recuérdamelo si lo pido

No hacemos funciones serverless, ni backend, ni bases de datos de usuario, ni CMS, ni
e-commerce dinámico, ni firma electrónica, ni PHP. **La simplicidad es el producto.**
Cada vez que el PO pida algo que cruce esa línea, recuérdaselo antes de implementarlo.

Aplazado a v2/v3: generador de aviso legal y banner de cookies, marca blanca completa,
espacios por cliente, extensión de navegador, SCORM, constructor con IA.

## Nunca inventes un dato legal, fiscal o de precios

Si no lo sabes con certeza: `TODO: verificar con asesor`, y **dilo en el resumen del
slice**. No improvises una cláusula, un tipo impositivo, un plazo ni una cifra
normativa. En un producto cuyo argumento de venta es el cumplimiento, una afirmación
falsa sobre cumplimiento es el peor fallo posible.

Los documentos legales se generan como **borradores marcados como pendientes de
revisión por asesoría jurídica**.

## Cómo se trabaja

- **Rama por slice.** Nunca commits directos a `main`.
- **Commits convencionales en inglés:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
- La rama de desarrollo asignada para esta línea de trabajo es
  `claude/magic-upload-mvp-ivmbpr`.
- **Tests antes de darlo por terminado**, no después:
  - unidad para la **lógica fiscal** y la de **cuotas**,
  - integración para el **pipeline de ingesta**, con fixtures maliciosos reales,
  - e2e con Playwright para el camino crítico: **arrastrar → publicar → visitar**.
- **Criterio de terminado:** el PO tiene que poder recorrer el camino él mismo en local
  o en preview. Si no puede arrastrar un archivo y ver la URL funcionando, el slice no
  está terminado por muy verde que esté la suite.
- Al terminar cada slice: **resumen corto** de qué hiciste, qué decidiste y qué
  necesitas del PO.
- **Cuando una decisión tenga implicaciones de producto y no solo técnicas, pregunta.**
  No elijas por el PO.

## Puntos de parada

1. **Fase 0** (aquí): arquitectura, ADR, modelo de datos y plan. **Esperando validación.**
2. **Antes de la facturación** (Slice 8): la matriz de casos fiscales de
   [`docs/facturacion.md` §2](docs/facturacion.md#2-matriz-de-casos-fiscales) se entrega
   como tabla de tests verde y **la valida el PO con su asesoría antes de que exista
   código que cobre dinero**. Las facturas son inmutables: la lógica fiscal tiene que
   estar bien antes de emitir la primera.

## Fixtures de seguridad obligatorios

El pipeline de ingesta se prueba con archivos maliciosos reales en el repositorio:
`zip-slip.zip`, `zip-bomb.zip`, `symlink-escape.zip`, `nested-no-index.zip`,
`fake-extension.zip` (ejecutable con extensión `.png`), `deep-nesting.zip`.

## Comandos

Todos desde `magic-upload/`.

```bash
pnpm install
pnpm test           # Vitest. Genera los fixtures antes (pretest)
pnpm fixtures       # Regenera los ZIP maliciosos de packages/ingest
pnpm typecheck      # tsc --noEmit en todos los paquetes
pnpm test packages/billing    # Solo la matriz fiscal (punto de parada nº 2)

packages/db/scripts/start-test-db.sh   # PostgreSQL desechable para los tests de esquema
pnpm test packages/db                  # RLS, numeración sin huecos, inmutabilidad
```

Pendientes hasta que existan `apps/web` y `apps/serve`: `pnpm dev`, `pnpm test:e2e`,
`pnpm db:migrate`.

Los fixtures maliciosos **no se versionan**: se generan con `pnpm fixtures` (requiere
Python 3). El motivo está en `packages/ingest/scripts/build-fixtures.py`.

## Placeholders pendientes

Centralizados en `packages/config`. Cambiarlos debe ser una variable, no un refactor.

| Marcador | Uso |
|---|---|
| `magicupload.es` | App, marketing, panel |
| `mgup.site` | Contenido de usuario |
| Región Supabase | Fráncfort o Irlanda |
| 0 / 8,99 / 19 / 39 € | Precios orientativos, sin confirmar |
