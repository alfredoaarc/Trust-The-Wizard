/**
 * ⚠️ PUNTO DE PARADA Nº 2 — ESTE ARCHIVO ES EL ENTREGABLE A REVISAR CON LA ASESORÍA.
 *
 * Es la matriz de casos fiscales de `docs/facturacion.md` §2 escrita como tabla.
 * Cada fila es un caso real de facturación, con la referencia normativa manejada.
 *
 * Cómo revisarlo sin leer TypeScript: la tabla `MATRIZ` de abajo se lee de izquierda
 * a derecha como una tabla de una hoja de cálculo. Cliente → zona → qué se le cobra.
 *
 * Nada de lo que hay aquí debe darse por bueno sin confirmación de asesor. Los puntos
 * que sabemos que están abiertos van marcados `TODO: verificar con asesor`, y están
 * recogidos juntos en `docs/facturacion.md` §8.
 *
 * Recordatorio del porqué de tanto rigor: las facturas son inmutables (ADR-0004).
 * Un tratamiento equivocado no se corrige editando una fila, se corrige emitiendo una
 * factura rectificativa a un cliente que ya la había mandado a su gestoría.
 */

import { describe, expect, it } from "vitest";
import { EU_COUNTRIES } from "./tax-id.js";
import {
  euStandardVatRate,
  resolveTaxTreatment,
  type TaxRegime,
  type TaxSubject,
} from "./tax-treatment.js";
import { resolveTaxZone, type TaxZone } from "./tax-zone.js";

/** Alta en OSS. Ver el TODO del umbral en tax-treatment.ts. */
const OSS = { ossRegistered: true };
const SIN_OSS = { ossRegistered: false };

interface Caso {
  readonly n: number;
  readonly descripcion: string;
  readonly pais: string;
  readonly cp: string;
  readonly empresa: boolean;
  readonly vies: boolean | null;
  readonly zonaEsperada: TaxZone;
  readonly regimenEsperado: TaxRegime;
  readonly tipoEsperado: number;
  readonly inversion: boolean;
}

/**
 * LA MATRIZ. Ocho casos, uno por fila de `docs/facturacion.md` §2.
 */
const MATRIZ: readonly Caso[] = [
  {
    n: 1,
    descripcion: "Particular en Madrid",
    pais: "ES", cp: "28001", empresa: false, vies: null,
    zonaEsperada: "es_peninsula_baleares",
    regimenEsperado: "es_standard", tipoEsperado: 21, inversion: false,
  },
  {
    n: 2,
    descripcion: "Autónomo en Valencia (B2B interior: 21 %, NO inversión)",
    pais: "ES", cp: "46001", empresa: true, vies: null,
    zonaEsperada: "es_peninsula_baleares",
    regimenEsperado: "es_standard", tipoEsperado: 21, inversion: false,
  },
  {
    n: 3,
    descripcion: "Empresa alemana con NIF-IVA válido en VIES",
    pais: "DE", cp: "10115", empresa: true, vies: true,
    zonaEsperada: "eu",
    regimenEsperado: "eu_b2b_reverse", tipoEsperado: 0, inversion: true,
  },
  {
    n: 4,
    descripcion: "Empresa portuguesa cuyo NIF-IVA VIES rechaza → se trata como particular",
    pais: "PT", cp: "1000-001", empresa: true, vies: false,
    zonaEsperada: "eu",
    regimenEsperado: "eu_b2c_oss", tipoEsperado: 23, inversion: false,
  },
  {
    n: 5,
    descripcion: "Particular en Francia (OSS, tipo francés)",
    pais: "FR", cp: "75001", empresa: false, vies: null,
    zonaEsperada: "eu",
    regimenEsperado: "eu_b2c_oss", tipoEsperado: 20, inversion: false,
  },
  {
    n: 6,
    descripcion: "Empresa en Estados Unidos: no sujeta a IVA español",
    pais: "US", cp: "94105", empresa: true, vies: null,
    zonaEsperada: "non_eu",
    regimenEsperado: "non_eu_out_of_scope", tipoEsperado: 0, inversion: false,
  },
  {
    n: 7,
    descripcion: "Empresa en Las Palmas: Canarias está fuera del IVA (IGIC)",
    pais: "ES", cp: "35001", empresa: true, vies: null,
    zonaEsperada: "es_canarias",
    regimenEsperado: "es_igic_ipsi", tipoEsperado: 0, inversion: false,
  },
  {
    n: 8,
    descripcion: "Particular en Ceuta: fuera del IVA (IPSI)",
    pais: "ES", cp: "51001", empresa: false, vies: null,
    zonaEsperada: "es_ceuta",
    regimenEsperado: "es_igic_ipsi", tipoEsperado: 0, inversion: false,
  },
];

function sujeto(caso: Caso): TaxSubject {
  return {
    zone: resolveTaxZone(caso.pais, caso.cp),
    countryCode: caso.pais,
    isBusiness: caso.empresa,
    viesValid: caso.vies,
  };
}

describe("matriz de casos fiscales (docs/facturacion.md §2)", () => {
  it.each(MATRIZ)("caso $n — $descripcion", (caso) => {
    expect(resolveTaxZone(caso.pais, caso.cp), "zona fiscal").toBe(caso.zonaEsperada);

    const resultado = resolveTaxTreatment(sujeto(caso), OSS);

    expect(resultado.regime, "régimen").toBe(caso.regimenEsperado);
    expect(resultado.vatRate, "tipo impositivo").toBe(caso.tipoEsperado);
    expect(resultado.reverseCharge, "inversión del sujeto pasivo").toBe(caso.inversion);
  });
});

describe("la corrección que motiva toda la matriz", () => {
  it("NO aplica inversión del sujeto pasivo a un autónomo español", () => {
    // Magic Upload es una sociedad española: a un cliente español se le repercute
    // IVA normal. La inversión del sujeto pasivo solo existe en el B2B
    // intracomunitario, entre estados distintos.
    //
    // Si este test se cae, alguien ha copiado la lógica de un proveedor extranjero
    // que factura A España, que es un caso distinto.
    const autonomo = resolveTaxTreatment(
      { zone: "es_peninsula_baleares", countryCode: "ES", isBusiness: true, viesValid: true },
      OSS,
    );

    expect(autonomo.reverseCharge).toBe(false);
    expect(autonomo.vatRate).toBe(21);
    expect(autonomo.legalMention).toBeNull();
  });

  it("trata igual al particular y a la empresa españoles", () => {
    const base = { zone: "es_peninsula_baleares", countryCode: "ES", viesValid: null } as const;

    expect(resolveTaxTreatment({ ...base, isBusiness: false }, OSS))
      .toEqual(resolveTaxTreatment({ ...base, isBusiness: true }, OSS));
  });
});

describe("Canarias, Ceuta y Melilla", () => {
  // El caso que se olvida siempre. El país es ES, así que cualquier comprobación
  // hecha por país los trata como península y emite una factura mal.

  const especiales: readonly (readonly [string, string, TaxZone])[] = [
    ["Las Palmas", "35500", "es_canarias"],
    ["Santa Cruz de Tenerife", "38001", "es_canarias"],
    ["Ceuta", "51001", "es_ceuta"],
    ["Melilla", "52001", "es_melilla"],
  ];

  it.each(especiales)("%s (%s) queda fuera del IVA", (_ciudad, cp, zonaEsperada) => {
    expect(resolveTaxZone("ES", cp)).toBe(zonaEsperada);

    const resultado = resolveTaxTreatment(
      { zone: zonaEsperada, countryCode: "ES", isBusiness: true, viesValid: null },
      OSS,
    );

    expect(resultado.vatRate).toBe(0);
    expect(resultado.regime).toBe("es_igic_ipsi");
  });

  it("no permite emitir sin revisión de asesoría", () => {
    // El tratamiento exacto está pendiente de confirmar. Marcarlo no basta: tiene que
    // impedir la emisión automática, o el aviso no sirve de nada.
    const resultado = resolveTaxTreatment(
      { zone: "es_canarias", countryCode: "ES", isBusiness: true, viesValid: null },
      OSS,
    );

    expect(resultado.requiresAdvisorReview).toBe(true);
    expect(resultado.legalMention).toContain("art. 3");
  });

  it("distingue la península de Canarias aunque el país sea el mismo", () => {
    expect(resolveTaxZone("ES", "28001")).toBe("es_peninsula_baleares");
    expect(resolveTaxZone("ES", "07001")).toBe("es_peninsula_baleares"); // Baleares SÍ
    expect(resolveTaxZone("ES", "35001")).toBe("es_canarias");
  });

  it("tolera códigos postales escritos de cualquier manera", () => {
    for (const cp of ["38001", "38.001", "E-38001", " 38001 "]) {
      expect(resolveTaxZone("ES", cp), cp).toBe("es_canarias");
    }
  });
});

describe("VIES", () => {
  const empresaAlemana = { zone: "eu", countryCode: "DE", isBusiness: true } as const;

  it("con NIF-IVA válido aplica inversión del sujeto pasivo", () => {
    const resultado = resolveTaxTreatment({ ...empresaAlemana, viesValid: true }, OSS);

    expect(resultado.reverseCharge).toBe(true);
    expect(resultado.vatRate).toBe(0);
    expect(resultado.legalMention).toContain("inversión del sujeto pasivo");
    expect(resultado.legalMention).toContain("2006/112/CE");
  });

  it("si VIES está caído cobra con IVA y marca para regularizar", () => {
    // No bloqueamos la venta por un servicio de terceros indisponible. Perder la
    // venta es peor que emitir una rectificativa después.
    const resultado = resolveTaxTreatment({ ...empresaAlemana, viesValid: null }, OSS);

    expect(resultado.regime).toBe("es_standard");
    expect(resultado.vatRate).toBe(21);
    expect(resultado.pendingViesCheck).toBe(true);
  });

  it("distingue «VIES dice que no» de «VIES no ha contestado»", () => {
    // No es un matiz: son dos tratamientos distintos, y confundirlos produce
    // facturas mal emitidas en ambas direcciones.
    const rechazado = resolveTaxTreatment({ ...empresaAlemana, viesValid: false }, OSS);
    const desconocido = resolveTaxTreatment({ ...empresaAlemana, viesValid: null }, OSS);

    expect(rechazado.regime).toBe("eu_b2c_oss");
    expect(rechazado.vatRate).toBe(19); // tipo alemán, como consumidor
    expect(rechazado.pendingViesCheck).toBe(false);

    expect(desconocido.regime).toBe("es_standard");
    expect(desconocido.pendingViesCheck).toBe(true);
  });
});

describe("ventanilla única (OSS)", () => {
  const particularAleman = {
    zone: "eu", countryCode: "DE", isBusiness: false, viesValid: null,
  } as const;

  it("aplica el tipo del país del cliente, no el español", () => {
    expect(resolveTaxTreatment(particularAleman, OSS).vatRate).toBe(19);
    expect(resolveTaxTreatment({ ...particularAleman, countryCode: "SE" }, OSS).vatRate).toBe(25);
  });

  it("sin alta en OSS repercute IVA español", () => {
    // Por debajo del umbral. TODO: verificar con asesor el importe vigente.
    const resultado = resolveTaxTreatment(particularAleman, SIN_OSS);

    expect(resultado.regime).toBe("es_standard");
    expect(resultado.vatRate).toBe(21);
  });

  it("marca toda operación OSS para revisión mientras la tabla de tipos no esté verificada", () => {
    expect(resolveTaxTreatment(particularAleman, OSS).requiresAdvisorReview).toBe(true);
  });

  it("tiene un tipo definido para los 27 estados miembros", () => {
    // Sin este test, un país sin tipo caería en un valor por defecto y emitiríamos una
    // factura con un tipo inventado.
    const sinTipo = EU_COUNTRIES.filter((pais) => euStandardVatRate(pais) === null);
    expect(sinTipo, `países sin tipo configurado: ${sinTipo.join(", ")}`).toEqual([]);
  });

  it("se niega a emitir si no conoce el tipo del país", () => {
    expect(() =>
      resolveTaxTreatment(
        { zone: "eu", countryCode: "XX", isBusiness: false, viesValid: null },
        OSS,
      ),
    ).toThrow(/No hay tipo de IVA configurado/);
  });
});

describe("fuera de la UE", () => {
  it("no sujeta, y lo dice en la factura", () => {
    const resultado = resolveTaxTreatment(
      { zone: "non_eu", countryCode: "US", isBusiness: true, viesValid: null },
      OSS,
    );

    expect(resultado.regime).toBe("non_eu_out_of_scope");
    expect(resultado.vatRate).toBe(0);
    expect(resultado.legalMention).toContain("no sujeta");
  });

  it("trata igual a la empresa y al particular", () => {
    const base = { zone: "non_eu", countryCode: "AR", viesValid: null } as const;

    expect(resolveTaxTreatment({ ...base, isBusiness: true }, OSS).regime)
      .toBe(resolveTaxTreatment({ ...base, isBusiness: false }, OSS).regime);
  });

  it("el Reino Unido ya no es UE", () => {
    // Post-Brexit. Es justo el caso de nuestro competidor de referencia, que aloja en
    // AWS Londres y lo vende como «Europa».
    expect(resolveTaxZone("GB", "SW1A 1AA")).toBe("non_eu");
  });
});

describe("menciones legales obligatorias", () => {
  it("solo aparecen cuando proceden", () => {
    const interior = resolveTaxTreatment(
      { zone: "es_peninsula_baleares", countryCode: "ES", isBusiness: true, viesValid: null },
      OSS,
    );
    // Una operación interior no lleva mención de exención ni de inversión.
    expect(interior.legalMention).toBeNull();
  });

  it("citan la norma cuando la operación no está sujeta o está exenta", () => {
    const casos: readonly TaxSubject[] = [
      { zone: "eu", countryCode: "DE", isBusiness: true, viesValid: true },
      { zone: "non_eu", countryCode: "US", isBusiness: false, viesValid: null },
      { zone: "es_canarias", countryCode: "ES", isBusiness: false, viesValid: null },
      { zone: "es_melilla", countryCode: "ES", isBusiness: false, viesValid: null },
    ];

    for (const caso of casos) {
      const mencion = resolveTaxTreatment(caso, OSS).legalMention;
      expect(mencion, `${caso.zone}`).toBeTruthy();
      expect(mencion, `${caso.zone}`).toMatch(/art\.|Directiva/);
    }
  });
});
