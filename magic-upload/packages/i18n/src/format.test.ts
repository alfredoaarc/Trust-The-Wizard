import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatEuros,
  formatList,
  formatNumber,
  formatPercent,
  formatRelative,
  formatTime,
} from "./format.js";

/**
 * El espacio que Intl inserta antes del símbolo de moneda es un espacio duro
 * (U+00A0), no un espacio normal. Normalizamos para que las aserciones se lean.
 */
const nbsp = (s: string) => s.replace(/ /g, " ").replace(/ /g, " ");

describe("formatEuros", () => {
  it("pone el símbolo detrás, con espacio, y usa coma decimal", () => {
    expect(nbsp(formatEuros(899))).toBe("8,99 €");
  });

  it("separa los miles con punto", () => {
    expect(nbsp(formatEuros(123_456))).toBe("1.234,56 €");
  });

  it("formatea el cero sin caso especial", () => {
    expect(nbsp(formatEuros(0))).toBe("0,00 €");
  });

  it("admite ocultar los decimales para precios redondos", () => {
    expect(nbsp(formatEuros(3900, { decimals: false }))).toBe("39 €");
  });

  it("formatea importes negativos, que existen en las rectificativas", () => {
    expect(nbsp(formatEuros(-899))).toBe("-8,99 €");
  });

  it("no pierde céntimos en importes grandes", () => {
    // 0,1 + 0,2 en euros daría 0,30000000000000004. En céntimos no hay error posible.
    expect(nbsp(formatEuros(10 + 20))).toBe("0,30 €");
  });
});

describe("formatNumber y formatPercent", () => {
  it("usa punto para los miles", () => {
    expect(formatNumber(1_234_567)).toBe("1.234.567");
  });

  it("usa coma para los decimales", () => {
    expect(formatNumber(1234.5, 2)).toBe("1.234,50");
  });

  it("escribe el tipo impositivo entero sin decimales sobrantes", () => {
    expect(nbsp(formatPercent(21))).toBe("21 %");
  });

  it("conserva los decimales de un tipo no entero", () => {
    expect(nbsp(formatPercent(10.5))).toBe("10,50 %");
  });
});

describe("fechas", () => {
  // 9 de agosto de 2026, 19:42 hora peninsular (CEST = UTC+2).
  const d = new Date("2026-08-09T17:42:00Z");

  it("escribe la fecha en dd/mm/aaaa", () => {
    expect(formatDate(d)).toBe("09/08/2026");
  });

  it("escribe la hora en 24 h y en hora peninsular", () => {
    expect(formatTime(d)).toBe("19:42");
  });

  it("combina fecha y hora", () => {
    expect(nbsp(formatDateTime(d))).toBe("09/08/2026, 19:42");
  });

  it("aplica el horario de invierno cuando toca", () => {
    // 15 de enero, CET = UTC+1.
    expect(formatTime(new Date("2026-01-15T18:42:00Z"))).toBe("19:42");
  });
});

describe("formatBytes", () => {
  it("usa las mismas unidades que el explorador del usuario", () => {
    // El caso del brief: un PDF de 34 MB frente a un límite de 25 MB.
    expect(formatBytes(34 * 1024 * 1024)).toBe("34 MB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("25 MB");
  });

  it("da un decimal por debajo de 10 y ninguno por encima", () => {
    expect(formatBytes(Math.round(9.4 * 1024 * 1024))).toBe("9,4 MB");
    expect(formatBytes(Math.round(12.7 * 1024 * 1024))).toBe("13 MB");
  });

  it("no inventa unidades para tamaños pequeños", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("escala hasta gigabytes, que es el tope del plan Agencia", () => {
    expect(formatBytes(2 * 1024 ** 3)).toBe("2 GB");
  });
});

describe("formatList", () => {
  it("une con «y», no con «and»", () => {
    expect(formatList(["Dinahosting", "Raiola", "Webempresa"]))
      .toBe("Dinahosting, Raiola y Webempresa");
  });

  it("no añade coma con dos elementos", () => {
    expect(formatList(["Ceuta", "Melilla"])).toBe("Ceuta y Melilla");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-08-09T19:42:00Z");

  it("dice «ayer» en lugar de «hace 1 día»", () => {
    expect(formatRelative(new Date("2026-08-08T19:42:00Z"), now)).toBe("ayer");
  });

  it("cuenta minutos para el pasado reciente", () => {
    expect(formatRelative(new Date("2026-08-09T19:39:00Z"), now)).toBe("hace 3 minutos");
  });

  it("cuenta horas dentro del mismo día", () => {
    expect(formatRelative(new Date("2026-08-09T15:42:00Z"), now)).toBe("hace 4 horas");
  });
});
