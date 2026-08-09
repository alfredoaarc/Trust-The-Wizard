/**
 * Validación de NIF, CIF y NIE **con dígito de control**.
 *
 * Una expresión regular acepta `12345678Z` con la letra equivocada. El algoritmo no.
 * Y esto importa de verdad: un NIF mal escrito en una factura la invalida a efectos de
 * deducción (art. 97 Ley 37/1992), la gestoría del cliente la rechaza, y como nuestras
 * facturas son inmutables (ADR-0004) arreglarlo significa emitir una rectificativa.
 *
 * Es más barato validar en el checkout que rectificar después.
 */

/**
 * Letra de control del NIF: se toma el resto de dividir el número entre 23.
 * El orden de las letras es el que fija la normativa; no es alfabético.
 */
const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Letra inicial del NIE y el dígito por el que se sustituye. */
const NIE_PREFIX: Record<string, string> = { X: "0", Y: "1", Z: "2" };

/**
 * Letras iniciales válidas de un CIF y qué tipo de control admiten.
 *
 *   · `letter`: el control es siempre una letra.
 *   · `digit` : el control es siempre un dígito.
 *   · `both`  : se admiten ambos.
 */
const CIF_TYPES: Record<string, "letter" | "digit" | "both"> = {
  A: "digit",  // Sociedades anónimas
  B: "digit",  // Sociedades de responsabilidad limitada
  C: "both",   // Sociedades colectivas
  D: "both",   // Sociedades comanditarias
  E: "digit",  // Comunidades de bienes
  F: "both",   // Sociedades cooperativas
  G: "both",   // Asociaciones y fundaciones
  H: "digit",  // Comunidades de propietarios
  J: "both",   // Sociedades civiles
  N: "letter", // Entidades extranjeras
  P: "letter", // Corporaciones locales
  Q: "letter", // Organismos públicos
  R: "letter", // Congregaciones religiosas
  S: "letter", // Órganos de la Administración
  U: "both",   // Uniones temporales de empresas
  V: "both",   // Otros tipos no definidos
  W: "letter", // Establecimientos permanentes de entidades no residentes
};

/** Letra de control del CIF, indexada por el dígito de control calculado. */
const CIF_CONTROL_LETTERS = "JABCDEFGHI";

export type TaxIdKind = "nif" | "nie" | "cif" | "vat_eu";

export interface TaxIdValidation {
  readonly valid: boolean;
  readonly kind: TaxIdKind | null;
  /** Forma canónica: sin espacios, sin guiones y en mayúsculas. */
  readonly normalized: string;
  /** Motivo del rechazo, en español y listo para mostrar. */
  readonly error: string | null;
}

/** Quita espacios, guiones y puntos, y pasa a mayúsculas. */
export function normalizeTaxId(raw: string): string {
  return raw.replace(/[\s.\-/]/g, "").toUpperCase();
}

/**
 * Valida un identificador fiscal español (NIF de persona física, NIE o CIF).
 *
 * Para NIF-IVA de otros estados de la UE usa `validateEuVatFormat()`: su dígito de
 * control lo define cada país y la autoridad es VIES, no nosotros.
 */
export function validateSpanishTaxId(raw: string): TaxIdValidation {
  const value = normalizeTaxId(raw);

  if (value.length !== 9) {
    return fail(value, "El NIF debe tener 9 caracteres.");
  }

  const first = value[0]!;

  if (first in NIE_PREFIX) return validateNie(value);
  if (/^\d$/.test(first)) return validateNif(value);
  if (first in CIF_TYPES) return validateCif(value);

  return fail(value, `«${first}» no es una letra inicial válida para un NIF, NIE o CIF.`);
}

/** NIF de persona física: 8 dígitos + letra de control. */
function validateNif(value: string): TaxIdValidation {
  if (!/^\d{8}[A-Z]$/.test(value)) {
    return fail(value, "Un NIF son 8 números seguidos de una letra.");
  }

  const expected = NIF_LETTERS[Number(value.slice(0, 8)) % 23]!;
  if (value[8] !== expected) {
    return fail(value, `La letra del NIF no es correcta: debería ser «${expected}».`, "nif");
  }

  return ok(value, "nif");
}

/** NIE: X, Y o Z + 7 dígitos + letra. La inicial se sustituye por 0, 1 o 2. */
function validateNie(value: string): TaxIdValidation {
  if (!/^[XYZ]\d{7}[A-Z]$/.test(value)) {
    return fail(value, "Un NIE es X, Y o Z, seguido de 7 números y una letra.");
  }

  const asNumber = NIE_PREFIX[value[0]!]! + value.slice(1, 8);
  const expected = NIF_LETTERS[Number(asNumber) % 23]!;
  if (value[8] !== expected) {
    return fail(value, `La letra del NIE no es correcta: debería ser «${expected}».`, "nie");
  }

  return ok(value, "nie");
}

/**
 * CIF: letra de tipo + 7 dígitos + control (dígito o letra según el tipo).
 *
 * Control: se duplican los dígitos de las posiciones impares sumando las cifras del
 * resultado, se suman tal cual los de las pares, y el control es lo que falta para
 * llegar a la siguiente decena.
 */
function validateCif(value: string): TaxIdValidation {
  if (!/^[A-Z]\d{7}[\dA-Z]$/.test(value)) {
    return fail(value, "Un CIF es una letra, 7 números y un dígito o letra de control.");
  }

  const digits = value.slice(1, 8);
  let sum = 0;

  for (let i = 0; i < digits.length; i += 1) {
    const digit = Number(digits[i]);
    if (i % 2 === 0) {
      // Posiciones impares (1.ª, 3.ª, 5.ª, 7.ª): se duplican y se suman sus cifras.
      const doubled = digit * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += digit;
    }
  }

  const controlDigit = (10 - (sum % 10)) % 10;
  const controlLetter = CIF_CONTROL_LETTERS[controlDigit]!;
  const given = value[8]!;
  const type = CIF_TYPES[value[0]!]!;

  const matches =
    type === "digit"
      ? given === String(controlDigit)
      : type === "letter"
        ? given === controlLetter
        : given === String(controlDigit) || given === controlLetter;

  if (!matches) {
    const expected = type === "letter" ? controlLetter : type === "digit" ? String(controlDigit) : `${controlDigit} o ${controlLetter}`;
    return fail(value, `El control del CIF no es correcto: debería ser «${expected}».`, "cif");
  }

  return ok(value, "cif");
}

/** Los 27 estados miembros de la UE, con el prefijo que usan en el NIF-IVA. */
export const EU_COUNTRIES: readonly string[] = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
];

/**
 * Grecia usa `EL` como prefijo de NIF-IVA, no `GR`.
 * Es el clásico que rompe una validación escrita a partir de ISO 3166.
 */
const VAT_PREFIX_OVERRIDES: Record<string, string> = { GR: "EL" };

export function vatPrefixFor(countryCode: string): string {
  const code = countryCode.toUpperCase();
  return VAT_PREFIX_OVERRIDES[code] ?? code;
}

/**
 * Comprobación de FORMATO de un NIF-IVA intracomunitario. No es una validación.
 *
 * Cada país tiene su propio algoritmo de control y algunos ni siquiera lo publican.
 * **La autoridad es VIES**, y su resultado, con su fecha, es lo que se guarda como
 * prueba de diligencia. Esto solo evita gastar una llamada a VIES en algo que no
 * puede ser un NIF-IVA.
 *
 * TODO: verificar con asesor — longitudes por país tomadas de la especificación
 * general del NIF-IVA; conviene contrastarlas antes de usarlas para rechazar.
 */
export function validateEuVatFormat(raw: string): TaxIdValidation {
  const value = normalizeTaxId(raw);
  const prefix = value.slice(0, 2);

  const isKnownPrefix =
    EU_COUNTRIES.some((country) => vatPrefixFor(country) === prefix);

  if (!isKnownPrefix) {
    return fail(value, `«${prefix}» no es el código de un país de la Unión Europea.`);
  }

  const body = value.slice(2);
  if (body.length < 2 || body.length > 12 || !/^[0-9A-Z]+$/.test(body)) {
    return fail(value, "El NIF-IVA no tiene un formato válido.");
  }

  return ok(value, "vat_eu");
}

function ok(normalized: string, kind: TaxIdKind): TaxIdValidation {
  return { valid: true, kind, normalized, error: null };
}

function fail(normalized: string, error: string, kind: TaxIdKind | null = null): TaxIdValidation {
  return { valid: false, kind, normalized, error };
}
