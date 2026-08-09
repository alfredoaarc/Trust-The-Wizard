/**
 * Detección de tipo por número mágico.
 *
 * La comprobación por extensión es la primera barrera y da buenos mensajes de error,
 * pero es trivial de esquivar: basta renombrar `malware.exe` a `logo.png`. Esta es la
 * barrera que de verdad cuenta, porque mira los bytes.
 *
 * Aunque no ejecutamos nada de lo que se sube, alojar un ejecutable importa: lo que
 * nos quema el dominio no es que el binario se ejecute en nuestro servidor, es que
 * `https://algo.mgup.site/factura.exe` circule por correo y acabe en las listas de
 * bloqueo de medio mundo. Ver ADR-0001.
 */

/** Compara los primeros bytes del búfer con una firma. */
function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

/** Lee un entero de 32 bits big-endian. */
function readU32BE(bytes: Uint8Array, offset: number): number | null {
  if (bytes.length < offset + 4) return null;
  return (
    ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0
  );
}

/**
 * Firmas de binarios ejecutables.
 *
 * Nota sobre `0xCAFEBABE`: es a la vez el binario universal («fat») de Mach-O y el
 * `.class` de Java. Bloqueamos los dos, así que la ambigüedad no importa.
 */
const MACHO_MAGICS = new Set([
  0xfeedface, // Mach-O 32 bits
  0xfeedfacf, // Mach-O 64 bits
  0xcefaedfe, // Mach-O 32 bits, byte-swapped
  0xcffaedfe, // Mach-O 64 bits, byte-swapped
  0xcafebabe, // Mach-O universal / Java .class
  0xbebafeca, // Mach-O universal, byte-swapped
]);

export type ExecutableKind =
  | "pe"        // Windows: .exe, .dll, .msi
  | "elf"       // Linux y BSD
  | "macho"     // macOS y Java .class
  | "script"    // shebang: #!/bin/sh
  | "dex"       // Android
  | "wasm";     // WebAssembly

/**
 * Devuelve el tipo de ejecutable si los bytes lo son, o `null` si no.
 *
 * Basta con los primeros 8 bytes; el pipeline nunca necesita cargar el archivo entero
 * en memoria para decidir.
 */
export function sniffExecutable(bytes: Uint8Array): ExecutableKind | null {
  // MZ — cabecera DOS, presente en todo ejecutable de Windows.
  if (startsWith(bytes, [0x4d, 0x5a])) return "pe";

  // \x7fELF
  if (startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) return "elf";

  // dex\n035\0 — Android
  if (startsWith(bytes, [0x64, 0x65, 0x78, 0x0a])) return "dex";

  // \0asm — WebAssembly. No lo ejecutamos nosotros, pero un .wasm suelto en la raíz
  // no es contenido publicable y sí es un vector de distribución.
  if (startsWith(bytes, [0x00, 0x61, 0x73, 0x6d])) return "wasm";

  // #! — script con intérprete declarado.
  if (startsWith(bytes, [0x23, 0x21])) return "script";

  const magic = readU32BE(bytes, 0);
  if (magic !== null && MACHO_MAGICS.has(magic)) return "macho";

  return null;
}

/**
 * Detecta si los bytes son un ZIP.
 *
 * Se usa para dos cosas distintas:
 *   · confirmar que el contenedor subido es realmente un ZIP, y
 *   · detectar un ZIP anidado dentro del ZIP, que NO descomprimimos (es el vector de
 *     la zip bomb recursiva). Se almacena inerte.
 *
 * `PK\x03\x04` es la cabecera local; `PK\x05\x06` es un ZIP vacío.
 */
export function isZip(bytes: Uint8Array): boolean {
  return (
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
  );
}

export function isPdf(bytes: Uint8Array): boolean {
  return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]); // %PDF
}

/**
 * ¿Parece HTML?
 *
 * Deliberadamente tolerante: un HTML escrito a mano, o generado por una IA, puede
 * empezar por un comentario, por un BOM o directamente por `<html>`. Un falso negativo
 * aquí frustra al usuario justo en el caso que más queremos capturar.
 */
export function looksLikeHtml(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 512))
    .replace(/^﻿/, "")
    .trimStart()
    .toLowerCase();

  return (
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.startsWith("<head") ||
    head.startsWith("<!--") ||
    head.startsWith("<meta")
  );
}
