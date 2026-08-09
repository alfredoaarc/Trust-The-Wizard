# Magic Upload

**Arrastra un archivo. Ten una URL pública con HTTPS en menos de 30 segundos.**

Publicación instantánea de sitios estáticos para el mercado español: freelances y
agencias que enseñan prototipos a clientes, pymes que quieren su carta o su landing
online, y gente que ha generado un HTML con una IA y no sabe qué hacer con él.

> **Estado: Fase 0 — planificación.** En este directorio todavía no hay código de
> producción. Solo están los documentos de arquitectura, modelo de datos y plan de
> entrega, pendientes de validación del product owner.

## Por dónde empezar a leer

| Documento | Qué contiene |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Componentes y el flujo completo de una publicación, del arrastre a la primera visita |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Esquema de Postgres y políticas RLS |
| [`docs/PLAN-DE-ENTREGA.md`](docs/PLAN-DE-ENTREGA.md) | Las 12 vertical slices, qué entra en cada una y cómo se valida |
| [`docs/facturacion.md`](docs/facturacion.md) | Matriz fiscal, requisitos de factura y preparación para Verifactu |
| [`docs/adr/`](docs/adr/) | Decisiones de arquitectura registradas |
| [`CLAUDE.md`](CLAUDE.md) | Convenciones del repositorio y reglas permanentes del proyecto |

## Por qué existe

Traducir Tiiny Host al español no es un negocio. El foso son tres cosas que un
proveedor extranjero no puede copiar sin constituir una empresa en España:

1. **Factura española conforme**, con NIF del cliente, IVA desglosado y serie
   correlativa. Sin el NIF, un autónomo español no puede deducir el IVA
   (art. 97 Ley 37/1992) y su gestoría se la rechaza.
2. **Datos alojados en la UE** y contrato de encargado del tratamiento en español.
3. **Producto y soporte íntegramente en español**, incluido el centro de ayuda.

Y una decisión de marca: **nunca destruimos el trabajo del usuario**. Ver
[ADR-0007](docs/adr/0007-degradacion-sin-destruccion.md).

## Ubicación en este repositorio

Este directorio es un monorepo independiente dentro de `Trust-The-Wizard`. La landing
de Conjure (`../docs/`) se publica en GitHub Pages y no se toca. Ver
[ADR-0006](docs/adr/0006-monorepo-en-subdirectorio.md).
