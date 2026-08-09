/**
 * Lector de ZIP con la defensa contra zip bomb integrada.
 *
 * Por qué no usamos una biblioteca de terceros: necesitamos leer **el directorio
 * central antes de descomprimir nada**. El directorio central declara el tamaño de
 * cada entrada, así que podemos rechazar un ZIP completo sin haber inflado un solo
 * byte. La mayoría de las bibliotecas están orientadas a extraer, no a decidir si
 * extraer, y para eso hay que pelearse con ellas.
 *
 * Y hay una segunda razón, más importante: **el tamaño declarado puede mentir**. Una
 * zip bomb declara 1 KB y se infla a 4 GB. Por eso hay dos barreras, no una:
 *
 *   1. Antes de inflar: se suman los tamaños declarados y se comprueban los ratios.
 *      Frena la bomba honesta y es gratis.
 *   2. Al inflar: un tope duro de bytes de salida que aborta el inflado en cuanto se
 *      supera. Frena la bomba que miente, que es la que importa.
 *
 * Una biblioteca que solo hace lo primero da una falsa sensación de seguridad.
 */

import { inflateRawSync } from "node:zlib";
import { ingestErrors } from "./errors.js";

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const SIG_CENTRAL_HEADER = 0x02014b50;
const SIG_LOCAL_HEADER = 0x04034b50;

/** Marca de «este campo de 32 bits se ha desbordado, mira el bloque ZIP64». */
const ZIP64_SENTINEL = 0xffffffff;

/** `S_IFLNK`: bits de modo POSIX que identifican un enlace simbólico. */
const S_IFMT = 0xf000;
const S_IFLNK = 0xa000;

export const COMPRESSION_STORE = 0;
export const COMPRESSION_DEFLATE = 8;

export interface ZipEntry {
  /**
   * Nombre tal cual viene en el ZIP, sin normalizar ni validar.
   * Pásalo por `safeEntryPath()` antes de usarlo para nada.
   */
  readonly rawName: string;
  readonly compressedSize: number;
  /** Tamaño declarado en el directorio central. **Puede mentir.** */
  readonly uncompressedSize: number;
  readonly compressionMethod: number;
  readonly localHeaderOffset: number;
  readonly isSymlink: boolean;
  readonly isDirectory: boolean;
}

/**
 * Lee el directorio central del ZIP.
 *
 * No toca los datos comprimidos: solo los metadatos. Es la información con la que se
 * decide si merece la pena inflar algo.
 */
export function readCentralDirectory(buf: Uint8Array): ZipEntry[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const eocd = findEocd(buf, view);

  let { totalEntries, centralDirectoryOffset } = eocd;

  // ZIP64: si alguno de los campos está saturado, la verdad está en el EOCD de 64 bits.
  if (totalEntries === 0xffff || centralDirectoryOffset === ZIP64_SENTINEL) {
    const zip64 = findEocd64(view, eocd.position);
    if (zip64) {
      totalEntries = zip64.totalEntries;
      centralDirectoryOffset = zip64.centralDirectoryOffset;
    }
  }

  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    if (offset + 46 > buf.length) throw ingestErrors.zipCorrupto();
    if (view.getUint32(offset, true) !== SIG_CENTRAL_HEADER) throw ingestErrors.zipCorrupto();

    const compressionMethod = view.getUint16(offset + 10, true);
    let compressedSize = view.getUint32(offset + 20, true);
    let uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttrs = view.getUint32(offset + 38, true);
    let localHeaderOffset = view.getUint32(offset + 42, true);

    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buf.length) throw ingestErrors.zipCorrupto();

    // El ZIP admite dos codificaciones de nombre; el bit 11 marca UTF-8. Sin ese bit
    // la especificación dice CP437, pero en la práctica casi todo el mundo escribe
    // UTF-8 igualmente. Decodificamos como UTF-8 sin fallar: un nombre mal codificado
    // no debe tumbar la subida, y si es hostil lo cazará `safeEntryPath()`.
    const rawName = new TextDecoder("utf-8", { fatal: false }).decode(
      buf.subarray(nameStart, nameEnd),
    );

    if (
      compressedSize === ZIP64_SENTINEL ||
      uncompressedSize === ZIP64_SENTINEL ||
      localHeaderOffset === ZIP64_SENTINEL
    ) {
      const zip64 = readZip64Extra(view, nameEnd, extraLength, {
        uncompressedSize,
        compressedSize,
        localHeaderOffset,
      });
      uncompressedSize = zip64.uncompressedSize;
      compressedSize = zip64.compressedSize;
      localHeaderOffset = zip64.localHeaderOffset;
    }

    // Los 16 bits altos de los atributos externos son el modo POSIX cuando el ZIP se
    // creó en Unix. Ahí es donde se ve que una entrada es un enlace simbólico: el
    // «archivo» solo contiene la ruta a la que apunta.
    const unixMode = (externalAttrs >>> 16) & 0xffff;
    const isSymlink = (unixMode & S_IFMT) === S_IFLNK;

    entries.push({
      rawName,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      localHeaderOffset,
      isSymlink,
      isDirectory: rawName.endsWith("/") || rawName.endsWith("\\"),
    });

    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

/**
 * Infla una entrada con un tope duro de bytes de salida.
 *
 * **Esta es la barrera que de verdad frena la zip bomb**, porque no se fía del tamaño
 * declarado. `maxOutputLength` hace que zlib aborte en cuanto la salida supera el
 * tope, sin llegar a materializar el búfer gigante.
 */
export function inflateEntry(buf: Uint8Array, entry: ZipEntry, maxBytes: number): Uint8Array {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const start = entry.localHeaderOffset;

  if (start + 30 > buf.length) throw ingestErrors.zipCorrupto();
  if (view.getUint32(start, true) !== SIG_LOCAL_HEADER) throw ingestErrors.zipCorrupto();

  // La cabecera local repite el nombre y los extras, y sus longitudes pueden no
  // coincidir con las del directorio central. Hay que leerlas de aquí para saber
  // dónde empiezan los datos.
  const nameLength = view.getUint16(start + 26, true);
  const extraLength = view.getUint16(start + 28, true);
  const dataStart = start + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;

  if (dataEnd > buf.length) throw ingestErrors.zipCorrupto();

  const data = buf.subarray(dataStart, dataEnd);

  if (entry.compressionMethod === COMPRESSION_STORE) {
    // Sin comprimir: el tamaño declarado no puede mentir, es el tamaño real.
    if (data.length > maxBytes) throw ingestErrors.compresionSospechosa(entry.rawName);
    return data;
  }

  if (entry.compressionMethod !== COMPRESSION_DEFLATE) {
    // bzip2, LZMA, XZ… Los ZIP normales no los usan y sus descompresores tienen su
    // propia superficie de ataque. No los soportamos.
    throw ingestErrors.zipCorrupto();
  }

  try {
    return new Uint8Array(inflateRawSync(data, { maxOutputLength: maxBytes }));
  } catch (error) {
    // Node lanza ERR_BUFFER_TOO_LARGE al superar `maxOutputLength`. Cualquier otro
    // fallo de inflado es un ZIP dañado.
    if (isOutputTooLarge(error)) throw ingestErrors.compresionSospechosa(entry.rawName);
    throw ingestErrors.zipCorrupto();
  }
}

function isOutputTooLarge(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === "ERR_BUFFER_TOO_LARGE";
}

interface Eocd {
  position: number;
  totalEntries: number;
  centralDirectoryOffset: number;
}

/**
 * Busca el End of Central Directory recorriendo el final del archivo hacia atrás.
 *
 * El EOCD lleva un comentario de longitud variable al final (hasta 65535 bytes), así
 * que no está en una posición fija: hay que buscarlo.
 */
function findEocd(buf: Uint8Array, view: DataView): Eocd {
  const minSize = 22;
  if (buf.length < minSize) throw ingestErrors.zipCorrupto();

  const maxScan = Math.min(buf.length, 65535 + minSize);
  for (let i = buf.length - minSize; i >= buf.length - maxScan; i -= 1) {
    if (view.getUint32(i, true) !== SIG_EOCD) continue;

    // Confirmamos con la longitud del comentario: sin esto, un ZIP que contenga los
    // bytes `PK\x05\x06` dentro de un archivo podría dar un falso positivo.
    const commentLength = view.getUint16(i + 20, true);
    if (i + minSize + commentLength !== buf.length) continue;

    return {
      position: i,
      totalEntries: view.getUint16(i + 10, true),
      centralDirectoryOffset: view.getUint32(i + 16, true),
    };
  }

  throw ingestErrors.zipCorrupto();
}

/** Sigue el localizador ZIP64 que precede al EOCD, si lo hay. */
function findEocd64(view: DataView, eocdPosition: number): Eocd | null {
  const locator = eocdPosition - 20;
  if (locator < 0) return null;
  if (view.getUint32(locator, true) !== SIG_EOCD64_LOCATOR) return null;

  const eocd64Offset = toSafeNumber(view.getBigUint64(locator + 8, true));
  if (eocd64Offset === null || eocd64Offset + 56 > view.byteLength) return null;
  if (view.getUint32(eocd64Offset, true) !== SIG_EOCD64) return null;

  const totalEntries = toSafeNumber(view.getBigUint64(eocd64Offset + 32, true));
  const centralDirectoryOffset = toSafeNumber(view.getBigUint64(eocd64Offset + 48, true));
  if (totalEntries === null || centralDirectoryOffset === null) throw ingestErrors.zipCorrupto();

  return { position: eocd64Offset, totalEntries, centralDirectoryOffset };
}

interface Zip64Sizes {
  uncompressedSize: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/**
 * Lee el campo extra ZIP64 (cabecera 0x0001) de una entrada.
 *
 * Sus campos son posicionales y **solo están presentes si el campo de 32 bits
 * correspondiente estaba saturado**, en este orden: tamaño sin comprimir, tamaño
 * comprimido, offset de la cabecera local, número de disco.
 */
function readZip64Extra(
  view: DataView,
  extraStart: number,
  extraLength: number,
  current: Zip64Sizes,
): Zip64Sizes {
  const result = { ...current };
  let offset = extraStart;
  const end = extraStart + extraLength;

  while (offset + 4 <= end) {
    const headerId = view.getUint16(offset, true);
    const size = view.getUint16(offset + 2, true);
    let field = offset + 4;

    if (headerId === 0x0001) {
      if (result.uncompressedSize === ZIP64_SENTINEL && field + 8 <= end) {
        result.uncompressedSize = requireSafeNumber(view.getBigUint64(field, true));
        field += 8;
      }
      if (result.compressedSize === ZIP64_SENTINEL && field + 8 <= end) {
        result.compressedSize = requireSafeNumber(view.getBigUint64(field, true));
        field += 8;
      }
      if (result.localHeaderOffset === ZIP64_SENTINEL && field + 8 <= end) {
        result.localHeaderOffset = requireSafeNumber(view.getBigUint64(field, true));
      }
      return result;
    }

    offset += 4 + size;
  }

  // El campo de 32 bits estaba saturado pero no hay bloque ZIP64 que lo explique.
  throw ingestErrors.zipCorrupto();
}

function toSafeNumber(value: bigint): number | null {
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

function requireSafeNumber(value: bigint): number {
  const n = toSafeNumber(value);
  if (n === null) throw ingestErrors.zipCorrupto();
  return n;
}
