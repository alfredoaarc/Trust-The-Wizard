/**
 * Tests de `safeEntryPath`.
 *
 * Los fixtures de `pipeline.test.ts` prueban el pipeline entero con ZIP reales. Aquí
 * se barre la superficie de nombres, que es mucho más ancha de lo que cabe en un
 * puñado de archivos: cada variante conocida de zip slip es una línea.
 *
 * Si alguna vez aparece un CVE de traversal en otro producto, el sitio donde se añade
 * el caso es este.
 */

import { describe, expect, it } from "vitest";
import { IngestError } from "./errors.js";
import { safeEntryPath } from "./paths.js";

/** Rutas que deben rechazarse, agrupadas por la técnica que emplean. */
const HOSTILE: Readonly<Record<string, readonly string[]>> = {
  "traversal simple": [
    "../evil.txt",
    "../../evil.txt",
    "../../../../../../../../etc/passwd",
    "a/../../evil.txt",
    "a/b/../../../evil.txt",
  ],
  "traversal enterrado": [
    // El `..` no está al principio, que es donde miran las comprobaciones ingenuas.
    "assets/../../evil.txt",
    "assets/img/../../../evil.txt",
    "a/./../../evil.txt",
  ],
  "separador de Windows": [
    "..\\evil.txt",
    "..\\..\\windows\\system32\\evil.dll",
    "assets\\..\\..\\evil.txt",
    // Mezcla de separadores: la comprobación no puede depender de cuál se use.
    "assets/..\\../evil.txt",
    "assets\\../..\\evil.txt",
  ],
  "rutas absolutas": [
    "/etc/passwd",
    "/",
    "//servidor/recurso/evil.txt",
    "C:/Windows/evil.txt",
    "C:\\Windows\\evil.txt",
    "z:/evil.txt",
  ],
  "caracteres de control": [
    "logo\u0000.png",
    "index\u0000.html",
    "a\u001fb.txt",
    "a\u007fb.txt",
  ],
  "puntos y espacios finales": [
    // Windows los elimina al escribir, así que lo validado y lo escrito difieren.
    "index.html.",
    "index.html ",
    "carpeta./index.html",
    "carpeta /index.html",
    // Un segmento de solo puntos cae en la misma regla. Es legítimo en POSIX, pero
    // ningún sitio web real lo usa y en Windows tampoco sobrevive.
    ".../a.txt",
  ],
};

describe("safeEntryPath rechaza", () => {
  for (const [technique, paths] of Object.entries(HOSTILE)) {
    describe(technique, () => {
      it.each(paths)("«%s»", (path) => {
        expect(() => safeEntryPath(path)).toThrow(IngestError);
      });
    });
  }

  it("una ruta más profunda que el máximo", () => {
    expect(() => safeEntryPath(`${"a/".repeat(40)}index.html`)).toThrow(IngestError);
  });

  it("una ruta más larga que el máximo", () => {
    expect(() => safeEntryPath(`${"a".repeat(2000)}.html`)).toThrow(IngestError);
  });
});

describe("safeEntryPath acepta y normaliza", () => {
  const accepted: readonly (readonly [string, string])[] = [
    ["index.html", "index.html"],
    ["assets/app.css", "assets/app.css"],
    ["./index.html", "index.html"],
    ["a//b.txt", "a/b.txt"],
    ["./a/./b.txt", "a/b.txt"],
    // Acentos, eñes y espacios: son nombres normales en español y tienen que pasar.
    ["imágenes/logotipo.png", "imágenes/logotipo.png"],
    ["Mi Página.html", "Mi Página.html"],
    ["año-2026/informe.pdf", "año-2026/informe.pdf"],
    // Un archivo que empieza por punto no es una extensión oculta ni un error.
    ["carpeta/.htaccess", "carpeta/.htaccess"],
  ];

  it.each(accepted)("«%s» → «%s»", (input, expected) => {
    expect(safeEntryPath(input)).toBe(expected);
  });
});

describe("safeEntryPath ignora en silencio", () => {
  const ignored: readonly string[] = [
    "__MACOSX/._index.html",
    ".DS_Store",
    "carpeta/.DS_Store",
    "Thumbs.db",
    ".env",
    ".env.local",
    "node_modules/left-pad/index.js",
    ".git/config",
    // Entradas de directorio: no hay contenido que publicar.
    "assets/",
    "",
    ".",
  ];

  it.each(ignored)("«%s»", (path) => {
    expect(safeEntryPath(path)).toBeNull();
  });
});

describe("los mensajes no filtran el nombre hostil sin escapar", () => {
  it("sustituye los caracteres de control antes de mostrarlos", () => {
    // El mensaje acaba renderizado en el panel del usuario. Un nombre con bytes de
    // control no puede llegar ahí tal cual.
    try {
      safeEntryPath("logo\u0000\u001b[31m.png");
      throw new Error("debería haber fallado");
    } catch (error) {
      expect(error).toBeInstanceOf(IngestError);
      // eslint-disable-next-line no-control-regex
      expect((error as IngestError).message).not.toMatch(/[\u0000-\u001f]/);
    }
  });

  it("recorta un nombre larguísimo", () => {
    try {
      safeEntryPath(`../${"a".repeat(500)}.txt`);
      throw new Error("debería haber fallado");
    } catch (error) {
      expect((error as IngestError).message.length).toBeLessThan(200);
    }
  });
});
