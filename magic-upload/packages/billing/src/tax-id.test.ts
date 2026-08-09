/**
 * Tests de validación de NIF, CIF y NIE.
 *
 * Lo que se prueba aquí es que se valida **el dígito de control**, no el formato. Una
 * expresión regular acepta `12345678A` y `12345678Z` por igual; solo una de las dos es
 * un NIF. La consecuencia de colar el otro es una factura que la gestoría del cliente
 * rechaza y que, al ser inmutable, hay que rectificar.
 *
 * Los identificadores de este archivo son sintéticos: se han construido aplicando el
 * algoritmo a números arbitrarios, no pertenecen a nadie.
 */

import { describe, expect, it } from "vitest";
import {
  normalizeTaxId,
  validateEuVatFormat,
  validateSpanishTaxId,
  vatPrefixFor,
} from "./tax-id.js";

describe("NIF de persona física", () => {
  // 12345678 % 23 = 14 → "TRWAGMYFPDXBNJZSQVHLCKE"[14] = "Z"
  const validos = ["12345678Z", "00000000T", "99999999R", "11111111H"];

  it.each(validos)("acepta %s", (nif) => {
    const resultado = validateSpanishTaxId(nif);
    expect(resultado.valid, resultado.error ?? "").toBe(true);
    expect(resultado.kind).toBe("nif");
  });

  it("rechaza la letra equivocada", () => {
    // Es LA prueba de que no estamos usando solo un regex: el formato es idéntico.
    const resultado = validateSpanishTaxId("12345678A");

    expect(resultado.valid).toBe(false);
    expect(resultado.kind).toBe("nif");
    expect(resultado.error).toContain("Z"); // dice cuál sería la correcta
  });

  it("rechaza las 22 letras incorrectas y acepta solo la buena", () => {
    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const aceptadas = letras.filter((l) => validateSpanishTaxId(`12345678${l}`).valid);

    expect(aceptadas).toEqual(["Z"]);
  });

  it("rechaza longitudes que no son 9", () => {
    for (const malo of ["1234567Z", "123456789Z", "", "Z"]) {
      expect(validateSpanishTaxId(malo).valid, malo).toBe(false);
    }
  });
});

describe("NIE", () => {
  // X → 0, Y → 1, Z → 2, y después el mismo algoritmo que el NIF.
  const validos = ["X0000000T", "Y0000000Z", "Z0000000M", "X1234567L"];

  it.each(validos)("acepta %s", (nie) => {
    const resultado = validateSpanishTaxId(nie);
    expect(resultado.valid, resultado.error ?? "").toBe(true);
    expect(resultado.kind).toBe("nie");
  });

  it("sustituye la inicial por el dígito correcto", () => {
    // Si X, Y y Z se trataran igual, estos tres tendrían la misma letra de control.
    const control = (nie: string) => validateSpanishTaxId(nie).valid;

    expect(control("X0000000T")).toBe(true);
    expect(control("Y0000000T")).toBe(false); // Y0000000 = 10000000 → letra distinta
    expect(control("Z0000000T")).toBe(false);
  });

  it("rechaza una inicial que no es X, Y ni Z", () => {
    expect(validateSpanishTaxId("W0000000T").kind).not.toBe("nie");
  });
});

describe("CIF de persona jurídica", () => {
  it("acepta una sociedad limitada con control numérico", () => {
    // B con control numérico. B12345674: suma de control = 4.
    const resultado = validateSpanishTaxId("B12345674");
    expect(resultado.valid, resultado.error ?? "").toBe(true);
    expect(resultado.kind).toBe("cif");
  });

  it("acepta un organismo público con control por letra", () => {
    // Las entidades P, Q, R, S, N, W y K llevan SIEMPRE letra de control.
    const resultado = validateSpanishTaxId("P1234567D");
    expect(resultado.valid, resultado.error ?? "").toBe(true);
  });

  it("rechaza un control numérico donde debe ir letra", () => {
    // Mismo cuerpo que el anterior, control 4 en lugar de D.
    expect(validateSpanishTaxId("P12345674").valid).toBe(false);
  });

  it("rechaza el control equivocado", () => {
    const resultado = validateSpanishTaxId("B12345670");
    expect(resultado.valid).toBe(false);
    expect(resultado.error).toContain("control");
  });

  it("rechaza una letra inicial que no existe", () => {
    // I, K, L, M, O, T, X, Y, Z no son iniciales válidas de CIF.
    for (const inicial of ["I", "L", "M", "O"]) {
      expect(validateSpanishTaxId(`${inicial}1234567A`).valid, inicial).toBe(false);
    }
  });
});

describe("normalización", () => {
  it("acepta el identificador escrito como lo escribe la gente", () => {
    for (const escrito of ["12345678Z", "12345678-Z", "12345678 z", " 12.345.678-Z "]) {
      expect(validateSpanishTaxId(escrito).valid, escrito).toBe(true);
    }
  });

  it("devuelve siempre la forma canónica", () => {
    expect(validateSpanishTaxId(" 12.345.678-z ").normalized).toBe("12345678Z");
    expect(normalizeTaxId("es b-1234567 4")).toBe("ESB12345674");
  });
});

describe("NIF-IVA intracomunitario", () => {
  it("Grecia usa el prefijo EL, no GR", () => {
    // El clásico que rompe cualquier validación escrita a partir de ISO 3166.
    expect(vatPrefixFor("GR")).toBe("EL");
    expect(vatPrefixFor("DE")).toBe("DE");

    expect(validateEuVatFormat("EL123456789").valid).toBe(true);
    expect(validateEuVatFormat("GR123456789").valid).toBe(false);
  });

  it("acepta formatos de varios estados miembros", () => {
    for (const vat of ["DE123456789", "FRAA123456789", "IT12345678901", "PT123456789"]) {
      expect(validateEuVatFormat(vat).valid, vat).toBe(true);
    }
  });

  it("rechaza un país que no es de la UE", () => {
    const resultado = validateEuVatFormat("GB123456789");
    expect(resultado.valid).toBe(false);
    expect(resultado.error).toContain("Unión Europea");
  });

  it("es solo una comprobación de formato: la autoridad es VIES", () => {
    // Este identificador tiene formato correcto y no existe. Nosotros no podemos
    // saberlo; VIES sí. Por eso el resultado de VIES se guarda con su fecha, como
    // prueba de diligencia.
    expect(validateEuVatFormat("DE999999999").valid).toBe(true);
  });
});

describe("los mensajes de error se pueden enseñar al usuario", () => {
  const invalidos = ["12345678A", "B12345670", "X0000000A", "GB123456789"];

  it.each(invalidos)("«%s» explica el problema en español", (id) => {
    const resultado = id.startsWith("GB")
      ? validateEuVatFormat(id)
      : validateSpanishTaxId(id);

    expect(resultado.valid).toBe(false);
    expect(resultado.error).toBeTruthy();
    expect(resultado.error!).toMatch(/[.:]$/);
    expect(resultado.error!).not.toMatch(/\b(invalid|checksum|failed)\b/i);
  });
});
