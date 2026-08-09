/**
 * Portada de descarga para documentos de ofimática.
 *
 * Decisión del product owner: `.docx`, `.pptx` y `.xlsx` **se publican como descarga**,
 * no se convierten a PDF. Convertirlos exigiría LibreOffice headless o un servicio
 * externo: dependencia pesada, más superficie de ataque, y un subencargado más en la
 * lista pública si fuese externo. Queda para v2.
 *
 * Pero «solo una descarga» no puede significar que el visitante caiga en una descarga
 * automática sin contexto. Nuestro usuario manda esta URL a un cliente, y esa página
 * es lo primero que ve. Así que la portada es producto: dice qué es, cuánto pesa,
 * cuándo se publicó, y tiene un botón.
 *
 * La página se genera en la ingesta y se guarda en R2 como `index.html`, de modo que
 * el Worker no tiene que saber nada de esto: sirve un HTML como cualquier otro.
 */

import { formatBytes } from "@magic-upload/i18n";
import { extensionOf } from "@magic-upload/config";

/** Documentos que reciben portada en lugar de servirse directamente. */
const OFFICE_EXTENSIONS: Readonly<Record<string, string>> = {
  ".docx": "Documento de Word",
  ".doc": "Documento de Word",
  ".pptx": "Presentación de PowerPoint",
  ".ppt": "Presentación de PowerPoint",
  ".xlsx": "Hoja de cálculo de Excel",
  ".xls": "Hoja de cálculo de Excel",
  ".odt": "Documento de texto",
  ".ods": "Hoja de cálculo",
  ".odp": "Presentación",
};

export function isOfficeDocument(filename: string): boolean {
  return extensionOf(filename) in OFFICE_EXTENSIONS;
}

export function officeDocumentLabel(filename: string): string | null {
  return OFFICE_EXTENSIONS[extensionOf(filename)] ?? null;
}

export interface CoverPageOptions {
  /** Nombre del archivo tal cual lo subió el usuario. Se muestra al visitante. */
  readonly filename: string;
  readonly bytes: number;
  /** Título del sitio, si el usuario le puso uno. */
  readonly siteName?: string | undefined;
  /** Marca el `<meta name="robots">` además de la cabecera del Worker. */
  readonly noindex?: boolean | undefined;
}

/**
 * Genera la portada.
 *
 * Sin CSS externo, sin tipografías remotas y sin JavaScript: la página se sirve desde
 * el dominio de contenido, donde la política de seguridad es restrictiva a propósito
 * (ADR-0001). Todo va en línea.
 */
export function renderCoverPage(options: CoverPageOptions): string {
  const { filename, bytes } = options;
  const label = officeDocumentLabel(filename) ?? "Documento";
  const title = options.siteName?.trim() || filename;
  const href = encodeURIComponent(filename);

  return `<!doctype html>
<html lang="es">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${options.noindex ? '<meta name="robots" content="noindex, nofollow">\n' : ""}<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem;
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #f6f7f9; color: #16181d;
  }
  .tarjeta {
    background: #fff; border: 1px solid #e3e6ea; border-radius: 14px;
    padding: 2.5rem 2rem; max-width: 26rem; width: 100%; text-align: center;
    box-shadow: 0 1px 2px rgb(0 0 0 / 4%), 0 8px 24px rgb(0 0 0 / 6%);
  }
  .icono { font-size: 2.75rem; line-height: 1; margin-bottom: 1rem; }
  h1 {
    font-size: 1.25rem; margin: 0 0 .35rem; word-break: break-word;
    letter-spacing: -.01em;
  }
  .meta { color: #676d78; font-size: .875rem; margin: 0 0 1.75rem; }
  .descargar {
    display: inline-block; width: 100%; padding: .8rem 1.25rem;
    background: #16181d; color: #fff; text-decoration: none;
    border-radius: 9px; font-weight: 600;
  }
  .descargar:hover { background: #2b2f37; }
  .pie { margin-top: 1.5rem; font-size: .75rem; color: #949aa4; }
  .pie a { color: inherit; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f1115; color: #e8eaed; }
    .tarjeta { background: #171a1f; border-color: #2a2f37; box-shadow: none; }
    .meta { color: #9aa1ac; }
    .descargar { background: #e8eaed; color: #0f1115; }
    .descargar:hover { background: #fff; }
  }
</style>
<div class="tarjeta">
  <div class="icono" aria-hidden="true">📄</div>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(label)} · ${formatBytes(bytes)}</p>
  <a class="descargar" href="./${href}" download>Descargar</a>
  <p class="pie">Publicado con <a href="https://magicupload.es">Magic Upload</a></p>
</div>
</html>
`;
}

/**
 * Escapa texto para insertarlo en HTML.
 *
 * El nombre del archivo lo elige el usuario y acaba dentro del documento: sin escapar,
 * un archivo llamado `<img onerror=…>.docx` sería XSS almacenado. Da igual que el
 * dominio de contenido esté aislado del panel (ADR-0001): sería XSS contra el cliente
 * de nuestro usuario, que es peor para él.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
