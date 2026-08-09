import { describe, expect, it } from "vitest";
import { isOfficeDocument, officeDocumentLabel, renderCoverPage } from "./cover-page.js";
import { ingestSingleFile } from "./pipeline.js";

/** Un .docx es un ZIP; solo necesitamos su cabecera para el test. */
const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);

describe("qué recibe portada", () => {
  it("los documentos de ofimática", () => {
    for (const nombre of ["carta.docx", "propuesta.pptx", "precios.xlsx", "acta.odt"]) {
      expect(isOfficeDocument(nombre), nombre).toBe(true);
    }
  });

  it("y nada más: el PDF tiene su propio visor", () => {
    for (const nombre of ["propuesta.pdf", "logo.png", "index.html", "datos.csv"]) {
      expect(isOfficeDocument(nombre), nombre).toBe(false);
    }
  });

  it("la etiqueta está en español", () => {
    expect(officeDocumentLabel("carta.docx")).toBe("Documento de Word");
    expect(officeDocumentLabel("precios.xlsx")).toBe("Hoja de cálculo de Excel");
    expect(officeDocumentLabel("propuesta.pdf")).toBeNull();
  });
});

describe("la portada", () => {
  const html = renderCoverPage({ filename: "carta-de-precios.docx", bytes: 2_400_000 });

  it("está en español y declara el idioma", () => {
    expect(html).toContain('<html lang="es">');
    expect(html).toContain("Descargar");
    expect(html).toContain("Documento de Word");
  });

  it("dice el tamaño con formato español", () => {
    expect(html).toContain("2,3 MB");
  });

  it("no carga nada de fuera", () => {
    // Se sirve desde el dominio de contenido, donde la política de seguridad es
    // restrictiva a propósito (ADR-0001). Sin CSS externo, sin tipografías remotas,
    // sin scripts.
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link[^>]+href/i);
    expect(html).not.toMatch(/https?:\/\/(?!magicupload\.es)/);
  });

  it("enlaza al archivo real con el nombre codificado", () => {
    const conEspacios = renderCoverPage({ filename: "mi carta & precios.docx", bytes: 1000 });
    expect(conEspacios).toContain("href=\"./mi%20carta%20%26%20precios.docx\"");
  });

  it("admite marcar noindex", () => {
    const sin = renderCoverPage({ filename: "a.docx", bytes: 10 });
    const con = renderCoverPage({ filename: "a.docx", bytes: 10, noindex: true });

    expect(sin).not.toContain('name="robots"');
    expect(con).toContain('content="noindex, nofollow"');
  });
});

describe("el nombre del archivo lo elige el usuario", () => {
  it("se escapa antes de meterlo en el HTML", () => {
    // Sin escapar esto sería XSS almacenado. Da igual que el dominio de contenido esté
    // aislado del panel: sería XSS contra el cliente de nuestro usuario, que para él
    // es peor.
    const html = renderCoverPage({
      filename: '<img src=x onerror="alert(1)">.docx',
      bytes: 100,
    });

    // La propiedad que importa no es que la cadena «onerror=» no aparezca —aparece,
    // escapada e inerte, dentro de un nodo de texto— sino que el usuario no pueda
    // abrir una etiqueta ni cerrar un atributo.
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="');
    expect(html).toContain("&lt;img");
    expect(html).toContain("&quot;alert(1)&quot;");
  });

  it("escapa también el nombre del sitio", () => {
    const html = renderCoverPage({
      filename: "a.docx",
      bytes: 10,
      siteName: '"><script>alert(1)</script>',
    });

    expect(html).not.toMatch(/<script>alert/);
  });
});

describe("integración con el pipeline", () => {
  it("publica el documento y genera index.html como portada", () => {
    const resultado = ingestSingleFile("carta.docx", docx);

    expect(resultado.entryFile).toBe("index.html");
    expect(resultado.files.map((f) => f.path).sort()).toEqual(["carta.docx", "index.html"]);
  });

  it("la portada nombra el archivo del usuario", () => {
    const resultado = ingestSingleFile("carta.docx", docx);
    const portada = resultado.files.find((f) => f.path === "index.html")!;

    expect(new TextDecoder().decode(portada.bytes)).toContain("carta.docx");
  });

  it("no cuenta la portada como archivo del usuario", () => {
    // El contador de archivos y los bytes son los del usuario: lo que él subió es un
    // archivo, y lo que él ve en el panel debe coincidir.
    const resultado = ingestSingleFile("carta.docx", docx);

    expect(resultado.fileCount).toBe(1);
    expect(resultado.totalBytes).toBe(docx.length);
  });

  it("un PDF no lleva portada: se sirve directo al visor", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const resultado = ingestSingleFile("propuesta.pdf", pdf);

    expect(resultado.files).toHaveLength(1);
    expect(resultado.entryFile).toBe("propuesta.pdf");
  });
});
