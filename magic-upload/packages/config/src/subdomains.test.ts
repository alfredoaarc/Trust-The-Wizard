import { describe, expect, it } from "vitest";
import { siteUrl } from "./domains.js";
import {
  BRAND_LOOKALIKES,
  RESERVED_SUBDOMAINS,
  checkSubdomain,
  suggestAlternatives,
} from "./subdomains.js";

describe("subdominios válidos", () => {
  const validos = [
    "propuesta-acme",
    "clinica-dental-lucia",
    "web2026",
    "abc",
    "a1b2c3",
    "residencia-alentia",
  ];

  it.each(validos)("acepta «%s»", (subdominio) => {
    const resultado = checkSubdomain(subdominio);
    expect(resultado.valid, resultado.message ?? "").toBe(true);
  });

  it("normaliza a minúsculas y quita espacios sobrantes", () => {
    expect(checkSubdomain("  Propuesta-ACME  ").normalized).toBe("propuesta-acme");
  });
});

describe("subdominios rechazados", () => {
  const casos = [
    ["ab", "too_short"],
    ["a".repeat(64), "too_long"],
    ["-propuesta", "leading_or_trailing_hyphen"],
    ["propuesta-", "leading_or_trailing_hyphen"],
    ["mi--web", "double_hyphen"],
    ["xn--muleta", "double_hyphen"],
    ["mi web", "invalid_characters"],
    ["diseño", "invalid_characters"],
    ["cliente@acme", "invalid_characters"],
    ["MI_WEB", "invalid_characters"],
  ] as const;

  it.each(casos)("«%s» → %s", (subdominio, razon) => {
    const resultado = checkSubdomain(subdominio);
    expect(resultado.valid).toBe(false);
    expect(resultado.reason).toBe(razon);
  });

  it("todos los rechazos explican el problema en español", () => {
    for (const [subdominio] of casos) {
      const { message } = checkSubdomain(subdominio);
      expect(message, subdominio).toBeTruthy();
      expect(message!, subdominio).toMatch(/[.:]$/);
    }
  });
});

describe("reservados", () => {
  it("bloquea los que romperían infraestructura", () => {
    for (const nombre of ["www", "api", "mail", "cdn"]) {
      expect(checkSubdomain(nombre).reason, nombre).toBe("reserved");
    }
  });

  it("bloquea los que permitirían suplantarnos a nosotros", () => {
    // Un sitio en soporte.mgup.site pidiendo credenciales sería phishing contra
    // nuestros propios usuarios, servido por nosotros.
    for (const nombre of ["soporte", "seguridad", "facturacion", "verificar"]) {
      expect(checkSubdomain(nombre).reason, nombre).toBe("reserved");
    }
  });

  it("ningún reservado se puede registrar, sea cual sea el motivo", () => {
    // Es el invariante que de verdad importa.
    for (const nombre of RESERVED_SUBDOMAINS) {
      expect(checkSubdomain(nombre).valid, nombre).toBe(false);
    }
  });

  it("las únicas entradas que no se rechazan por «reservado» son las cortas a propósito", () => {
    // Una entrada que se rechaza por otro motivo es letra muerta: da sensación falsa
    // de cobertura y quedaría libre si ese otro motivo cambiara. Se permiten solo las
    // que están documentadas como defensa por si baja el mínimo de longitud.
    const porOtroMotivo = RESERVED_SUBDOMAINS.filter(
      (nombre) => checkSubdomain(nombre).reason !== "reserved",
    );

    expect(porOtroMotivo.sort()).toEqual(["mx", "ns"]);
  });
});

describe("suplantación de marcas", () => {
  it("bloquea el phishing contra la administración española", () => {
    // Es el señuelo más rentable aquí: multas de la DGT, devoluciones de Hacienda,
    // avisos de Correos.
    for (const nombre of ["aeat-devolucion", "mi-dgt-multas", "correos-envio-2026"]) {
      expect(checkSubdomain(nombre).reason, nombre).toBe("brand_lookalike");
    }
  });

  it("bloquea el phishing bancario", () => {
    for (const nombre of ["bbva-seguro", "acceso-santander", "bizum-cobro"]) {
      expect(checkSubdomain(nombre).reason, nombre).toBe("brand_lookalike");
    }
  });

  it("compara como subcadena, no como igualdad", () => {
    // «bbva» exacto y «bbva-clientes» tienen que caer los dos. Comparar por igualdad
    // dejaría pasar todo lo interesante.
    expect(checkSubdomain("bbva").reason).toBe("brand_lookalike");
    expect(checkSubdomain("bbva-clientes-acceso").reason).toBe("brand_lookalike");
  });

  it("el mensaje no acusa al usuario y ofrece salida", () => {
    // La mayoría de las coincidencias serán legítimas: un apellido, un negocio.
    const { message } = checkSubdomain("correos-de-ana");

    expect(message).toContain("escríbenos");
    expect(message!.toLowerCase()).not.toContain("phishing");
    expect(message!.toLowerCase()).not.toContain("fraude");
  });

  it("la lista no se solapa con la de reservados", () => {
    // Un nombre en las dos listas daría un motivo de rechazo distinto según el orden
    // de las comprobaciones, que es exactamente el tipo de detalle que se rompe solo.
    const solapados = BRAND_LOOKALIKES.filter((marca) => RESERVED_SUBDOMAINS.includes(marca));
    expect(solapados, `en ambas listas: ${solapados.join(", ")}`).toEqual([]);
  });
});

describe("sugerencias cuando el enlace está ocupado", () => {
  it("propone alternativas válidas y libres", () => {
    const ocupados = new Set(["acme", "acme-web"]);
    const sugerencias = suggestAlternatives("acme", (c) => ocupados.has(c));

    expect(sugerencias.length).toBeGreaterThan(0);
    expect(sugerencias).not.toContain("acme-web");
    for (const sugerencia of sugerencias) {
      expect(checkSubdomain(sugerencia).valid, sugerencia).toBe(true);
    }
  });

  it("no propone nada que volvería a rechazarse", () => {
    // Sugerir un enlace que la validación rechaza sería peor que no sugerir nada.
    const sugerencias = suggestAlternatives("bbva", () => false);
    expect(sugerencias).toEqual([]);
  });

  it("no se atasca con un enlace acabado en guion", () => {
    const sugerencias = suggestAlternatives("acme-", () => false);
    for (const sugerencia of sugerencias) {
      expect(checkSubdomain(sugerencia).valid, sugerencia).toBe(true);
    }
  });
});

describe("URL resultante", () => {
  it("se sirve desde el dominio de contenido, nunca desde el corporativo", () => {
    // ADR-0001. Si este test se cae, alguien ha unificado los dominios.
    const url = siteUrl("propuesta-acme");

    expect(url).toBe("https://propuesta-acme.mgup.site");
    expect(url).not.toContain("magicupload.es");
  });
});
