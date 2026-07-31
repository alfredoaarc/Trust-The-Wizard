# ✦ Prompt maestro — MVP del Radar de Inteligencia Competitiva

> Uso: copia todo lo que hay debajo de la línea en una sesión nueva de Claude
> Code, dentro de un **repositorio nuevo y vacío** (el producto es independiente
> de Conjure y de este repo). Ajusta antes los `[corchetes]` si quieres cambiar
> nombre, dominio o stack.

---

Quiero que construyas el MVP completo de **[Nombre del producto]**, un radar de
inteligencia competitiva para PYMEs y startups. Lee todo este documento antes
de escribir código: define el producto, el alcance exacto del MVP, la
arquitectura, el modelo de datos, el pipeline de análisis y la estética.
Trabaja por fases y deja cada fase funcionando y commiteada antes de pasar a
la siguiente.

## 1. Qué es el producto

**"Tu analista de inteligencia competitiva por 50€/mes."** El usuario da la URL
de su empresa; la plataforma detecta a sus competidores, vigila sus fuentes de
mayor señal (página de precios, changelog/blog, reseñas, ofertas de empleo) y
le entrega **interpretación y acciones, no datos crudos**:

- Un **brief semanal por email** — el brief ES el producto, no el dashboard.
- **Alertas críticas en Slack** cuando pasa algo que no puede esperar al lunes.
- Cada evento llega con **"qué significa para ti"** + una **acción sugerida**.

Posicionamiento: el hueco entre las alertas gratis sin interpretación
(Visualping, Mention) y las plataformas enterprise de +15k$/año (Klue, Crayon,
Contify). Público: cualquier empresa, de PYME a startup. Todo el producto y el
copy en **español** (deja la base preparada para i18n, pero no traduzcas nada
en el MVP).

## 2. Alcance del MVP

**Dentro:**

1. **Landing pública** con la propuesta de valor, precios y CTA de registro.
2. **Registro/login** (email + magic link; sin contraseñas si el stack lo
   permite fácilmente).
3. **Onboarding mágico (< 5 min):** el usuario pega la URL de su web →
   la IA analiza el sitio, propone 3-8 competidores con sus fuentes ya
   detectadas (pricing, blog/changelog, perfil de reseñas, página de empleo) →
   el usuario confirma o edita → primer rastreo inmediato como "foto inicial".
   Cero curación manual obligatoria.
4. **Motor de vigilancia** sobre las 4 fuentes de mayor señal por competidor:
   página de precios, changelog/blog, reseñas y ofertas de empleo.
5. **Diffs semánticos con LLM:** nada de comparar píxeles ni HTML crudo. Solo
   se considera "evento" un cambio con significado de negocio.
6. **Brief semanal por email** + **alertas críticas en Slack** (webhook
   entrante que configura el usuario; no hace falta app de Slack en el MVP).
7. **Dashboard mínimo:** lista de competidores, timeline de eventos por
   competidor, archivo de briefs enviados y configuración.
8. **Planes y facturación** con Stripe: Gratis (1 competidor, brief
   quincenal), Pro ~49€/mes (5 competidores, brief semanal + Slack),
   Agencias ~149€/mes (15 competidores; marca blanca y API quedan como
   "próximamente" visible en la UI, sin construir).

**Fuera del MVP (no lo construyas, aunque dejes hueco):** API pública, marca
blanca, app móvil, integraciones más allá de Slack y email, equipos
multiusuario, monitorización de redes sociales y de campañas de pago.

## 3. Stack y arquitectura

Elige aburrido y desplegable por una persona:

- **App:** Next.js (App Router) + TypeScript, en [Vercel u otro host].
- **BD:** Postgres ([Neon/Supabase/Railway]). Sin ORM exótico: Drizzle o Prisma.
- **Jobs:** cron + cola ligera para rastreos y envíos ([Inngest, Trigger.dev o
  cron de Vercel + tabla de jobs]). Los rastreos son diarios por fuente; el
  brief se compila y envía el lunes por la mañana.
- **Scraping:** fetch + Playwright solo como fallback para páginas que lo
  exijan. Normaliza cada página a **markdown limpio** (tipo Readability) antes
  de guardar nada.
- **Email:** [Resend/Postmark] con plantillas propias.
- **LLM:** API de Anthropic. Dos niveles para proteger margen:
  - `claude-haiku-4-5-20251001` para extracción, clasificación y descartes
    baratos (¿cambió algo con sentido?, ¿qué tipo de evento es?).
  - `claude-sonnet-5` para el diff semántico fino, la interpretación
    ("qué significa para ti"), la acción sugerida y la redacción del brief.

### Control de costes (diseñado para margen a 49€/mes)

- Guarda un **hash del contenido normalizado** por snapshot: si el hash no
  cambia, no hay llamada al LLM. Esta es la regla número uno.
- El diff semántico compara **markdown normalizado**, no HTML, y solo las
  secciones que cambiaron.
- Presupuesto por cliente: registra tokens consumidos por organización y por
  rastreo en una tabla `usage`, para poder medir el coste real por cliente
  desde el día 1.
- Cachea la detección de competidores del onboarding (es la llamada más cara y
  solo hace falta una vez).

## 4. Modelo de datos (mínimo)

- `users` / `organizations` (una org por usuario en el MVP) + plan y estado de
  suscripción (Stripe customer/subscription id).
- `competitors` (org, nombre, dominio, estado).
- `sources` (competitor, tipo: `pricing | blog | reviews | jobs`, URL, método
  de rastreo, frecuencia, último rastreo, estado de salud).
- `snapshots` (source, capturado_en, hash del contenido, markdown normalizado
  — **guarda siempre el contenido completo: el histórico es el moat**).
- `events` (source, snapshot_antes, snapshot_después, tipo:
  `cambio_precio | feature_nueva | feature_retirada | contratacion | resena |
  contenido | otro`, severidad: `critica | relevante | menor`, resumen del
  cambio, **interpretación**, **acción sugerida**, enviado_en_brief,
  enviado_como_alerta).
- `briefs` (org, semana, HTML/markdown enviado, estado de envío, abierto_en).
- `usage` (org, fecha, tokens_entrada, tokens_salida, modelo, motivo).

Serie temporal desde el primer día: nunca borres snapshots ni events. Las
futuras páginas "X vs Y" de SEO programático saldrán de aquí (no las
construyas ahora, pero no hagas nada que las impida).

## 5. Pipeline de análisis (el corazón)

Por cada fuente, en cada rastreo:

1. **Captura** → markdown normalizado → hash.
2. **¿Hash igual al último snapshot?** → fin, sin coste LLM.
3. **Filtro barato (Haiku):** ¿el cambio tiene significado de negocio o es
   ruido (fechas, contadores, cookies, rotación de testimonios)? Si es ruido →
   guarda snapshot y fin. Sé agresivo descartando: **un falso positivo en el
   brief cuesta más que un evento menor perdido.**
4. **Diff semántico (Sonnet):** qué cambió exactamente, en términos de negocio
   (ej.: "el plan Pro subió de 29€ a 39€ y ahora incluye SSO").
5. **Clasificación + severidad + interpretación + acción sugerida** en una
   sola llamada estructurada. La interpretación se escribe **para el cliente
   concreto** (usa el contexto de su empresa capturado en el onboarding).
6. **Enrutado:** severidad `critica` → alerta Slack inmediata; todo lo demás
   espera al brief.

### El brief semanal

- Asunto tipo: "✦ Radar semanal: 2 movimientos de [Competidor X] que te tocan".
- Estructura: 1-3 movimientos importantes (qué pasó → qué significa para ti →
  qué haría yo), luego una línea por movimiento menor, y el estado de
  vigilancia (fuentes con problemas, si las hay).
- **Honestidad ante todo:** si no hubo nada relevante, el brief dice
  literalmente "Semana tranquila: sin movimientos relevantes de tus
  competidores" con 2-3 líneas de lo menor que se vio. Nunca rellenes. El
  churn viene de un brief que huele a relleno, no de una semana tranquila.

## 6. Estética y copy

Producto hermano visual de Conjure (trustthewizard.com), pero **en claro**:

- Fondo claro, minimalista, mucho aire. Tipografía Inter.
- Acento violeta (familia de `#7c5cff` / `#a78bfa`) y dorado (`#f2c66b`) con
  muchísima moderación; el toque mágico es sutil: la estrella ✦ como bullet o
  detalle, nada de auroras ni fondos animados. Cero humo visual.
- Copy directo en español, sin anglicismos gratuitos ni jerga de marketing.
  Frases cortas. La landing debe poder leerse en 60 segundos.
- Accesible: contraste AA, foco visible, `prefers-reduced-motion` respetado.

## 7. Fases de trabajo

1. **Esqueleto:** repo, Next.js, BD con el modelo de datos, auth, landing.
2. **Onboarding mágico** completo hasta la "foto inicial".
3. **Pipeline:** rastreo diario, hash, filtro, diff semántico, eventos.
4. **Entrega:** brief semanal por email + alertas Slack + archivo en dashboard.
5. **Facturación:** Stripe con los 3 planes y límites por plan aplicados.
6. **Pulido:** estados vacíos, salud de fuentes, panel de coste por cliente.

Al final de cada fase: tests de la lógica no trivial (normalización, hashing,
enrutado de severidad, límites por plan), commit y un párrafo de qué quedó
funcionando. Los prompts del LLM viven en archivos versionados, no incrustados
en el código.

## 8. Criterios de aceptación del MVP

- De URL pegada a competidores confirmados con fuentes detectadas: **< 5 min**.
- Un cambio real de precios en un competidor de prueba genera un evento con
  interpretación y acción sugerida, y llega como alerta o en el brief según
  severidad.
- Un cambio cosmético (banner de cookies, fecha del footer) **no** genera
  evento.
- Una semana sin cambios produce el brief honesto de "semana tranquila".
- El panel de `usage` muestra el coste LLM aproximado por organización.
- Los límites de plan se aplican (no puedes añadir el 2º competidor en Gratis).
