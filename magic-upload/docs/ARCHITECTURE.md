# Arquitectura de Magic Upload

> Fase 0. Documento de diseño, pendiente de validación del product owner.
> Los nombres de dominio son marcadores; ver [Placeholders](#placeholders-pendientes-de-decidir).

## 1. Principio rector

**La simplicidad es el producto.** No hay funciones serverless de usuario, ni backend,
ni bases de datos, ni CMS, ni e-commerce dinámico, ni PHP. Servimos bytes estáticos y
nada más. Toda la complejidad de esta arquitectura existe para que el usuario no vea
ninguna.

De ahí se derivan las tres decisiones estructurales del sistema:

1. **Dos dominios y dos cuentas de Cloudflare separadas**, porque el contenido de
   usuario es un pasivo de reputación ([ADR-0001](adr/0001-separacion-de-dominios.md)).
2. **Escrituras inmutables versionadas en R2 con un puntero atómico**, porque una
   subida a medias vista por el cliente del usuario es peor que una subida fallida
   ([ADR-0002](adr/0002-versionado-inmutable-en-r2.md)).
3. **KV como caché de servido y Postgres como fuente de verdad**, porque si el panel
   se cae los sitios publicados tienen que seguir en pie
   ([ADR-0003](adr/0003-kv-cache-postgres-fuente-de-verdad.md)).

## 2. Mapa de componentes

```
                         ┌──────────────────── PLANO DE CONTROL ─────────────────────┐
                         │  Cuenta Cloudflare "app"  ·  dominio magicupload.es        │
                         │                                                            │
   Navegador ───────────▶│  ┌──────────────────────────────────────────────────────┐  │
   (usuario dueño        │  │ apps/web — Next.js 15 App Router (TypeScript)        │  │
    del sitio)           │  │  · Marketing (es) · Panel · Checkout · Centro ayuda   │  │
                         │  │  · Route Handlers: /api/v1/* (REST) · /api/mcp (MCP)  │  │
                         │  └───────┬────────────────────┬──────────────────┬──────┘  │
                         │          │                    │                  │         │
                         └──────────┼────────────────────┼──────────────────┼─────────┘
                                    │                    │                  │
                    ┌───────────────▼──┐   ┌─────────────▼────┐   ┌─────────▼────────┐
                    │ Supabase (UE)    │   │ Stripe           │   │ Cloudflare API   │
                    │ Postgres + Auth  │   │ Tarjeta · SEPA   │   │ · Custom Hostname│
                    │ + RLS            │   │ Bizum (anual)    │   │ · Purge KV/caché │
                    │ FUENTE DE VERDAD │   └──────────────────┘   └──────────────────┘
                    └───────┬──────────┘
                            │  publicación → sincroniza
                            ▼
            ┌───────────────────────────────────────────────────────────────┐
            │            PLANO DE DATOS (cuenta Cloudflare "content")       │
            │            dominio *.mgup.site + dominios propios             │
            │                                                               │
 Visitante ─┼─▶ ┌──────────────────────┐   lee    ┌──────────────────────┐   │
 (cliente   │   │ apps/serve — Worker  │─────────▶│ KV  site-meta        │   │
  final)    │   │  resolver → guardas  │          │  (caché, ~ms)        │   │
            │   │  → asset → cabeceras │          └──────────────────────┘   │
            │   └──────┬──────────┬────┘                                     │
            │          │          │ lee bytes    ┌──────────────────────┐    │
            │          │          └─────────────▶│ R2 bucket "sites"    │    │
            │          │                         │ sites/{id}/{ver}/…   │    │
            │          │ waitUntil (no bloquea)  └──────────────────────┘    │
            │          ▼                                                     │
            │   ┌──────────────────────┐  ingesta  ┌─────────────────────┐   │
            │   │ Queue: analytics     │──────────▶│ apps/ingest-analytics│  │
            │   └──────────────────────┘           │ → Postgres (UE)     │   │
            └──────────────────────────────────────┴─────────────────────┴───┘
```

### Paquetes del monorepo

```
magic-upload/
├── apps/
│   ├── web/               Next.js 15 — marketing, panel, checkout, API REST, MCP
│   ├── serve/             Cloudflare Worker — sirve *.mgup.site y dominios propios
│   └── jobs/              Worker con Cron Triggers: TTL, archivado, avisos, VIES
├── packages/
│   ├── db/                Migraciones SQL, tipos generados, cliente Supabase
│   ├── ingest/            Pipeline de ingesta: validar, extraer, escanear, escribir
│   ├── billing/           Motor fiscal, numeración, PDF, registro Verifactu-ready
│   ├── quotas/            Resolución de límites por plan desde BD
│   ├── analytics/         Hash de visitante, sesionización, consultas de informe
│   ├── moderation/        Heurísticas de phishing, listas de bloqueo, puntuación
│   ├── i18n/              Catálogos next-intl (es base), formatos españoles
│   ├── ui/                shadcn/ui compartido entre web y páginas del Worker
│   └── config/            Dominios, límites duros, constantes; un único sitio a tocar
└── docs/
```

**Regla de dependencias:** `apps/serve` solo puede importar de `packages/config` y
`packages/analytics` (la parte de hash). No puede importar `packages/db` — si un día
puede, alguien acabará consultando Postgres desde el camino de servido y romperemos
ADR-0003.

## 3. El flujo completo de una publicación

Del arrastre a la primera visita. Los tiempos son el presupuesto objetivo para un zip
de 25 MB; el requisito de producto es **URL viva en menos de 30 s**.

### Fase A — Antes de subir nada (0–200 ms, en el navegador)

1. El usuario suelta el archivo en la zona de arrastre.
2. El cliente lee `name`, `size` y los primeros bytes (número mágico) **sin subir nada**.
3. Consulta las cuotas de su plan (ya en memoria desde la carga del panel) y compara.
4. **Si excede, se para aquí y se dice antes de subir**, con el tamaño exacto y qué
   plan lo permitiría:

   > Tu PDF pesa 34 MB y tu plan permite 25 MB.
   > Con el plan Básico (8,99 €/mes) subirías hasta 100 MB.

   Nunca se publica algo que vayamos a tirar en una hora. No existe el "modo preview"
   destructivo — ver [ADR-0007](adr/0007-degradacion-sin-destruccion.md).
5. El usuario elige subdominio. Comprobación de disponibilidad en vivo contra
   `/api/v1/subdomains/check` (debounce 300 ms): minúsculas, dígitos y guiones, 3–63
   caracteres, sin guion inicial ni final, no en la lista de reservadas ni en la de
   términos que suplantan marcas.

### Fase B — Subida (1–15 s)

6. `POST /api/v1/uploads` devuelve una URL prefirmada de R2 (bucket de *staging*) y un
   `uploadId`. La app valida aquí, en servidor, cuota y límite de tamaño: el cliente
   no es autoridad.
7. El navegador sube **directo a R2** con la URL prefirmada. La barra de progreso es
   el progreso real del `XMLHttpRequest.upload`, no una animación. Reanudable por
   partes para archivos grandes.
8. Límite de velocidad por IP y por cuenta ya en este punto (ver §7).

### Fase C — Ingesta (2–10 s, `packages/ingest`)

`POST /api/v1/sites/{id}/versions` con el `uploadId`. Se ejecuta como trabajo con
estado consultable; el panel muestra el paso vivo.

9. **Validar el contenedor.** Tipo real por número mágico, no por extensión. Tamaño
   contra el límite del plan. Un `.html` suelto salta directamente al paso 14.
10. **Extraer con guardas duras**, entrada a entrada, abortando en cuanto se supera
    cualquiera de los umbrales, sin descomprimir el resto:
    - **Zip slip:** se resuelve la ruta destino y se comprueba que sigue dentro del
      directorio raíz. Se rechazan `../`, rutas absolutas, rutas con `..` tras
      normalizar, y nombres con separadores de Windows. **Los symlinks se rechazan**,
      no se siguen.
    - **Zip bomb:** ratio de compresión máximo por entrada y global, número máximo de
      entradas, tamaño descomprimido total máximo, profundidad de anidamiento.
    - **Extensiones bloqueadas:** `.exe`, `.apk`, `.dmg`, `.bat`, `.sh`, `.jar`,
      `.msi`, `.com`, `.scr`, `.ps1`, y cualquier cosa cuyo número mágico sea un
      ejecutable (ELF, Mach-O, PE) aunque la extensión mienta.
    - **Nada de ejecución:** no hay PHP, no hay CGI, no hay build. Un `.php` se
      almacena como fichero inerte o se rechaza (decisión pendiente, §9).
11. **Detección de `index.html`.** Si tras extraer hay un único directorio en la raíz
    y el `index.html` está dentro, se sube un nivel automáticamente. Es el error nº 1
    de los usuarios no técnicos y hay que resolverlo en silencio, no con un error.
12. **Escaneo de moderación** (`packages/moderation`): heurísticas de phishing
    (formularios de credenciales que imitan marcas conocidas, JavaScript ofuscado,
    redirección inmediata a dominio externo) y contraste contra listas de bloqueo.
    Se guarda la puntuación en `ingest_scans`. **Puntuar alto no tira el sitio**: entra
    en cola de revisión y sigue publicándose, salvo coincidencia clara con lista de
    bloqueo. Los falsos positivos de moderación son una de las quejas graves contra
    la competencia.
13. Si algo falla, el error que ve el usuario es **producto, no plomería**: en
    español, dice qué archivo, por qué, y qué hacer.

### Fase D — Escritura y conmutación (1–3 s)

14. Se escribe cada archivo en `sites/{siteId}/{versionId}/…` en el bucket definitivo,
    con `Content-Type` derivado de la extensión y guardado como metadato del objeto.
    `versionId` es un ULID: ordenable en el tiempo y sin colisiones.
15. Se inserta la fila en `site_versions` (bytes, número de archivos, autor, origen,
    checksum).
16. **Conmutación atómica:** una única transacción actualiza `sites.active_version_id`.
    Hasta ese `COMMIT` el visitante sigue viendo la versión anterior íntegra. Nunca se
    ve el sitio a medias. Las versiones antiguas **no se borran** — eso nos da
    historial y rollback en un clic sin trabajo adicional.
17. Se escribe el registro de metadatos en **KV** (`site:{host}`) con la versión
    activa y las banderas de servido. KV es *eventually consistent*; el desfase típico
    es de segundos y es aceptable porque la versión anterior sigue siendo válida
    mientras tanto.
18. Se invalida la caché de borde del Worker para ese host.

### Fase E — Primera visita (`apps/serve`)

El Worker aplica las guardas **en este orden**, y el orden importa: nunca se revela la
existencia de un sitio suspendido, y nunca se consume cuota de visitas de un sitio
protegido por contraseña que no la ha pasado.

1. Lee `Host`. Extrae el subdominio de `*.mgup.site`, o busca el custom hostname.
2. `KV.get("site:{host}")`. Fallo de caché → 404 de marca. **No hay consulta a
   Postgres en el camino de servido.**
3. **El sitio existe** → si no, 404.
4. **No ha caducado** (`ttl_expires_at`) → si caducó, página de "este enlace ha
   caducado" con enlace para reactivar. El contenido sigue en R2.
5. **No está suspendido** por moderación → si lo está, página de suspensión.
6. **Contraseña**, si la tiene: cookie de sesión firmada por sitio; si no la hay,
   se sirve la página de contraseña **personalizada con el logo del cliente**. Esa
   pantalla es la primera impresión que se lleva el cliente de una agencia; se diseña
   como producto.
7. **Cuota de visitas** del plan → si se supera, página de límite alcanzado dirigida
   al dueño, no un error críptico al visitante.
8. Resuelve la ruta a la clave de R2 (`/` → `index.html`, `/x` → `/x.html` o
   `/x/index.html`).
9. **Fallback SPA:** si el sitio está marcado como aplicación de página única y la
   ruta no existe, devuelve `index.html` **con estado 200**. Una casilla lo resuelve.
10. Si no existe y no es SPA: el 404 personalizado del sitio, o el nuestro.
11. Cabeceras: `Content-Type` por extensión; `Cache-Control: public, max-age=31536000,
    immutable` para assets bajo prefijo versionado y `no-cache` revalidado para el
    documento HTML; `X-Robots-Tag: noindex` si el sitio lo tiene marcado;
    `X-Content-Type-Options: nosniff`; CSP restrictiva.
12. **Analítica asíncrona:** `ctx.waitUntil()` encola el evento. **No bloquea la
    respuesta.** Ver §5.

Presupuesto de latencia en caché templada: **< 50 ms** hasta el primer byte.

## 4. Dominios propios

Cloudflare for SaaS (Custom Hostnames) sobre la cuenta de contenido.

1. El usuario da el hostname. Se crea el Custom Hostname vía API y se guarda su id.
2. Se generan **instrucciones DNS en español y específicas del registrador**. Se
   detecta el registrador por WHOIS/RDAP y los pasos dicen *"en Dinahosting, entra en
   Panel → Dominios → …"* en lugar de un genérico. Registradores a cubrir en el MVP:
   Dinahosting, Raiola Networks, Webempresa, IONOS, Arsys, Nominalia, y los
   internacionales (Cloudflare, GoDaddy, Namecheap, Google Domains → Squarespace).
3. Apex y `www`: para el apex se usa `CNAME` con flattening donde el registrador lo
   soporte y `A` a las IPs de Cloudflare donde no. La instrucción dice cuál aplica.
4. **Estado de propagación visible y honesto**, con los cuatro estados reales
   (pendiente DNS → validando → emitiendo SSL → activo), el registro que falta y
   cuándo se comprobó por última vez. Nunca un spinner infinito.

**Riesgo abierto:** Cloudflare for SaaS tiene coste por hostname activo y límites de
cuota por cuenta. Si al llegar a la slice 7 el modelo de precios no encaja con
"dominios ilimitados en Agencia", **hay que pararse y decidirlo como producto**, no
improvisar un límite. Marcado en el plan de entrega.

## 5. Analítica por visitante

Es la palanca de precio: convierte "hosting a 9 €" en "seguimiento de propuestas a
39 €". [ADR-0005](adr/0005-analitica-cookieless.md) tiene el detalle.

- **Cookieless desde el diseño.** Identificador de sesión = hash de (IP + user-agent +
  sal rotada cada 24 h). Sin cookies, sin `localStorage`, sin nada en el navegador.
- La sal vive solo en memoria del Worker y en un secreto rotado; **la sal anterior no
  se conserva**, lo que hace irreversible la reidentificación pasadas 24 h.
- El evento se emite con `ctx.waitUntil()` a una Queue y lo consume `apps/jobs` hacia
  Postgres. La respuesta al visitante nunca espera.
- Métricas por sesión: primera y última visita, número de visitas, tiempo en página,
  **profundidad de scroll**, páginas vistas y su orden, país y ciudad aproximada,
  dispositivo y navegador, referrer y UTM.
- **La vista que vende** no es un informe genérico, es una frase:
  *"Tu cliente abrió la propuesta 3 veces, la última ayer a las 19:42, y llegó hasta
  el apartado de precios."* Se construye como vista de primera clase.

**Honestidad obligatoria en la documentación:** un sitio sin cookies ni scripts de
terceros **no necesita banner de cookies**, y eso se puede afirmar en la web. Pero el
hash de IP sigue siendo dato personal seudonimizado bajo el RGPD: hace falta base
jurídica, información en la política de privacidad y DPA. Se vende como *"sin cookies
y sin banner"*, nunca como *"sin datos personales"*.

## 6. Facturación

Detalle completo en [`facturacion.md`](facturacion.md) y
[ADR-0004](adr/0004-modulo-de-facturacion-verifactu-ready.md). Los dos invariantes
que la arquitectura tiene que garantizar:

- **La numeración no tiene huecos.** Secuencia transaccional en Postgres con bloqueo
  de fila, dentro de la misma transacción que inserta la factura. Nunca un contador en
  la aplicación. Un salto es un problema con Hacienda, no un detalle estético.
- **Las facturas son inmutables.** RLS sin `UPDATE` ni `DELETE` para nadie, y trigger
  que lo bloquea también para el rol de servicio. Corregir = emitir una **factura
  rectificativa** que referencia la original.

## 7. Moderación y abuso

Un servicio que publica HTML en segundos es un imán para el phishing, y esto ha estado
a punto de tumbar a nuestro competidor de referencia. Desde el día uno, no como slice
final:

- Escaneo en la subida (paso 12) con puntuación persistida.
- Límites de velocidad por IP y por cuenta en la publicación.
- Cola de revisión manual para lo que puntúe alto, **sin tirar el sitio
  automáticamente** salvo coincidencia clara.
- Endpoint público de denuncia, visible en el pie de los sitios servidos.
- **Interruptor de emergencia** para suspender sitio o cuenta en un clic, con efecto
  en KV en segundos.
- Registro de auditoría append-only de toda acción de moderación.

La separación de dominios y de cuentas de Cloudflare
([ADR-0001](adr/0001-separacion-de-dominios.md)) es la última línea de defensa: si la
cuenta de contenido acaba en listas de bloqueo, el negocio sigue en pie.

## 8. RGPD y ubicación de los datos

| Dato | Dónde vive | Región |
|---|---|---|
| Cuentas, sitios, facturas, analítica | Supabase Postgres | UE (Fráncfort o Irlanda) — `TODO: fijar` |
| Bytes de los sitios | Cloudflare R2, jurisdicción UE | UE |
| Metadatos de servido | Cloudflare KV | Global (replicado) — solo id de sitio y banderas, sin datos personales |
| Datos de pago | Stripe | UE / EE. UU. — subencargado, va en la lista pública |
| Emails transaccionales | Proveedor a decidir | UE obligatorio — `TODO: elegir` |

Se publican: DPA en español descargable (art. 28 RGPD), **lista pública de
subencargados** en `/subencargados` con su ubicación, exportación y borrado de datos
autoservicio, y página `/estado` pública y honesta.

Todos los documentos legales se generan como **borradores marcados como pendientes de
revisión por asesoría jurídica**. Donde no haya certeza normativa va
`TODO: verificar con asesor`, nunca una cláusula improvisada.

## 9. Preguntas abiertas para el product owner

1. **`.docx`, `.pptx`, `.xlsx`** están en el alcance de la slice de publicación, pero
   servirlos estáticamente es solo una descarga. ¿Los convertimos a PDF en la ingesta
   (añade una dependencia pesada), los mostramos con un visor de terceros, o el MVP se
   limita a descarga directa con una página de portada decente?
2. **`.php` en un zip**: ¿lo rechazamos con un error explícito ("no ejecutamos código,
   y aquí está por qué") o lo almacenamos inerte? Recomiendo rechazarlo: decir que no
   claramente es parte del posicionamiento.
3. **Coste de Cloudflare for SaaS** frente a "dominios ilimitados" en el plan Agencia
   (§4).
4. **Proveedor de email transaccional en la UE** — condiciona la lista de
   subencargados.

## Placeholders pendientes de decidir

Centralizados en `packages/config`; cambiarlos será una variable, no un refactor.

| Marcador | Uso | Estado |
|---|---|---|
| `magicupload.es` | App, marketing, panel | `TODO: verificar` registro |
| `mgup.site` | Contenido de usuario | `TODO: verificar` registro |
| Región Supabase | Fráncfort o Irlanda | Pendiente |
| Precios (0 / 8,99 / 19 / 39 €) | Orientativos según brief | Pendientes de confirmar |
