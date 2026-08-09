/**
 * Pipeline de ingesta: validar → extraer → escanear.
 *
 * El orden importa y no es casual. Todo lo que se puede decidir leyendo metadatos se
 * decide ANTES de inflar un solo byte, porque inflar es justamente lo que una zip
 * bomb quiere que hagamos. Cuando llegamos a la fase de inflado, el ZIP ya ha
 * demostrado que dice tamaños razonables; y aun así el inflado lleva su propio tope,
 * porque los tamaños declarados pueden mentir.
 *
 * Este módulo NO escribe en R2 ni toca la base de datos: devuelve el contenido ya
 * validado y deja que quien lo llame decida qué hacer con él. Así se puede probar
 * entero sin infraestructura, que es la única forma de tener tests de seguridad
 * fiables.
 */

import {
  ARCHIVE_EXTENSIONS,
  BLOCKED_EXTENSIONS,
  MAX_COMPRESSION_RATIO,
  MAX_ENTRIES,
  MAX_ENTRY_UNCOMPRESSED_BYTES,
  MAX_UNCOMPRESSED_BYTES,
  contentTypeFor,
  extensionOf,
} from "@magic-upload/config";
import { isOfficeDocument, renderCoverPage } from "./cover-page.js";
import { planEntryFile } from "./entry-file.js";
import { ingestErrors } from "./errors.js";
import { isZip, looksLikeHtml, sniffExecutable } from "./magic.js";
import { safeEntryPath } from "./paths.js";
import { inflateEntry, readCentralDirectory, type ZipEntry } from "./zip.js";

/**
 * Suelo por debajo del cual no se aplica el control de ratio.
 *
 * Un archivo diminuto da ratios enormes por pura aritmética: 20 bytes comprimidos que
 * se inflan a 3 KB son un ratio de 150:1 y son un CSS perfectamente normal. Sin este
 * suelo, el control de zip bomb rechazaría webs legítimas.
 */
const RATIO_FLOOR_BYTES = 1024;

/** Extensiones de código de servidor, para poder dar un mensaje distinto. */
const SERVER_CODE_EXTENSIONS = new Set([
  ".php", ".phtml", ".php3", ".php4", ".php5", ".phar",
  ".asp", ".aspx", ".jsp", ".cgi", ".pl",
]);

export interface IngestedFile {
  /** Ruta relativa dentro del sitio, ya sin el prefijo que se haya subido de nivel. */
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

export interface IngestResult {
  readonly files: readonly IngestedFile[];
  readonly entryFile: string;
  readonly totalBytes: number;
  readonly fileCount: number;
  /** Prefijo que se ha eliminado al subir de nivel. Vacío si no hizo falta. */
  readonly hoistedFrom: string;
}

/**
 * Ingesta de un ZIP.
 *
 * @param buf Contenido completo del ZIP.
 */
export function ingestZip(buf: Uint8Array): IngestResult {
  if (buf.length === 0) throw ingestErrors.archivoVacio();
  if (!isZip(buf)) throw ingestErrors.zipCorrupto();

  const entries = readCentralDirectory(buf);

  // ── Fase 1: validación de metadatos. Ni un byte inflado todavía. ──────────────
  const accepted = validateEntries(entries, buf.length);

  // ── Fase 2: inflado con presupuesto decreciente. ──────────────────────────────
  //
  // El presupuesto es global, no por archivo: cien entradas que declaran 1 KB y se
  // inflan a 100 MB cada una pasarían cualquier control individual. Al descontar del
  // mismo saco, la número 51 se queda sin presupuesto y aborta.
  let remaining = MAX_UNCOMPRESSED_BYTES;
  const files: IngestedFile[] = [];

  for (const { entry, path } of accepted) {
    const cap = Math.min(MAX_ENTRY_UNCOMPRESSED_BYTES, remaining);
    const bytes = inflateEntry(buf, entry, cap);

    remaining -= bytes.length;
    if (remaining < 0) {
      throw ingestErrors.descomprimidoDemasiadoGrande(MAX_UNCOMPRESSED_BYTES, MAX_UNCOMPRESSED_BYTES);
    }

    // ── Fase 3: escaneo del contenido real. ────────────────────────────────────
    //
    // Aquí es donde se caza el ejecutable renombrado a `.png`. La comprobación por
    // extensión de la fase 1 da buenos mensajes; esta es la que no se puede esquivar.
    const kind = sniffExecutable(bytes);
    if (kind !== null) throw ingestErrors.archivoEjecutable(path);

    files.push({ path, bytes, contentType: contentTypeFor(path) });
  }

  if (files.length === 0) throw ingestErrors.archivoVacio();

  const plan = planEntryFile(files.map((file) => file.path));

  return {
    files: plan.strip ? files.map((file) => ({ ...file, path: file.path.slice(plan.strip.length) })) : files,
    entryFile: plan.entryFile,
    totalBytes: files.reduce((sum, file) => sum + file.bytes.length, 0),
    fileCount: files.length,
    hoistedFrom: plan.strip,
  };
}

interface AcceptedEntry {
  readonly entry: ZipEntry;
  readonly path: string;
}

/**
 * Valida todas las entradas leyendo solo metadatos.
 *
 * Si algo falla aquí, el ZIP se rechaza entero sin haber inflado nada. Es la
 * diferencia entre gastar unos microsegundos y gastar la memoria de la máquina.
 */
function validateEntries(entries: readonly ZipEntry[], archiveBytes: number): AcceptedEntry[] {
  if (entries.length > MAX_ENTRIES) {
    throw ingestErrors.demasiadosArchivos(entries.length, MAX_ENTRIES);
  }

  const accepted: AcceptedEntry[] = [];
  let declaredTotal = 0;

  for (const entry of entries) {
    // Zip slip. Va primero porque es lo estructural: si la ruta no es segura, nada de
    // lo que venga después importa.
    const path = safeEntryPath(entry.rawName);
    if (path === null) continue; // entrada ignorada (metadatos del SO) o directorio

    if (entry.isDirectory) continue;

    // Enlaces simbólicos: no los seguimos y no los publicamos. El «contenido» de un
    // enlace es la ruta a la que apunta, así que publicarlo sería, en el mejor caso,
    // publicar basura, y en el peor, filtrar la estructura del servidor.
    if (entry.isSymlink) throw ingestErrors.enlaceSimbolico(path);

    const extension = extensionOf(path);

    if (SERVER_CODE_EXTENSIONS.has(extension)) {
      throw ingestErrors.codigoDeServidor(path, extension);
    }
    if (BLOCKED_EXTENSIONS.includes(extension)) {
      throw ingestErrors.archivoEjecutable(path);
    }

    // Un ZIP dentro del ZIP no se descomprime: se guarda inerte. La bomba recursiva
    // vive precisamente de que el extractor sea «servicial».
    if (ARCHIVE_EXTENSIONS.includes(extension)) {
      // Se acepta como archivo opaco; `contentTypeFor` le dará octet-stream.
    }

    if (entry.uncompressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES) {
      throw ingestErrors.descomprimidoDemasiadoGrande(entry.uncompressedSize, MAX_ENTRY_UNCOMPRESSED_BYTES);
    }

    // Ratio por entrada. El suelo evita castigar a los archivos pequeños, donde un
    // ratio alto es aritmética normal y no un ataque.
    if (entry.compressedSize >= RATIO_FLOOR_BYTES) {
      const ratio = entry.uncompressedSize / entry.compressedSize;
      if (ratio > MAX_COMPRESSION_RATIO) {
        throw ingestErrors.compresionSospechosa(path);
      }
    }

    declaredTotal += entry.uncompressedSize;
    if (declaredTotal > MAX_UNCOMPRESSED_BYTES) {
      throw ingestErrors.descomprimidoDemasiadoGrande(declaredTotal, MAX_UNCOMPRESSED_BYTES);
    }

    accepted.push({ entry, path });
  }

  // Ratio global. Caza la bomba repartida en muchas entradas, donde cada una pasa el
  // control individual pero la suma no tiene sentido.
  if (archiveBytes >= RATIO_FLOOR_BYTES && declaredTotal / archiveBytes > MAX_COMPRESSION_RATIO) {
    throw ingestErrors.compresionSospechosa("el ZIP completo");
  }

  return accepted;
}

/**
 * Ingesta de un archivo suelto: `.html`, `.pdf`, una imagen.
 *
 * Es el camino del «hola mundo» del negocio: alguien genera un HTML con una IA, lo
 * arrastra, y tiene una URL. Sin ZIP de por medio.
 */
export function ingestSingleFile(filename: string, buf: Uint8Array): IngestResult {
  if (buf.length === 0) throw ingestErrors.archivoVacio();

  const extension = extensionOf(filename);

  if (SERVER_CODE_EXTENSIONS.has(extension)) {
    throw ingestErrors.codigoDeServidor(filename, extension);
  }
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    throw ingestErrors.archivoEjecutable(filename);
  }
  if (sniffExecutable(buf) !== null) {
    throw ingestErrors.archivoEjecutable(filename);
  }

  // Un HTML suelto se publica siempre como `index.html`, se llame como se llame el
  // archivo del usuario. Es lo que hace que la URL sea la raíz del sitio y no
  // `…/propuesta-final-v3-DEFINITIVA.html`.
  const isHtml = extension === ".html" || extension === ".htm" || looksLikeHtml(buf);
  const path = isHtml ? "index.html" : sanitizeFilename(filename);
  const file: IngestedFile = { path, bytes: buf, contentType: contentTypeFor(path) };

  // Los documentos de ofimática se sirven como descarga, pero con una portada delante:
  // la raíz del sitio es un HTML que dice qué es y ofrece el botón. El visitante es el
  // cliente de nuestro usuario y no puede caer en una descarga sin contexto.
  if (isOfficeDocument(path)) {
    const cover = renderCoverPage({ filename: path, bytes: buf.length });

    return {
      files: [
        file,
        {
          path: "index.html",
          bytes: new TextEncoder().encode(cover),
          contentType: contentTypeFor("index.html"),
        },
      ],
      entryFile: "index.html",
      totalBytes: buf.length,
      fileCount: 1, // la portada la generamos nosotros; no cuenta como archivo del usuario
      hoistedFrom: "",
    };
  }

  return {
    files: [file],
    entryFile: path,
    totalBytes: buf.length,
    fileCount: 1,
    hoistedFrom: "",
  };
}

/**
 * Reduce el nombre subido a un nombre de archivo seguro.
 *
 * El navegador puede mandar una ruta completa en algunos casos de arrastre, y el
 * nombre lo eligió el usuario, no nosotros.
 */
function sanitizeFilename(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? "archivo";
  const safe = safeEntryPath(base);
  if (safe === null) throw ingestErrors.tipoNoSoportado(extensionOf(filename));
  return safe;
}
