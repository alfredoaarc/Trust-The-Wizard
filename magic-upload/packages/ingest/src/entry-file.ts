/**
 * Detección de la página de inicio y subida automática de nivel.
 *
 * **Este es el error nº 1 de los usuarios no técnicos.** Comprimen la carpeta que
 * contiene su web en lugar de su contenido, y el ZIP queda así:
 *
 *     mi-web/index.html
 *     mi-web/estilos.css
 *
 * Publicado tal cual, la raíz del sitio está vacía y el usuario ve un 404 después de
 * haber hecho todo bien. Es exactamente el momento en que se rinde.
 *
 * Lo resolvemos en silencio: si hay un único directorio raíz y la página de inicio
 * está dentro, subimos un nivel. Sin avisos, sin diálogos de confirmación. El usuario
 * no tiene que saber que existía el problema.
 */

import { ENTRY_FILE_CANDIDATES } from "@magic-upload/config";
import { ingestErrors } from "./errors.js";

/** Tope de niveles que se suben. `web/web/web/index.html` existe; diez niveles no. */
const MAX_HOIST_DEPTH = 8;

export interface EntryPlan {
  /** Prefijo que hay que quitar a todas las rutas. Cadena vacía si no se sube nivel. */
  readonly strip: string;
  /** Ruta de la página de inicio, ya sin el prefijo. */
  readonly entryFile: string;
}

/**
 * Decide qué archivo abre el sitio y cuánto hay que subir de nivel.
 *
 * @param paths Rutas ya normalizadas por `safeEntryPath()`, relativas y con `/`.
 */
export function planEntryFile(paths: readonly string[]): EntryPlan {
  let strip = "";
  let current = paths;

  for (let level = 0; level <= MAX_HOIST_DEPTH; level += 1) {
    const entry = findEntryFile(current);
    if (entry) return { strip, entryFile: entry };

    // No hay página de inicio en este nivel. ¿Todo cuelga de un único directorio?
    const root = singleRootDirectory(current);
    if (!root) break;

    strip += `${root}/`;
    const prefix = `${root}/`;
    current = current.map((path) => path.slice(prefix.length));
  }

  throw ingestErrors.sinPaginaDeInicio(htmlFilesIn(paths));
}

/** Busca una página de inicio en la raíz del nivel actual, por orden de preferencia. */
function findEntryFile(paths: readonly string[]): string | null {
  for (const candidate of ENTRY_FILE_CANDIDATES) {
    // Comparación sin distinguir mayúsculas: Windows y macOS no las distinguen, así
    // que un `Index.html` es habitual y sería absurdo fallar por eso.
    const found = paths.find((path) => path.toLowerCase() === candidate);
    if (found) return found;
  }
  return null;
}

/**
 * Devuelve el único directorio raíz si TODAS las rutas cuelgan de él, o `null`.
 *
 * Devuelve `null` si hay algún archivo suelto en la raíz. Ese archivo se perdería al
 * subir de nivel, y perder un archivo del usuario en silencio es peor que el 404 que
 * intentábamos evitar.
 */
function singleRootDirectory(paths: readonly string[]): string | null {
  if (paths.length === 0) return null;

  let root: string | null = null;
  for (const path of paths) {
    const slash = path.indexOf("/");
    if (slash < 0) return null; // archivo suelto en la raíz

    const segment = path.slice(0, slash);
    if (root === null) root = segment;
    else if (root !== segment) return null; // más de un directorio raíz
  }

  return root;
}

/** Archivos HTML encontrados, para que el mensaje de error pueda nombrarlos. */
function htmlFilesIn(paths: readonly string[]): string[] {
  return paths.filter((path) => /\.html?$/i.test(path));
}
