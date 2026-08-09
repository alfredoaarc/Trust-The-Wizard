/**
 * Tipos de contenido servidos.
 *
 * El `Content-Type` se deriva de la extensión y se guarda como metadato del objeto en
 * R2 al escribir la versión, no se calcula en cada visita. El Worker sirve lo que hay
 * guardado; menos trabajo en el camino caliente.
 *
 * Toda respuesta lleva además `X-Content-Type-Options: nosniff`, así que un tipo mal
 * asignado no se convierte en una vía de ejecución en el navegador.
 */

const TYPES: Record<string, string> = {
  // Documentos
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".pdf": "application/pdf",

  // Imágenes
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",

  // Tipografías
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",

  // Audio y vídeo
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",

  // Ofimática. Se sirven como descarga mientras no se decida el visor.
  // Ver pregunta abierta 1 en ARCHITECTURE.md §9.
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Tipo por defecto: octet-stream fuerza descarga en lugar de interpretación. */
export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export function contentTypeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return DEFAULT_CONTENT_TYPE;
  return TYPES[path.slice(dot).toLowerCase()] ?? DEFAULT_CONTENT_TYPE;
}

/** Extensión en minúsculas, con el punto. Cadena vacía si no tiene. */
export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  // Un archivo que empieza por punto (`.env`) no tiene extensión, es un nombre oculto.
  if (dot <= 0) return "";
  return name.slice(dot).toLowerCase();
}
