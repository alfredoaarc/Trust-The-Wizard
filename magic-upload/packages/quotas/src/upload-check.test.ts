/**
 * Tests de la comprobación previa a la subida.
 *
 * Además de la aritmética de límites, aquí se prueba **la promesa de marca de
 * ADR-0007**: que el usuario se entera antes de subir, con cifras concretas, y que
 * nunca se queda sin salida.
 *
 * Los tests de redacción no son decorativos. El mensaje de este punto del flujo es el
 * momento en que un usuario no técnico está más cerca de rendirse, y si alguien lo
 * cambia por un «Error: límite excedido» conviene que algo se ponga rojo.
 */

import { normalizeSpaces as nbsp } from "@magic-upload/i18n";
import { describe, expect, it } from "vitest";
import { PLANS, PLAN_ORDER, cheapestPlanAllowing, limitFor } from "./plans.js";
import { checkUpload, displayPrice, type UploadRejected } from "./upload-check.js";

const MB = 1024 * 1024;

function rechazo(input: Parameters<typeof checkUpload>[0]): UploadRejected {
  const resultado = checkUpload(input);
  if (resultado.allowed) throw new Error("Se esperaba un rechazo y se ha permitido.");
  return resultado;
}

describe("el mensaje del brief, literal", () => {
  it("un PDF de 34 MB en el plan gratuito", () => {
    // El caso exacto del documento de producto. Si este test se cae, se ha perdido el
    // mensaje que justifica todo el diseño de esta función.
    const resultado = rechazo({
      plan: "free",
      fileBytes: 34 * MB,
      activeSites: 0,
      isReplacingExistingSite: false,
    });

    expect(resultado.message).toContain("34 MB");
    expect(resultado.message).toContain("25 MB");
    expect(resultado.message).toContain("Básico");
    expect(nbsp(resultado.message)).toContain("8,99 €");
    expect(resultado.message).toContain("100 MB");
    expect(resultado.upgradeTo).toBe("basic");
  });

  it("no se parece en nada a «Upload failed: file too large»", () => {
    const resultado = rechazo({
      plan: "free",
      fileBytes: 34 * MB,
      activeSites: 0,
      isReplacingExistingSite: false,
    });

    expect(resultado.message).not.toMatch(/\b(failed|error|exceeded|limit)\b/i);
    expect(resultado.message.length).toBeGreaterThan(60);
  });
});

describe("nunca se deja al usuario sin salida", () => {
  const rechazos = [
    { plan: "free", fileBytes: 34 * MB, activeSites: 0, isReplacingExistingSite: false },
    { plan: "free", fileBytes: 5 * 1024 * MB, activeSites: 0, isReplacingExistingSite: false },
    { plan: "free", fileBytes: 1 * MB, activeSites: 1, isReplacingExistingSite: false },
    { plan: "agency", fileBytes: 3 * 1024 * MB, activeSites: 0, isReplacingExistingSite: false },
  ] as const;

  it.each(rechazos)("%o ofrece una acción concreta", (input) => {
    const resultado = rechazo(input);

    expect(resultado.action).toBeTruthy();
    expect(resultado.action.length).toBeGreaterThan(15);
  });

  it("cuando ningún plan llega, ofrece hablar con nosotros en lugar de cerrar la puerta", () => {
    const resultado = rechazo({
      plan: "agency",
      fileBytes: 5 * 1024 * MB, // 5 GB, por encima del tope de 2 GB
      activeSites: 0,
      isReplacingExistingSite: false,
    });

    expect(resultado.upgradeTo).toBeNull();
    expect(resultado.action).toContain("Escríbenos");
  });

  it("al llegar al límite de proyectos, sustituir uno es siempre una salida gratis", () => {
    const resultado = rechazo({
      plan: "free",
      fileBytes: 1 * MB,
      activeSites: 1,
      isReplacingExistingSite: false,
    });

    expect(resultado.reason).toBe("site_limit_reached");
    expect(resultado.action).toContain("sustituir");
  });
});

describe("re-subir sobre un sitio existente", () => {
  it("no consume cupo de proyectos", () => {
    // La URL estable entre re-subidas es nuestra ventaja frente a quien crea un
    // proyecto nuevo en cada arrastre. Cobrar por ella sería regalarla.
    const resultado = checkUpload({
      plan: "free",
      fileBytes: 1 * MB,
      activeSites: 1, // ya está en el límite
      isReplacingExistingSite: true,
    });

    expect(resultado.allowed).toBe(true);
  });

  it("pero sigue respetando el límite de tamaño", () => {
    const resultado = checkUpload({
      plan: "free",
      fileBytes: 34 * MB,
      activeSites: 1,
      isReplacingExistingSite: true,
    });

    expect(resultado.allowed).toBe(false);
  });
});

describe("los cuatro valores que son decisión de producto", () => {
  it("25 MB en el plan gratuito, no 3 MB", () => {
    // La competencia da 3 MB y 0,5 MB para PDF. Su única reseña de 0,0 sobre 5 en G2
    // es de alguien que no pudo publicar la carta de un negocio por ese límite.
    expect(limitFor("free", "max_file_bytes")).toBe(25 * MB);
  });

  it("el mismo límite para PDF que para cualquier otro archivo", () => {
    // No hay un límite especial para PDF. Ese es el bug de producto de la competencia.
    const pdf = checkUpload({
      plan: "free",
      fileBytes: 24 * MB,
      activeSites: 0,
      isReplacingExistingSite: false,
    });

    expect(pdf.allowed).toBe(true);
  });

  it("ediciones ilimitadas en todos los planes, incluido el gratuito", () => {
    for (const plan of PLAN_ORDER) {
      expect(limitFor(plan, "daily_publishes"), plan).toBeNull();
    }
  });

  it("escalón de 3 proyectos en Básico", () => {
    // La competencia salta de 1 a 5. El punto intermedio es su fuga de embudo más
    // visible.
    expect(limitFor("basic", "active_sites")).toBe(3);
  });

  it("contraseña disponible en el plan gratuito", () => {
    expect(limitFor("free", "password_sites")).toBe(1);
  });

  it("API disponible desde el plan gratuito", () => {
    // No es generosidad, es supervivencia: cerrarla mata la adopción entre
    // desarrolladores, que son quienes recomiendan.
    expect(limitFor("free", "api_requests_per_minute")).toBeGreaterThan(0);
  });
});

describe("cheapestPlanAllowing", () => {
  it("devuelve el más barato que sirve, no el más caro", () => {
    expect(cheapestPlanAllowing("max_file_bytes", 50 * MB)?.code).toBe("basic");
    expect(cheapestPlanAllowing("max_file_bytes", 200 * MB)?.code).toBe("pro");
    expect(cheapestPlanAllowing("max_file_bytes", 1024 * MB)?.code).toBe("agency");
  });

  it("devuelve el gratuito si el gratuito ya sirve", () => {
    expect(cheapestPlanAllowing("max_file_bytes", 1 * MB)?.code).toBe("free");
  });

  it("devuelve null cuando ningún plan llega", () => {
    expect(cheapestPlanAllowing("max_file_bytes", 100 * 1024 * MB)).toBeNull();
  });

  it("trata «ilimitado» como suficiente para cualquier valor", () => {
    expect(cheapestPlanAllowing("active_sites", 10_000)?.code).toBe("agency");
  });
});

describe("los límites crecen de forma monótona con el precio", () => {
  // Un plan más caro que da menos de algo es un error de configuración que en la
  // página de precios se ve a la legua, pero en un JSON no.
  const numericos = ["active_sites", "max_file_bytes", "custom_domains", "api_requests_per_minute"] as const;

  it.each(numericos)("%s", (key) => {
    let previo = -1;

    for (const code of PLAN_ORDER) {
      const valor = limitFor(code, key);
      if (valor === null) {
        previo = Number.POSITIVE_INFINITY; // ilimitado: a partir de aquí todo vale
        continue;
      }
      expect(valor, `${code}.${key}`).toBeGreaterThanOrEqual(previo);
      previo = valor;
    }
  });

  it("y el precio también", () => {
    let previo = -1;
    for (const code of PLAN_ORDER) {
      expect(PLANS[code].priceCentsMonth, code).toBeGreaterThan(previo);
      previo = PLANS[code].priceCentsMonth;
    }
  });
});

describe("precios mostrados", () => {
  it("con IVA incluido para particulares", () => {
    // Convención española. «9 $ + tax» se lee como extranjero.
    expect(nbsp(displayPrice("basic", "consumer", 21))).toBe("10,88 €/mes, IVA incluido");
  });

  it("desglosado para empresas", () => {
    expect(nbsp(displayPrice("basic", "business", 21))).toBe("8,99 €/mes + IVA");
  });

  it("el plan gratuito no muestra un importe", () => {
    expect(displayPrice("free", "consumer", 21)).toBe("Gratis");
    expect(displayPrice("free", "business", 21)).toBe("Gratis");
  });

  it("redondea a céntimos sin arrastrar error de coma flotante", () => {
    // 1900 * 1,21 = 2299 céntimos exactos. En euros con coma flotante daría 22,989…
    expect(nbsp(displayPrice("pro", "consumer", 21))).toBe("22,99 €/mes, IVA incluido");
  });
});
