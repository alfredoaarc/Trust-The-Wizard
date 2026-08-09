/**
 * Zona fiscal del cliente.
 *
 * **Canarias, Ceuta y Melilla no son territorio de aplicación del IVA** (art. 3 LIVA).
 * Un cliente en Las Palmas NO lleva 21 % de IVA, aunque su país sea `ES`.
 *
 * Este es el error que se olvida siempre, y el motivo por el que la zona es una
 * columna propia en `billing_profiles` en lugar de derivarse del país en cada
 * consulta: se resuelve al guardar el perfil y se congela en la factura. Como las
 * facturas son inmutables (ADR-0004), descubrir el error después significa emitir
 * rectificativas, no corregir una fila.
 */

import { EU_COUNTRIES } from "./tax-id.js";

export type TaxZone =
  | "es_peninsula_baleares"
  | "es_canarias"
  | "es_ceuta"
  | "es_melilla"
  | "eu"
  | "non_eu";

/**
 * Prefijos de código postal de los territorios españoles fuera del IVA.
 *
 * TODO: verificar con asesor — si el código postal es criterio suficiente o debe
 * primar el domicilio fiscal declarado cuando ambos discrepan.
 */
const SPANISH_SPECIAL_ZONES: readonly (readonly [string, TaxZone])[] = [
  ["35", "es_canarias"], // Las Palmas
  ["38", "es_canarias"], // Santa Cruz de Tenerife
  ["51", "es_ceuta"],
  ["52", "es_melilla"],
];

/**
 * Resuelve la zona fiscal a partir del país y el código postal.
 *
 * @param countryCode ISO 3166-1 alfa-2.
 * @param postalCode  Código postal tal cual lo ha escrito el cliente.
 */
export function resolveTaxZone(countryCode: string, postalCode: string): TaxZone {
  const country = countryCode.trim().toUpperCase();

  if (country === "ES") {
    // Solo los dígitos: la gente escribe «38001», «38.001» y «E-38001».
    const digits = postalCode.replace(/\D/g, "");
    const prefix = digits.slice(0, 2);

    const special = SPANISH_SPECIAL_ZONES.find(([code]) => code === prefix);
    if (special) return special[1];

    return "es_peninsula_baleares";
  }

  if (EU_COUNTRIES.includes(country)) return "eu";

  return "non_eu";
}

/** ¿La zona está dentro del territorio de aplicación del IVA español? */
export function isSpanishVatTerritory(zone: TaxZone): boolean {
  return zone === "es_peninsula_baleares";
}

/** ¿Es territorio español, aunque esté fuera del IVA? */
export function isSpain(zone: TaxZone): boolean {
  return zone.startsWith("es_");
}

/**
 * Otros estados de la UE tienen también territorios fuera del ámbito del IVA
 * (Åland en Finlandia, los departamentos de ultramar franceses, Livigno y Campione
 * d'Italia en Italia, Büsingen y Helgoland en Alemania, entre otros).
 *
 * TODO: verificar con asesor — aquí los tratamos como `eu` normal. Es una
 * simplificación consciente: nuestro cliente objetivo del MVP es español, y esos
 * casos son residuales. Hay que resolverlo antes de vender en volumen fuera de España.
 */
export const EU_SPECIAL_TERRITORIES_PENDING = true;
