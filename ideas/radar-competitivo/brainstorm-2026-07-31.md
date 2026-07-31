# ✦ Radar de inteligencia competitiva para PYMEs y startups

**Sesión de brainstorming — 31/07/2026**

> Plataforma nueva, separada completamente de Conjure y de las webs hechas hasta ahora.

## La idea en una frase

**"Tu analista de inteligencia competitiva por 50€/mes"**: una plataforma que
vigila a tus competidores (precios, features, reseñas, contrataciones,
contenido) y te entrega **interpretación y acciones**, no datos crudos.

## Hueco de mercado validado

- **Enterprise:** Klue (~20-100k$/año), Crayon (~15-60k$/año), Contify
  (~25-80k$/año). Asumen analista dedicado, setup de semanas, precio opaco.
- **Low-cost:** Visualping, Owler, SpyFu, Mention… monocanal, datos crudos sin
  interpretación, falsos positivos.
- Cita de un fundador: *"no hay nada entre alertas gratis sin interpretación y
  plataformas de +15k$/año"*.
- **Competidores emergentes en el hueco:** SnitchFeed (59$/mes, solo social),
  Linkeddit Compete (99$/mes). Validan demanda; conviene moverse rápido.

## Diferenciadores

1. **Interpretación, no datos:** cada evento llega con "qué significa para ti"
   + acción sugerida.
2. **Setup mágico en 5 min:** das tu web, la IA detecta competidores y fuentes
   sola. Cero curación manual.
3. **Diffs semánticos con LLM:** sin falsos positivos de píxeles/HTML.
4. **Entrega donde vives:** brief semanal por email + alertas críticas en
   Slack. No un dashboard más.
5. **Precio transparente:** gratis 1 competidor / ~49€ con 5 / ~149€ agencias
   (marca blanca + API).

## Moat

Histórico acumulado de movimientos por competidor (serie temporal de precios,
features, contrataciones) — irreplicable por un entrante nuevo. Páginas
"X vs Y" con esos datos = SEO programático.

## MVP

Fuentes de mayor señal: página de precios + changelog/blog + reseñas + ofertas
de empleo. **El brief semanal ES el producto.** Validable casi manualmente con
~10 beta antes de automatizar todo.

## Riesgos

- Coste scraping/LLM por cliente (diseñar para margen a 49€).
- Churn si el brief no aporta (mejor "sin movimientos relevantes" honesto que
  relleno).
- Entrantes con distribución → acumular histórico pronto.

## Decisiones

- **Público:** cualquier empresa, de PYME a startup.
- **Estética del producto:** alineada con la web del usuario (Conjure /
  "Trust the Wizard", trustthewizard.com): fondo claro, minimalista, copy
  directo en español, toque mágico sutil (✦), cero humo visual.
- **Siguiente paso:** prompt maestro para construir el MVP
  (ver [`prompt-mvp-radar-competitivo.md`](./prompt-mvp-radar-competitivo.md)).
