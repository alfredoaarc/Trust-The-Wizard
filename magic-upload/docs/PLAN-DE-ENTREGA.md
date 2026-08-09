# Plan de entrega por vertical slices

> Fase 0 entregada. Pendiente de validación del product owner.
>
> **Estado real:** además de la planificación se ha adelantado la lógica pura que no
> depende de credenciales externas ni de las decisiones abiertas. Marcado ✅ abajo.
> Lo que falta de cada slice es siempre la parte que necesita Supabase, Cloudflare o
> Stripe, más la interfaz.

## Cómo se entrega

Una funcionalidad completa cada vez, **de la interfaz a la base de datos**, con tests,
y funcionando de punta a punta antes de pasar a la siguiente.

**El criterio de terminado no es la suite verde.** Al final de cada slice el product
owner tiene que poder recorrer el camino él mismo, en local o en un despliegue de
preview. Si no puede arrastrar un archivo y ver la URL funcionando, el slice no está
terminado por muy verdes que estén los tests.

Cada slice acaba con: rama propia, PR, y un resumen corto de qué se hizo, qué se
decidió y qué se necesita del product owner.

## Dos cambios que propongo sobre el orden del brief

1. **Añadir una Slice 0** de andamiaje (monorepo, CI, tipos, i18n vacío). No entrega
   valor de usuario y por eso no es una slice de verdad, pero sin ella la Slice 1 se
   contamina de fontanería y deja de ser evaluable.
2. **Adelantar tres piezas de moderación** de la slice 11 a las slices 2 y 3: límite
   de velocidad de publicación, bandera de suspensión honrada por el Worker, e
   interruptor de emergencia. La razón: la Slice 2 es el primer momento en que el
   sistema puede publicar HTML arbitrario en una URL pública. La slice 11 sigue
   existiendo con lo caro — heurísticas de phishing, cola de revisión, denuncia
   pública, auditoría.

Todo lo demás mantiene el orden del brief. **Dime si lo cambias.**

---

## Slice 0 — Andamiaje ✅

**No entrega valor de usuario.** Existe para que las demás no arrastren fontanería.

- Monorepo pnpm + Turborepo en `magic-upload/`, TypeScript estricto.
- `apps/web` (Next.js 15 App Router, Tailwind, shadcn/ui), `apps/serve` (Worker),
  `packages/config`.
- next-intl con **español como idioma base**, no como traducción del inglés.
  Formateadores españoles (`dd/mm/aaaa`, `1.234,56 €`) con tests desde el primer día.
- Vitest y Playwright configurados y ejecutándose en CI, con filtros por ruta para no
  disparar con cambios en la landing de Conjure.
- Commits convencionales en inglés, linter que impide `apps/serve → packages/db`
  ([ADR-0003](adr/0003-kv-cache-postgres-fuente-de-verdad.md)).

**Estado:** hecho salvo `apps/web`, `apps/serve` y Playwright, que necesitan las
decisiones abiertas y credenciales. `pnpm test` y `pnpm typecheck` funcionan.

---

## Slice 1 — Auth, organizaciones y esqueleto del panel

- Supabase en **región UE** (`TODO: fijar` Fráncfort o Irlanda), Auth con email y OAuth.
- `profiles`, `organizations`, `memberships` con RLS y las funciones `is_org_member` /
  `has_org_role`.
- Organización personal creada en el mismo trigger que el perfil: nunca un usuario sin
  organización.
- Panel con navegación, selector de organización, invitación de miembros con roles.
- Emails transaccionales en español (alta, invitación, recuperación). Ni un
  `TODO: translate`.

**Terminado cuando:** el PO se registra, crea una organización, invita a alguien con
rol `member` y comprueba que ese miembro no ve lo de otras organizaciones.

---

## Slice 2 — Publicar un `.html` suelto hasta URL en vivo ⭐

**El «hola mundo» del negocio. Hasta que esto funcione, no hay producto.**

- Zona de arrastre para un `.html` suelto, con **barra de progreso real**.
- Elección de subdominio con comprobación de disponibilidad en vivo y validación
  (minúsculas, dígitos, guiones; reservadas desde `blocked_patterns`).
- Subida directa a R2 con URL prefirmada. Escritura versionada
  ([ADR-0002](adr/0002-versionado-inmutable-en-r2.md)) y conmutación atómica del puntero.
- Sincronización a KV. `apps/serve` sirviendo `*.mgup.site` con `Content-Type`,
  `nosniff` y 404 de marca.
- **URL estable entre re-subidas**: volver a subir cambia la versión, no la URL.
- **De moderación (adelantado):** rate limit de publicación por IP y por cuenta, y
  bandera `status = suspended` honrada por el Worker.
- Cuentas de Cloudflare y buckets separados ya en este punto
  ([ADR-0001](adr/0001-separacion-de-dominios.md)). No se monta "provisional en una
  cuenta y luego se separa": eso nunca se separa.

**Terminado cuando:** el PO arrastra un `.html`, elige subdominio, y abre la URL
pública con HTTPS **en menos de 30 s**. Vuelve a subir otro archivo y la URL es la misma.

**e2e Playwright:** arrastrar → publicar → visitar.

---

## Slice 3 — Ingesta de zip con todas las validaciones de seguridad ⬤ núcleo hecho

- `packages/ingest`: validar → extraer → escanear → escribir, con abortos tempranos.
- **Zip slip**, **zip bomb** (ratio, número de entradas, tamaño total, profundidad),
  **symlinks rechazados**, **extensiones bloqueadas** verificadas por número mágico y
  no por extensión.
- **Detección de `index.html`**: un único directorio raíz que lo contiene → subir un
  nivel automáticamente, en silencio.
- Resto de tipos: `.pdf`, imágenes, y `.docx`/`.pptx`/`.xlsx` **según lo que se decida
  en la pregunta abierta 1** (ver abajo).
- Visor de PDF con modo flipbook y descarga directa.
- Código QR de cada sitio, **desde el plan gratuito**.
- **Los mensajes de error son producto.** En español, dicen qué archivo, por qué y qué
  hacer. Se revisan uno a uno, no se generan.

**Fixtures maliciosos reales**, creados como archivos en el repositorio:
`zip-slip.zip`, `zip-bomb.zip`, `symlink-escape.zip`, `nested-no-index.zip`,
`fake-extension.zip` (un `.exe` llamado `.png`), `deep-nesting.zip`.

**Estado:** `packages/ingest` completo y probado contra 17 fixtures reales (más de los
seis previstos). Falta conectarlo a R2 y a la interfaz de arrastre.

**Terminado cuando:** el PO sube un zip de una web real de varias páginas y funciona;
los fixtures se rechazan con un mensaje en español que se entiende.

---

## Slice 4 — Versionado y rollback

- Historial de versiones en el panel: fecha, autor, tamaño, número de archivos, origen.
- **Restauración en un clic**: mueve el puntero, no re-sube nada.
- Renombrar el enlace, con **redirección 301 desde el antiguo durante 30 días**
  (`site_aliases`).
- Purga de versiones antiguas por plan, respetando la retención de
  [ADR-0002](adr/0002-versionado-inmutable-en-r2.md#política-de-retención-de-versiones)
  — **pendiente de confirmar por el PO**.

**Terminado cuando:** el PO publica tres versiones, restaura la primera y la ve en vivo
en segundos; renombra el sitio y la URL antigua redirige.

---

## Slice 5 — Cuotas y planes ⬤ núcleo hecho

- `plans`, `plan_limits`, `usage_counters`. **Los límites viven en BD y se ajustan sin
  desplegar.**
- Resolución de cuotas en `packages/quotas`, con tests unitarios de cada límite.
- **Aviso antes de subir**, con tamaño exacto y qué plan lo permitiría
  ([ADR-0007](adr/0007-degradacion-sin-destruccion.md)).
- Los cuatro valores que son decisión de producto y no parámetro: **25 MB en
  gratuito** (también para PDF), **ediciones ilimitadas**, **escalón de 3 proyectos**,
  **nunca modo preview destructivo**.
- Página de precios en español, con IVA incluido para particulares.

**Estado:** `packages/quotas` resuelve límites y produce el mensaje. Falta la tabla
`plan_limits` en Supabase y la interfaz.

**Terminado cuando:** el PO intenta subir un archivo de 34 MB en plan gratuito y recibe
el mensaje exacto de [ADR-0007](adr/0007-degradacion-sin-destruccion.md) **antes** de
que empiece la subida.

---

## Slice 6 — Contraseña, `noindex`, TTL y fallback SPA

- **Protección con contraseña**: gratuito para 1 sitio, todos los de pago. Argon2id,
  cookie de sesión firmada por sitio, en el dominio de contenido.
- **Página de contraseña personalizable con el logo del cliente.** Se diseña como
  producto: para una agencia, esa pantalla **es** la primera impresión de su cliente.
- **`noindex` con una casilla**, activada por defecto en el plan Agencia.
  `X-Robots-Tag` desde el Worker.
- **TTL configurable**: 1 h, 24 h, 7 días, permanente. **Aviso por email 24 h antes de
  caducar** desde `apps/jobs`. Al caducar, el contenido se conserva y se puede reactivar.
- **Fallback SPA** con una casilla: ruta inexistente → `index.html` con estado **200**.
- 404 personalizado por sitio.

**Terminado cuando:** el PO protege un sitio con contraseña y ve su logo en la
pantalla; marca un TTL de 1 hora y recibe el aviso; publica una SPA con rutas de
cliente y navega a una ruta profunda sin 404.

---

## Slice 7 — Dominios propios

- Alta de hostname vía Cloudflare for SaaS, apex y `www`.
- **Instrucciones DNS en español y específicas del registrador detectado**: Dinahosting,
  Raiola, Webempresa, IONOS, Arsys, Nominalia, más los internacionales. Los pasos dicen
  *"en Dinahosting, entra en…"*, no un genérico.
- Validación automática y emisión de SSL.
- **Estado de propagación honesto**: los cuatro estados reales, el registro que falta y
  cuándo se comprobó. Nunca un spinner infinito.

⚠️ **Riesgo a resolver antes de empezar:** el coste por hostname de Cloudflare for SaaS
frente a "dominios ilimitados" en el plan Agencia. Si no encaja, **se para y se decide
como producto**, no se improvisa un límite.

**Terminado cuando:** el PO conecta un dominio real que posee y lo ve servido con HTTPS
válido, habiendo seguido solo las instrucciones de pantalla.

---

## Slice 8 — Facturación española completa 🛑 **PUNTO DE PARADA** ⬤ matriz lista

**Antes de escribir código que cobre dinero**, se entrega y se valida:

> **La matriz de casos fiscales de [`facturacion.md` §2](facturacion.md#2-matriz-de-casos-fiscales)
> implementada como tabla de tests de Vitest, verde**, más la lista de
> [lo que hay que verificar](facturacion.md#8-resumen-de-lo-que-hay-que-verificar-antes-de-cobrar).

**Ya está implementada y en verde:** `packages/billing/src/tax-treatment.test.ts`.
Ejecútala con `pnpm test packages/billing`.

El PO la revisa con su asesoría. **Hasta esa validación no se implementa la emisión.**
Nada de Stripe, PDF ni numeración hasta entonces — y no por prudencia genérica: las
facturas son inmutables, así que un tratamiento equivocado se corrige emitiendo una
rectificativa a un cliente que ya la mandó a su gestoría.

Después:

- `billing_profiles` con `tax_zone` resuelta y congelada; Canarias, Ceuta y Melilla
  como zona fiscal separada.
- Validación de **NIF, CIF y NIE con dígito de control**, no con regex.
- **VIES** automático con resultado y fecha guardados; si VIES cae, se cobra con IVA y
  se regulariza.
- **NIF obligatorio en el checkout**, antes del primer cobro. No en ajustes.
- Numeración transaccional sin huecos; facturas inmutables en dos capas; snapshots
  congelados de emisor y destinatario.
- `invoice_registry` encadenado por huella, con hueco de QR y AEAT
  ([ADR-0004](adr/0004-modulo-de-facturacion-verifactu-ready.md)).
- PDF en español, descargable y por email. **Rectificativas autoservicio.**
- Stripe: tarjeta y **SEPA Direct Debit**. **Bizum** solo para pago anual y puntual, con
  su logo en la página de precios.
- **Degradación sin destrucción** al cancelar
  ([ADR-0007](adr/0007-degradacion-sin-destruccion.md)): plan gratuito, sitio principal
  activo, resto archivado 12 meses, avisos al archivar y a los 11 meses.

**Terminado cuando:** el PO se suscribe con un NIF real, recibe la factura en PDF, se la
enseña a su gestoría y esta la acepta. Ese es el criterio, no un test.

---

## Slice 9 — Analítica por visitante

- Hash cookieless con **sal rotada cada 24 h**
  ([ADR-0005](adr/0005-analitica-cookieless.md)). Sin cookies, sin almacenamiento en el
  navegador, IP nunca persistida.
- Emisión asíncrona con `ctx.waitUntil()` → Queue → `apps/jobs` → Postgres.
- Por sesión: primera y última visita, número de visitas, tiempo en página,
  **profundidad de scroll**, páginas vistas y su orden, país y ciudad aproximada,
  dispositivo, navegador, referrer y UTM.
- **La vista que vende**, como vista de primera clase y no como informe genérico:
  *"Tu cliente abrió la propuesta 3 veces, la última ayer a las 19:42, y llegó hasta el
  apartado de precios."*
- Exportable en el plan Agencia.
- Copia honesta en la web: *"sin cookies y sin banner"*, nunca *"sin datos personales"*.

**Terminado cuando:** el PO manda un enlace a alguien, esa persona lo abre y hace scroll,
y el PO ve la frase completa en su panel.

---

## Slice 10 — API pública y servidor MCP

- **API REST documentada con OpenAPI, disponible desde el plan gratuito** con rate
  limit. Claves en `api_keys`, mostradas una sola vez.
- **Servidor MCP (streamable HTTP) en todos los planes**, con `publicar_sitio`,
  `actualizar_sitio`, `listar_sitios`, `borrar_sitio`, `obtener_analitica`.

Esto **no es un diferenciador, es supervivencia**: Netlify, Vercel, Cloudflare,
Static.app, Stacktree, PageDrop, Handoff y el propio Tiiny Host ya tienen MCP. Un host
al que un agente no puede llamar es invisible para la fuente de sitios estáticos que más
rápido crece.

**Terminado cuando:** el PO conecta el servidor MCP a un cliente y publica un sitio
hablando, sin tocar el panel.

---

## Slice 11 — Moderación completa

Lo caro; los cimientos ya están desde las slices 2 y 3.

- Heurísticas de phishing en la ingesta: formularios de credenciales que imitan marcas,
  JavaScript ofuscado, redirección inmediata a dominio externo. Puntuación en
  `ingest_scans`.
- Contraste contra listas de bloqueo (`blocked_patterns`).
- **Cola de revisión manual** para lo que puntúe alto, **sin tirar el sitio
  automáticamente** salvo coincidencia clara. Los falsos positivos de moderación son
  una queja grave contra la competencia.
- **Endpoint público de denuncia**, sin exigir cuenta, visible en el pie de los sitios
  servidos.
- **Registro de auditoría append-only** de toda acción.

**Terminado cuando:** el PO publica un fixture de phishing, lo ve en la cola sin que se
haya tirado el sitio, y lo suspende en un clic con efecto en segundos.

---

## Slice 12 — Cumplimiento y confianza

Necesaria para lanzar aunque no aparezca en el brief como slice.

- **DPA en español descargable** (art. 28 RGPD), borrador marcado como **pendiente de
  revisión jurídica**.
- **Lista pública de subencargados** en `/subencargados`, con ubicación de cada uno.
- **Exportación y borrado de datos autoservicio.**
- Página **`/estado`** pública y honesta. La competencia no tiene ninguna.
- **Centro de ayuda íntegramente en español.**
- Documentación de la ubicación de cada dato
  ([`ARCHITECTURE.md` §8](ARCHITECTURE.md#8-rgpd-y-ubicación-de-los-datos)).

**Ningún dato legal, fiscal o de precios se inventa.** Donde no haya certeza va
`TODO: verificar con asesor` y se dice en el resumen del slice.

---

## Fuera de alcance, y no se relitiga

Funciones serverless, backend, bases de datos de usuario, CMS, e-commerce dinámico,
firma electrónica y PHP. **La simplicidad es el producto.**

Aplazado a v2/v3 por decisión explícita del brief: generador de aviso legal y banner de
cookies, marca blanca completa, espacios por cliente, extensión de navegador, SCORM y
constructor con IA.

## Lo que necesito del product owner

**Bloqueante antes de la Slice 2:**

| # | Decisión | Estado |
|---|---|---|
| 1 | Dominio de contenido y dominio de app | **Se sigue con placeholders**; hay que registrarlos antes de que algo esté en vivo |
| 2 | Región de Supabase | ✅ **Fráncfort (`eu-central-1`)** |
| 3 | `.docx`/`.pptx`/`.xlsx` | ✅ **Descarga con portada en español** |
| 4 | `.php` dentro de un zip | ✅ **Rechazo explícito** |

**Antes de la Slice 7:** coste de Cloudflare for SaaS frente a "dominios ilimitados".

**Antes de la Slice 8:** validación de la matriz fiscal con asesoría, y si la SL está
constituida — condiciona cuándo se puede cobrar de verdad.

**Cuando puedas:** proveedor de email transaccional en la UE (entra en la lista de
subencargados) y confirmación de la política de retención de versiones.
