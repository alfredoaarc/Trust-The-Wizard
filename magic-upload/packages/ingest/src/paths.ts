/**
 * Saneado de rutas de entrada del ZIP. Aquí vive la defensa contra el «zip slip».
 *
 * El zip slip es LA vulnerabilidad clásica de este producto: una entrada del ZIP con
 * una ruta como `../../../etc/passwd` que, al extraerse, escribe fuera del directorio
 * destino. En nuestro caso el destino son claves de R2 (`sites/{id}/{ver}/…`), así que
 * una fuga significaría escribir sobre otra versión o sobre el sitio de otro cliente.
 *
 * Postura de diseño: **rechazar, no resolver**.
 *
 * La tentación es normalizar `a/../b` a `b` y comprobar el resultado. Ahí es donde
 * viven todos los CVE de esta familia: cada normalizador tiene su caso raro
 * (separadores mixtos, letras de unidad, UNC, dobles barras, dobles codificaciones).
 * Nosotros no resolvemos nada: si una ruta contiene un solo `..`, se rechaza el ZIP
 * entero. Un ZIP legítimo generado por cualquier herramienta normal nunca lo lleva.
 *
 * Este módulo es lógica pura de cadenas a propósito: no usa `node:path`, porque
 * `path` se comporta distinto en Windows y en POSIX y no queremos que la seguridad
 * dependa del sistema operativo donde corra el proceso.
 */

import { IGNORED_ENTRIES, MAX_PATH_DEPTH, MAX_PATH_LENGTH } from "@magic-upload/config";
import { ingestErrors } from "./errors.js";

/** Letra de unidad de Windows: `C:` o `C:\`. */
const DRIVE_LETTER = /^[a-zA-Z]:/;

/** Caracteres de control y NUL. El NUL trunca cadenas en capas escritas en C. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Normaliza y valida la ruta de una entrada del ZIP.
 *
 * Devuelve una ruta relativa con separadores `/`, sin segmentos vacíos ni `.`.
 * Lanza `IngestError` si la ruta no es segura.
 *
 * Devuelve `null` para las entradas que se ignoran en silencio (metadatos de macOS,
 * `.DS_Store`, `node_modules`…): no son un error, simplemente no se publican.
 */
export function safeEntryPath(raw: string): string | null {
  if (raw.length > MAX_PATH_LENGTH) {
    throw ingestErrors.rutaDemasiadoLarga(raw.slice(0, 80));
  }

  // Un NUL o un carácter de control en un nombre de archivo no tiene ningún uso
  // legítimo, y sí tiene varios ilegítimos.
  if (CONTROL_CHARS.test(raw)) {
    throw ingestErrors.rutaInsegura(visible(raw));
  }

  // El formato ZIP especifica `/` como separador. Un `\` en una entrada es, o bien
  // una herramienta que no sigue la especificación, o bien un intento de escapar en
  // un extractor de Windows. Lo tratamos como separador: es la lectura segura.
  const withSlashes = raw.replace(/\\/g, "/");

  // Ruta absoluta POSIX (`/etc/passwd`) o UNC (`//servidor/recurso`).
  if (withSlashes.startsWith("/")) {
    throw ingestErrors.rutaInsegura(visible(raw));
  }

  // Ruta absoluta de Windows (`C:/…`). Se comprueba sobre la cadena ya normalizada
  // para cazar también `C:\…`.
  if (DRIVE_LETTER.test(withSlashes)) {
    throw ingestErrors.rutaInsegura(visible(raw));
  }

  // Entrada de directorio (`assets/`). No hay contenido que publicar, y devolver aquí
  // «assets» haría que quien llame a esta función crea que es un archivo.
  if (withSlashes.endsWith("/")) return null;

  const segments: string[] = [];
  for (const segment of withSlashes.split("/")) {
    // Segmento vacío (`a//b`) o `.`: ruido, se descarta sin más.
    if (segment === "" || segment === ".") continue;

    // Aquí está la defensa. No intentamos resolver el `..` contra los segmentos ya
    // acumulados: cualquier `..`, esté donde esté, invalida el ZIP.
    if (segment === "..") {
      throw ingestErrors.rutaInsegura(visible(raw));
    }

    // Windows elimina los puntos y espacios finales de los nombres de archivo. Un
    // `index.html.` y un `index.html` acaban siendo el mismo archivo allí, y esa
    // discrepancia entre lo que validamos y lo que se escribe es un vector conocido.
    //
    // La regla también rechaza segmentos que son solo puntos (`...`). Son nombres
    // legítimos en POSIX, pero ningún sitio web real los usa y en Windows tampoco
    // sobreviven, así que no merece la pena abrir la excepción.
    if (segment !== segment.replace(/[. ]+$/, "")) {
      throw ingestErrors.rutaInsegura(visible(raw));
    }

    segments.push(segment);
  }

  // Una ruta que solo contenía separadores o `.`. No es un error: no hay nada que
  // publicar.
  if (segments.length === 0) return null;

  if (segments.length > MAX_PATH_DEPTH) {
    throw ingestErrors.anidamientoExcesivo(segments.join("/"));
  }

  const path = segments.join("/");
  return shouldIgnore(segments) ? null : path;
}

/**
 * Entradas que se descartan en silencio.
 *
 * No son un error del usuario: casi siempre las mete su sistema operativo al
 * comprimir. Fallar por un `.DS_Store` sería absurdo, y publicar un `.env` sería
 * grave — de ahí que estén en la misma lista.
 */
export function shouldIgnore(segments: readonly string[]): boolean {
  return segments.some((segment) => IGNORED_ENTRIES.includes(segment));
}

/**
 * Versión imprimible de una ruta para meterla en un mensaje de error.
 *
 * Una ruta hostil puede llevar caracteres de control o ser larguísima, y ese mensaje
 * acaba renderizado en el panel del usuario. Se escapa y se recorta.
 */
function visible(raw: string): string {
  const escaped = raw.replace(/[\u0000-\u001f\u007f]/g, "\uFFFD");
  return escaped.length > 80 ? `${escaped.slice(0, 77)}…` : escaped;
}
