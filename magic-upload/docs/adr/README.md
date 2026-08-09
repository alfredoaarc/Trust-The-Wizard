# Decisiones de arquitectura (ADR)

Un ADR registra **una decisión y por qué se tomó**, para que dentro de seis meses
nadie la deshaga sin conocer el motivo. Si vas a cambiar algo que contradice un ADR,
escribe uno nuevo que lo sustituya; no edites el antiguo.

Formato: contexto → decisión → consecuencias → qué la invalidaría.

| # | Decisión | Estado |
|---|---|---|
| [0001](0001-separacion-de-dominios.md) | Separación de dominios y cuentas: app vs. contenido de usuario | Aceptada |
| [0002](0002-versionado-inmutable-en-r2.md) | Versionado inmutable en R2 con puntero atómico | Aceptada |
| [0003](0003-kv-cache-postgres-fuente-de-verdad.md) | KV como caché de servido, Postgres como fuente de verdad | Aceptada |
| [0004](0004-modulo-de-facturacion-verifactu-ready.md) | Módulo de facturación preparado para Verifactu desde el día uno | Aceptada |
| [0005](0005-analitica-cookieless.md) | Analítica cookieless con hash de visitante y sal rotada | Aceptada |
| [0006](0006-monorepo-en-subdirectorio.md) | Magic Upload como monorepo en `magic-upload/` | Aceptada |
| [0007](0007-degradacion-sin-destruccion.md) | Degradación sin destrucción al cancelar | Aceptada |
