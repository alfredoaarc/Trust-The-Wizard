# Puesta en marcha — lo que tiene que hacer el product owner

Esta es la lista de cosas que **solo puedes hacer tú**, porque implican crear cuentas,
aceptar condiciones y meter una tarjeta. Todo lo que viene después lo hago yo.

Tiempo estimado: **30–40 minutos**, una sola vez.

Al final hay un script que comprueba que todo lo que has pegado funciona, así que no
hace falta que aciertes a la primera: pega, ejecuta, y te dice qué falta.

---

## Paso 0 — Abrir la red del entorno · **bloqueante**

El entorno de Claude Code en el que trabajo tiene una política de red que **bloquea
toda salida** salvo los registros de paquetes (npm, PyPI…). Comprobado: `api.cloudflare.com`,
`supabase.com` y `api.stripe.com` no responden desde aquí.

Eso significa que, aunque me des los tokens, **no puedo llamar a esas APIs** hasta que
cambies la política del entorno.

Qué hacer: en la configuración del entorno de Claude Code, cambiar el acceso de red para
permitir al menos estos destinos:

```
api.cloudflare.com
*.supabase.co
*.supabase.com
api.stripe.com
*.r2.cloudflarestorage.com
```

La documentación de las políticas disponibles está en
<https://code.claude.com/docs/en/claude-code-on-the-web>.

> Si prefieres no abrir la red, la alternativa es que ejecutes tú los comandos en tu
> máquina: yo te dejo los scripts escritos y tú los lanzas. Dímelo y preparo esa vía.

---

## Paso 1 — Registrar los dos dominios

Dos dominios, **no un dominio y un subdominio**. El motivo está en
[ADR-0001](adr/0001-separacion-de-dominios.md) y es doble: reputación y seguridad.

| | Para qué | Qué buscar |
|---|---|---|
| **Dominio de app** | Marketing, panel, checkout, API | El que quieras como marca. `magicupload.es` es el marcador actual |
| **Dominio de contenido** | Los sitios de los clientes | **Corto y barato.** Este es el que puede acabar en listas de bloqueo: trátalo como desechable |

Registrador: cualquiera. Si vas a usar Cloudflare de todas formas, registrarlos allí
ahorra un paso de DNS, pero no es obligatorio.

**Anota los dos nombres.** Van a `packages/config/src/domains.ts`, y ahí acaba el cambio:
está centralizado para que sustituirlos sea una variable y no un refactor.

---

## Paso 2 — Dos cuentas de Cloudflare

**Dos cuentas separadas, no dos zonas de la misma cuenta.** Si la cuenta de contenido
se suspende por abuso, el panel, el checkout y el correo tienen que seguir en pie.

Para tener dos cuentas necesitas dos correos distintos. Un alias del tipo
`tu-nombre+contenido@…` sirve.

### Cuenta A — «app»

1. Alta en <https://dash.cloudflare.com>.
2. Añadir el **dominio de app** como zona y apuntar sus nameservers.

### Cuenta B — «contenido»

1. Alta con el segundo correo.
2. Añadir el **dominio de contenido** como zona y apuntar sus nameservers.

### Un API token por cuenta

En cada cuenta: **Mi perfil → Tokens de API → Crear token → Crear token personalizado**.

Permisos que necesito (los nombres exactos pueden variar algo según la versión del
panel; el script del paso 5 te dirá si falta alguno):

| Ámbito | Permiso | Nivel | Para qué |
|---|---|---|---|
| Cuenta | Workers R2 Storage | Editar | Crear los buckets y escribir los sitios |
| Cuenta | Workers KV Storage | Editar | El registro que lee el Worker en cada visita |
| Cuenta | Workers Scripts | Editar | Desplegar el Worker de servido |
| Zona | DNS | Editar | Los registros de `*.mgup.site` |
| Zona | SSL y certificados | Editar | Dominios propios de cliente, más adelante (slice 7) |

Anota de cada cuenta: **Account ID** (está en el panel, barra lateral derecha) y el
**token** (solo se muestra una vez).

---

## Paso 3 — Proyecto de Supabase

1. Alta en <https://supabase.com>.
2. Nuevo proyecto, **región Fráncfort (`eu-central-1`)**. Ya está decidido y cambiarla
   después con datos de clientes dentro es un proyecto de migración, no un ajuste.
3. Guarda la contraseña de la base de datos que te genere: no se vuelve a mostrar.

Anota de **Configuración del proyecto → API**:

- **Project URL** (`https://xxxxx.supabase.co`)
- **anon / public key** — es pública, va en el navegador
- **service_role key** — ⚠️ **esquiva RLS por completo.** Quien la tenga lo puede todo.
  Nunca en el navegador, nunca en un commit, nunca pegada en un chat

Y de **Configuración → Base de datos**, la cadena de conexión, que es lo que uso para
aplicar las migraciones.

---

## Paso 4 — Pegar las credenciales

Copia `.env.example` a `.env` y rellénalo. `.env` está en `.gitignore`: no se sube.

Si prefieres no tener las claves en un archivo, ponlas como **variables de entorno del
entorno de Claude Code** en su configuración. Es la vía recomendada para la
`service_role` y para los tokens de Cloudflare.

**No las pegues en el chat.**

---

## Paso 5 — Comprobar que funciona

```bash
cd magic-upload
node scripts/verificar-credenciales.mjs
```

Te dice, una por una, qué credencial funciona y qué le falta a la que no. Cuando esté
todo en verde, me lo dices y sigo yo: buckets, KV, migraciones, semillas, Worker y DNS.

---

## Lo que NO hace falta todavía

- **Stripe.** No se toca hasta que tu asesoría valide la matriz fiscal
  ([`facturacion.md` §8](facturacion.md#8-resumen-de-lo-que-hay-que-verificar-antes-de-cobrar)).
  Es el punto de parada nº 2 y existe precisamente para que no haya código cobrando
  antes de tiempo.
- **Proveedor de email transaccional.** Hace falta para los avisos de TTL y de
  archivado, que son de la slice 6. Decisión tuya porque entra en la lista pública de
  subencargados.
- **La SL.** Condiciona cuándo puedes cobrar de verdad, no cuándo puedes publicar.

---

## Después de esto, me encargo yo

Con la red abierta y las credenciales puestas, lo siguiente ya no te toca:

- Crear los buckets de R2 y los namespaces de KV en la cuenta de contenido.
- Aplicar las migraciones al proyecto de Supabase y sembrar planes y límites.
- Desplegar el Worker de servido y crear los registros DNS de `*.<dominio-contenido>`.
- Levantar `apps/web` con el panel y la subida.
- Comprobar de punta a punta que arrastras un `.html` y sale una URL en menos de 30 s.
