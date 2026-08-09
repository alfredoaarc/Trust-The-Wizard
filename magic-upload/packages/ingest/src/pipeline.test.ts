/**
 * Tests del pipeline de ingesta con ZIP maliciosos reales.
 *
 * No hay ni un mock aquí. Cada test lee un `.zip` de verdad, generado por
 * `scripts/build-fixtures.py`, y lo pasa por el pipeline entero. Un test de seguridad
 * contra un objeto simulado prueba que el objeto simulado se comporta como esperamos,
 * que es justo lo que no queremos saber.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IngestError, type IngestErrorCode } from "./errors.js";
import { ingestSingleFile, ingestZip } from "./pipeline.js";

const FIXTURES = fileURLToPath(new URL("../fixtures/", import.meta.url));

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`${FIXTURES}${name}`));
}

/** Ejecuta la ingesta y devuelve el error, exigiendo que sea un `IngestError`. */
function expectRejected(name: string): IngestError {
  try {
    ingestZip(fixture(name));
  } catch (error) {
    if (error instanceof IngestError) return error;
    throw error;
  }
  throw new Error(`Se esperaba que «${name}» fuese rechazado, y se ha aceptado.`);
}

function expectCode(name: string, code: IngestErrorCode): IngestError {
  const error = expectRejected(name);
  expect(error.code, `${name} → ${error.message}`).toBe(code);
  return error;
}

describe("el caso feliz", () => {
  it("publica una web normal sin tocar nada", () => {
    const result = ingestZip(fixture("web-valida.zip"));

    expect(result.entryFile).toBe("index.html");
    expect(result.hoistedFrom).toBe("");
    expect(result.fileCount).toBe(4);
    expect(result.files.map((f) => f.path).sort()).toEqual([
      "estilos.css",
      "img/logo.svg",
      "index.html",
      "sobre-mi.html",
    ]);
  });

  it("asigna el Content-Type por extensión", () => {
    const result = ingestZip(fixture("web-valida.zip"));
    const byPath = new Map(result.files.map((f) => [f.path, f.contentType]));

    expect(byPath.get("index.html")).toBe("text/html; charset=utf-8");
    expect(byPath.get("estilos.css")).toBe("text/css; charset=utf-8");
    expect(byPath.get("img/logo.svg")).toBe("image/svg+xml");
  });
});

describe("zip slip", () => {
  it("rechaza el traversal con ../", () => {
    const error = expectCode("zip-slip.zip", "RUTA_INSEGURA");
    // El mensaje tiene que nombrar la entrada culpable: un ZIP puede traer cientos.
    expect(error.message).toContain("etc/passwd");
  });

  it("trata el separador de Windows como separador", () => {
    expectCode("zip-slip-windows.zip", "RUTA_INSEGURA");
  });

  it("rechaza rutas absolutas POSIX sin ningún ..", () => {
    expectCode("zip-slip-absoluto.zip", "RUTA_INSEGURA");
  });

  it("rechaza rutas absolutas con letra de unidad", () => {
    expectCode("zip-slip-unidad.zip", "RUTA_INSEGURA");
  });

  it("rechaza el ZIP entero, no solo la entrada peligrosa", () => {
    // Publicar el resto y descartar la entrada mala en silencio dejaría al usuario con
    // un sitio incompleto sin saber por qué. Y a nosotros, sin señal de que alguien
    // está probando ataques.
    expectRejected("zip-slip.zip");
  });

  it("rechaza nombres con bytes de control", () => {
    expectCode("nombre-hostil.zip", "RUTA_INSEGURA");
  });
});

describe("enlaces simbólicos", () => {
  it("rechaza un enlace aunque su nombre sea inofensivo", () => {
    const error = expectCode("symlink-escape.zip", "ENLACE_SIMBOLICO");
    expect(error.entry).toBe("secretos.txt");
  });
});

describe("zip bomb", () => {
  it("rechaza por ratio de compresión antes de inflar nada", () => {
    expectCode("zip-bomb-ratio.zip", "COMPRESION_SOSPECHOSA");
  });

  it("rechaza por número de entradas", () => {
    const error = expectCode("zip-bomb-entradas.zip", "DEMASIADOS_ARCHIVOS");
    expect(error.message).toContain("10.001"); // 10.000 entradas + index.html
  });

  it("no descomprime un ZIP anidado: lo guarda inerte", () => {
    const result = ingestZip(fixture("zip-bomb-anidada.zip"));

    // El ZIP interior se infla a 50 MB. Si lo hubiéramos abierto recursivamente,
    // aquí habría 50 MB; se guarda tal cual, comprimido.
    const attachment = result.files.find((f) => f.path === "adjunto.zip");
    expect(attachment).toBeDefined();
    expect(attachment!.bytes.length).toBeLessThan(200 * 1024);
    expect(attachment!.contentType).toBe("application/octet-stream");
  });
});

describe("ejecutables y código de servidor", () => {
  it("rechaza un ejecutable por su extensión", () => {
    const error = expectCode("ejecutable-extension.zip", "ARCHIVO_EJECUTABLE");
    expect(error.entry).toBe("instalador.exe");
  });

  it("caza un ELF renombrado a .png por su número mágico", () => {
    // Esta es la barrera que no se puede esquivar. Si este test se cae, la defensa
    // por extensión se ha quedado sola y no vale nada.
    const error = expectCode("extension-falsa.zip", "ARCHIVO_EJECUTABLE");
    expect(error.message).toContain("img/logo.png");
  });

  it("rechaza PHP con un mensaje que explica por qué", () => {
    const error = expectCode("codigo-de-servidor.zip", "CODIGO_DE_SERVIDOR");
    expect(error.message).toContain("no ejecuta código");
    expect(error.hint).toContain("hosting tradicional");
  });
});

describe("estructura de carpetas", () => {
  it("sube un nivel cuando la web está dentro de una única carpeta", () => {
    // El error nº 1 del usuario no técnico. Se resuelve en silencio.
    const result = ingestZip(fixture("carpeta-anidada.zip"));

    expect(result.hoistedFrom).toBe("mi-web/");
    expect(result.entryFile).toBe("index.html");
    expect(result.files.map((f) => f.path).sort()).toEqual([
      "estilos.css",
      "img/logo.svg",
      "index.html",
    ]);
  });

  it("sube dos niveles si hacen falta", () => {
    const result = ingestZip(fixture("carpeta-doble-anidada.zip"));

    expect(result.hoistedFrom).toBe("descargas/mi-web/");
    expect(result.files.map((f) => f.path).sort()).toEqual(["estilos.css", "index.html"]);
  });

  it("da un error que nombra los HTML cuando no hay index.html", () => {
    const error = expectCode("sin-index.zip", "SIN_PAGINA_DE_INICIO");
    expect(error.hint).toContain("pagina.html");
    expect(error.hint).toContain("index.html");
  });
});

describe("basura del sistema", () => {
  it("ignora los metadatos del sistema operativo sin fallar", () => {
    const result = ingestZip(fixture("basura-del-sistema.zip"));
    const paths = result.files.map((f) => f.path);

    expect(paths).toEqual(["index.html"]);
    expect(paths).not.toContain(".DS_Store");
    expect(paths.some((p) => p.startsWith("__MACOSX"))).toBe(false);
  });

  it("nunca publica un .env", () => {
    // No es limpieza estética: publicar un .env filtra las claves del usuario en una
    // URL pública indexable.
    const result = ingestZip(fixture("basura-del-sistema.zip"));
    expect(result.files.some((f) => f.path === ".env")).toBe(false);
  });

  it("no publica node_modules", () => {
    const result = ingestZip(fixture("basura-del-sistema.zip"));
    expect(result.files.some((f) => f.path.includes("node_modules"))).toBe(false);
  });
});

describe("archivo suelto", () => {
  const html = new TextEncoder().encode("<!doctype html><title>Hola</title>");

  it("renombra cualquier HTML a index.html", () => {
    // Para que la URL sea la raíz del sitio y no
    // …/propuesta-final-v3-DEFINITIVA.html.
    const result = ingestSingleFile("propuesta-final-v3-DEFINITIVA.html", html);

    expect(result.entryFile).toBe("index.html");
    expect(result.files[0]!.path).toBe("index.html");
  });

  it("reconoce el HTML por su contenido aunque la extensión no lo diga", () => {
    const result = ingestSingleFile("pagina.txt", html);
    expect(result.entryFile).toBe("index.html");
  });

  it("conserva el nombre de un PDF", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const result = ingestSingleFile("propuesta.pdf", pdf);

    expect(result.entryFile).toBe("propuesta.pdf");
    expect(result.files[0]!.contentType).toBe("application/pdf");
  });

  it("rechaza un ejecutable suelto", () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    expect(() => ingestSingleFile("logo.png", exe)).toThrow(IngestError);
  });

  it("rechaza un archivo vacío", () => {
    expect(() => ingestSingleFile("index.html", new Uint8Array(0))).toThrow(IngestError);
  });
});

describe("los mensajes de error son producto", () => {
  const cases: readonly string[] = [
    "zip-slip.zip",
    "symlink-escape.zip",
    "zip-bomb-ratio.zip",
    "zip-bomb-entradas.zip",
    "ejecutable-extension.zip",
    "extension-falsa.zip",
    "codigo-de-servidor.zip",
    "sin-index.zip",
  ];

  it.each(cases)("«%s» falla en español, sin jerga y con una salida", (name) => {
    const error = expectRejected(name);

    // Está en español: termina en punto y no usa las palabras del inglés técnico.
    expect(error.message).toMatch(/[.:]$/);
    expect(error.message).not.toMatch(/\b(failed|error|invalid|forbidden|denied)\b/i);

    // No filtra jerga interna al usuario.
    expect(error.message.toLowerCase()).not.toContain("zip slip");
    expect(error.message.toLowerCase()).not.toContain("traversal");
    expect(error.message.toLowerCase()).not.toContain("symlink");

    // Y siempre dice qué hacer: un error sin salida es un usuario perdido.
    expect(error.hint, `«${name}» no dice qué hacer`).toBeTruthy();
    expect(error.hint!.length).toBeGreaterThan(20);
  });
});
