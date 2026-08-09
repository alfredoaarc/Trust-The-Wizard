/**
 * Resolución del tratamiento fiscal de una operación.
 *
 * ⚠️ **Este módulo es el punto de parada nº 2.** Su tabla de tests
 * (`tax-treatment.test.ts`) es lo que el product owner revisa con su asesoría ANTES
 * de que exista código que cobre dinero. Ni emisión de facturas, ni Stripe, ni PDF
 * hasta entonces.
 *
 * Premisa que lo determina todo: **Magic Upload será una sociedad española.** Por eso
 * a una empresa o autónomo español se le repercute 21 % de IVA normal. La inversión
 * del sujeto pasivo NO aplica a operaciones interiores: solo al B2B intracomunitario
 * entre estados distintos. Es el error que comete quien copia la lógica de un
 * proveedor extranjero que factura a España.
 *
 * La matriz completa está en `docs/facturacion.md` §2.
 */

import { isSpanishVatTerritory, type TaxZone } from "./tax-zone.js";

export type TaxRegime =
  | "es_standard"          // 21 % IVA, operación interior
  | "eu_b2b_reverse"       // 0 %, inversión del sujeto pasivo
  | "eu_b2c_oss"           // IVA del país del cliente, vía ventanilla única
  | "non_eu_out_of_scope"  // No sujeta a IVA español
  | "es_igic_ipsi";        // Canarias, Ceuta y Melilla: fuera del IVA

/** Tipo general del IVA español. */
export const ES_STANDARD_VAT_RATE = 21;

export interface TaxSubject {
  readonly zone: TaxZone;
  /** País del cliente, ISO 3166-1 alfa-2. Determina el tipo aplicable en OSS. */
  readonly countryCode: string;
  /** Empresa o autónomo (B2B) frente a particular (B2C). */
  readonly isBusiness: boolean;
  /**
   * Resultado de la consulta a VIES.
   *
   *   `true`  → NIF-IVA válido y verificado.
   *   `false` → VIES respondió que NO es válido.
   *   `null`  → todavía no se sabe: VIES caído, o aún sin consultar.
   *
   * La distinción entre `false` y `null` no es cosmética y cambia el tratamiento.
   * Ver los casos 3, 4 y el de VIES caído.
   */
  readonly viesValid: boolean | null;
}

export interface TaxContext {
  /**
   * ¿Estamos dados de alta en la ventanilla única (OSS)?
   *
   * No tiene valor por defecto a propósito: quien llama tiene que decidirlo
   * conscientemente. Por debajo del umbral anual de ventas transfronterizas a
   * consumidores de la UE se puede repercutir IVA español en lugar de darse de alta.
   *
   * TODO: verificar con asesor — importe del umbral vigente, si conviene renunciar a
   * él desde el principio, y en qué momento hay que registrarse.
   */
  readonly ossRegistered: boolean;
}

export interface TaxTreatment {
  readonly regime: TaxRegime;
  /** Tipo a aplicar, en porcentaje. */
  readonly vatRate: number;
  /** Estado que recauda el impuesto. `null` si la operación no está sujeta. */
  readonly vatCountry: string | null;
  /** Si aplica la inversión del sujeto pasivo. */
  readonly reverseCharge: boolean;
  /** Mención obligatoria en la factura, o `null` si no procede ninguna. */
  readonly legalMention: string | null;
  /**
   * VIES no ha podido confirmar el NIF-IVA y se ha cobrado con IVA para no bloquear
   * la venta. Hay que reintentar la consulta y regularizar.
   */
  readonly pendingViesCheck: boolean;
  /**
   * El caso necesita confirmación de asesoría antes de emitir. Hoy: Canarias, Ceuta
   * y Melilla. No es un aviso decorativo: debe impedir la emisión automática.
   */
  readonly requiresAdvisorReview: boolean;
}

/**
 * Tipos generales de IVA por país de la UE, para las ventas B2C bajo OSS.
 *
 * ⚠️ TODO: verificar con asesor — TODA esta tabla. Los tipos cambian por decisión de
 * cada estado y un tipo equivocado produce una factura mal emitida que, al ser
 * inmutable, solo se corrige con una rectificativa.
 *
 * Mientras no esté verificada, `resolveTaxTreatment` marca las operaciones OSS con
 * `requiresAdvisorReview`, de modo que no puedan emitirse sin revisión.
 */
const EU_STANDARD_VAT_RATES: Readonly<Record<string, number>> = {
  AT: 20, BE: 21, BG: 20, HR: 25, CY: 19, CZ: 21, DK: 25, EE: 22,
  FI: 25.5, FR: 20, DE: 19, GR: 24, HU: 27, IE: 23, IT: 22, LV: 21,
  LT: 21, LU: 17, MT: 18, NL: 21, PL: 23, PT: 23, RO: 21, SK: 23,
  SI: 22, ES: 21, SE: 25,
};

/** Se expone para que los tests puedan comprobar que no falta ningún país. */
export function euStandardVatRate(countryCode: string): number | null {
  return EU_STANDARD_VAT_RATES[countryCode.toUpperCase()] ?? null;
}

const MENTION_REVERSE_CHARGE =
  "Operación exenta con inversión del sujeto pasivo (art. 69 Ley 37/1992 y art. 44 de la Directiva 2006/112/CE). El destinatario es el sujeto pasivo del impuesto.";

/**
 * TODO: verificar con asesor — dos cosas de esta mención:
 *   1. La redacción exacta y si el artículo citado es el correcto para servicios
 *      prestados por vía electrónica a destinatarios fuera de la UE.
 *   2. La regla de «uso y disfrute efectivo» (art. 70.Dos Ley 37/1992) puede volver a
 *      sujetar al IVA español servicios prestados fuera de la Comunidad. Hay que
 *      confirmar si nos afecta antes de facturar fuera de la UE en volumen.
 */
const MENTION_OUT_OF_SCOPE =
  "Operación no sujeta al IVA español por aplicación de las reglas de localización de las prestaciones de servicios (art. 69 Ley 37/1992).";

const MENTION_CANARIAS =
  "Operación no sujeta al IVA español: Canarias queda fuera del territorio de aplicación del impuesto (art. 3 Ley 37/1992). Puede resultar aplicable el IGIC.";

const MENTION_CEUTA_MELILLA =
  "Operación no sujeta al IVA español: Ceuta y Melilla quedan fuera del territorio de aplicación del impuesto (art. 3 Ley 37/1992). Puede resultar aplicable el IPSI.";

/**
 * Devuelve el tratamiento fiscal de una operación.
 *
 * Función pura: mismos argumentos, mismo resultado. Toda la matriz fiscal cabe aquí
 * para que se pueda leer entera de una vez y contrastarla con la asesoría.
 */
export function resolveTaxTreatment(subject: TaxSubject, context: TaxContext): TaxTreatment {
  // ── Casos 7 y 8: Canarias, Ceuta y Melilla ────────────────────────────────────
  //
  // Van primero porque su país es `ES` y cualquier comprobación posterior por país
  // los trataría como península. Es exactamente así como se cuela el bug.
  if (subject.zone === "es_canarias") {
    return {
      regime: "es_igic_ipsi",
      vatRate: 0,
      vatCountry: null,
      reverseCharge: false,
      legalMention: MENTION_CANARIAS,
      pendingViesCheck: false,
      // TODO: verificar con asesor — si al no estar establecidos en Canarias la
      // operación queda no sujeta sin repercutir IGIC, correspondiendo la
      // autoliquidación al cliente. No lo damos por bueno.
      requiresAdvisorReview: true,
    };
  }

  if (subject.zone === "es_ceuta" || subject.zone === "es_melilla") {
    return {
      regime: "es_igic_ipsi",
      vatRate: 0,
      vatCountry: null,
      reverseCharge: false,
      legalMention: MENTION_CEUTA_MELILLA,
      pendingViesCheck: false,
      requiresAdvisorReview: true, // TODO: verificar con asesor — mismo motivo.
    };
  }

  // ── Casos 1 y 2: España peninsular y Baleares ─────────────────────────────────
  //
  // Particular y empresa reciben EL MISMO tratamiento: 21 %. No hay inversión del
  // sujeto pasivo en operaciones interiores. Si alguien «arregla» esto en el futuro
  // añadiendo un caso B2B, estará replicando la lógica de un proveedor extranjero.
  if (isSpanishVatTerritory(subject.zone)) {
    return standardSpanishVat();
  }

  // ── Caso 6: fuera de la UE ────────────────────────────────────────────────────
  if (subject.zone === "non_eu") {
    return {
      regime: "non_eu_out_of_scope",
      vatRate: 0,
      vatCountry: null,
      reverseCharge: false,
      legalMention: MENTION_OUT_OF_SCOPE,
      pendingViesCheck: false,
      requiresAdvisorReview: false,
    };
  }

  // ── Resto de la UE ────────────────────────────────────────────────────────────
  if (subject.isBusiness) {
    // Caso 3: NIF-IVA verificado en VIES → inversión del sujeto pasivo.
    if (subject.viesValid === true) {
      return {
        regime: "eu_b2b_reverse",
        vatRate: 0,
        vatCountry: subject.countryCode.toUpperCase(),
        reverseCharge: true,
        legalMention: MENTION_REVERSE_CHARGE,
        pendingViesCheck: false,
        requiresAdvisorReview: false,
      };
    }

    // VIES no ha respondido: no bloqueamos la venta. Se cobra con IVA español y se
    // regulariza cuando VIES vuelva. Perder una venta porque un servicio de terceros
    // está caído es peor que emitir una rectificativa después.
    if (subject.viesValid === null) {
      return { ...standardSpanishVat(), pendingViesCheck: true };
    }

    // Caso 4: VIES dice que el NIF-IVA NO es válido. Cae al tratamiento de
    // consumidor. Es distinto de «no se sabe» y por eso no comparten rama.
    // TODO: verificar con asesor.
  }

  // Caso 5 (y caso 4): consumidor de otro estado de la UE.
  return consumerInAnotherEuState(subject, context);
}

function standardSpanishVat(): TaxTreatment {
  return {
    regime: "es_standard",
    vatRate: ES_STANDARD_VAT_RATE,
    vatCountry: "ES",
    reverseCharge: false,
    legalMention: null,
    pendingViesCheck: false,
    requiresAdvisorReview: false,
  };
}

function consumerInAnotherEuState(subject: TaxSubject, context: TaxContext): TaxTreatment {
  // Por debajo del umbral, sin alta en OSS: se repercute IVA español.
  if (!context.ossRegistered) {
    return standardSpanishVat();
  }

  const country = subject.countryCode.toUpperCase();
  const rate = euStandardVatRate(country);

  if (rate === null) {
    // No conocemos el tipo de ese país. Emitir con un tipo inventado sería mucho peor
    // que parar: la factura es inmutable.
    throw new Error(
      `No hay tipo de IVA configurado para «${country}». No se puede emitir sin él.`,
    );
  }

  return {
    regime: "eu_b2c_oss",
    vatRate: rate,
    vatCountry: country,
    reverseCharge: false,
    legalMention: null,
    pendingViesCheck: false,
    // La tabla de tipos por país está pendiente de verificación por asesoría, así que
    // ninguna operación OSS puede emitirse automáticamente todavía.
    requiresAdvisorReview: true,
  };
}
