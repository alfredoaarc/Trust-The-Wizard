# ADR-0006 — Magic Upload como monorepo en `magic-upload/`

**Estado:** Aceptada · **Fecha:** 2026-08-09

## Contexto

El brief de Magic Upload asumía un repositorio vacío. El repositorio real,
`alfredoaarc/Trust-The-Wizard`, ya contiene la landing page de **Conjure**, y su
directorio `docs/` es lo que **GitHub Pages publica** en `trustthewizard.com` (tiene
`CNAME`, `.nojekyll`, `sitemap.xml`, `robots.txt`).

Escribir los documentos de Fase 0 en `docs/` tal cual pedía el brief habría publicado
en abierto la arquitectura, la tabla de precios y el análisis competitivo, servidos
como texto plano junto a la landing.

## Decisión

Magic Upload vive en **`magic-upload/`**, como monorepo Turborepo + pnpm
independiente:

```
Trust-The-Wizard/
├── docs/                 ← landing de Conjure, publicada por GitHub Pages. NO SE TOCA.
├── server.js             ← preview local de esa landing
└── magic-upload/         ← este proyecto
    ├── CLAUDE.md         ← convenciones de este proyecto
    ├── apps/  packages/  docs/
    ├── pnpm-workspace.yaml  turbo.json
    └── …
```

- Todas las rutas del brief se reinterpretan bajo este prefijo:
  `docs/ARCHITECTURE.md` → `magic-upload/docs/ARCHITECTURE.md`, y así con el resto.
- `magic-upload/CLAUDE.md` es un `CLAUDE.md` de directorio: aplica al trabajar aquí y
  no impone las convenciones de Magic Upload a la landing de Conjure, que es otro
  proyecto con otras reglas.
- La configuración de GitHub Pages **no se modifica**. `magic-upload/` no se publica.
- El workspace de pnpm está acotado a `magic-upload/`; la landing sigue con su
  `package.json` de npm en la raíz, sin interferencia.

## Consecuencias

**A favor**

- Ningún documento interno acaba servido públicamente.
- La landing de Conjure sigue publicándose exactamente igual, sin migración ni
  ventana de caída.
- Dos proyectos con ciclos de vida distintos quedan separados sin necesidad de crear
  un repositorio nuevo hoy.

**En contra**

- Todos los comandos de Magic Upload se ejecutan desde `magic-upload/`. Fácil de
  olvidar; queda escrito en `CLAUDE.md`.
- Dos gestores de paquetes conviven en el repositorio (npm en la raíz para la landing,
  pnpm en `magic-upload/`). Es feo pero inocuo, y la alternativa era migrar la landing
  sin motivo.
- El CI necesita filtros por ruta para no ejecutar los tests de Magic Upload al tocar
  la landing, y viceversa.

## Qué invalidaría esta decisión

Que Magic Upload crezca hasta merecer su propio repositorio, que es lo más probable en
cuanto haya despliegues, secretos de producción y un equipo. **La migración está
diseñada para ser barata**: `magic-upload/` es autocontenido, así que mover el
directorio a un repositorio nuevo conservando el historial (`git subtree split`) no
requiere tocar rutas internas.
