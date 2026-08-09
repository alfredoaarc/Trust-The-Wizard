/**
 * Comprobación previa a la subida.
 *
 * ⚠️ Esta es la implementación de la promesa central de marca (ADR-0007):
 * **nunca destruimos el trabajo del usuario**.
 *
 * La competencia publica en «modo preview» el contenido que excede el plan gratuito y
 * lo tira a los 60 minutos. Sus peores reseñas dicen literalmente «¡TRAMPA!» y «es una
 * ESTAFA». Nosotros hacemos lo contrario: **se avisa ANTES de subir**, con el tamaño
 * exacto y qué plan lo permitiría, y no se publica nada que vayamos a tirar.
 *
 * Por eso esta función se llama en el navegador con los metadatos del archivo, antes
 * de que empiece la transferencia. El servidor la vuelve a llamar al pedir la URL
 * prefirmada, porque el cliente no es autoridad.
 *
 * Si algún día alguien propone un «modo preview» para mejorar la conversión: eso es
 * exactamente lo que le costó a la competencia sus peores reseñas.
 */

import { formatBytes, formatEuros } from "@magic-upload/i18n";
import { PLANS, cheapestPlanAllowing, limitFor, type PlanCode } from "./plans.js";

export type UploadRejectionReason = "file_too_large" | "site_limit_reached";

export interface UploadCheckInput {
  readonly plan: PlanCode;
  readonly fileBytes: number;
  /** Sitios activos que ya tiene la organización. */
  readonly activeSites: number;
  /** Si la subida sustituye a un sitio que ya existe, no consume cupo nuevo. */
  readonly isReplacingExistingSite: boolean;
}

export interface UploadAllowed {
  readonly allowed: true;
}

export interface UploadRejected {
  readonly allowed: false;
  readonly reason: UploadRejectionReason;
  /** Mensaje principal, en español y con las cifras concretas. */
  readonly message: string;
  /** Qué plan lo resolvería y cuánto cuesta. `null` si ningún plan llega. */
  readonly upgradeTo: PlanCode | null;
  /** Llamada a la acción. Nunca un callejón sin salida. */
  readonly action: string;
}

export type UploadCheck = UploadAllowed | UploadRejected;

/**
 * ¿Se puede subir este archivo con este plan?
 *
 * Devuelve el mensaje ya redactado. No se construyen mensajes en la interfaz: si
 * estuviera repartido, acabaría habiendo tres redacciones distintas del mismo error.
 */
export function checkUpload(input: UploadCheckInput): UploadCheck {
  const maxBytes = limitFor(input.plan, "max_file_bytes");

  if (maxBytes !== null && input.fileBytes > maxBytes) {
    const upgrade = cheapestPlanAllowing("max_file_bytes", input.fileBytes);

    // El mensaje del brief, literal. Dice el tamaño real, el límite real, y qué plan
    // lo permitiría con su precio. Compáralo con «Upload failed: file too large».
    const base = `Tu archivo pesa ${formatBytes(input.fileBytes)} y tu plan permite ${formatBytes(maxBytes)}.`;

    if (!upgrade) {
      return {
        allowed: false,
        reason: "file_too_large",
        message: `${base} Es más grande de lo que admite ninguno de nuestros planes.`,
        upgradeTo: null,
        action: "Escríbenos y lo vemos: si tu caso tiene sentido, ampliamos el límite.",
      };
    }

    return {
      allowed: false,
      reason: "file_too_large",
      message: `${base} Con el plan ${upgrade.name} (${formatEuros(upgrade.priceCentsMonth)}/mes) subirías hasta ${formatBytes(limitFor(upgrade.code, "max_file_bytes")!)}.`,
      upgradeTo: upgrade.code,
      action: `Cambiar al plan ${upgrade.name}`,
    };
  }

  // Re-subir sobre un sitio que ya existe no consume cupo: la URL es estable entre
  // re-subidas, y esa es nuestra ventaja frente a quien crea un proyecto nuevo en
  // cada arrastre. Cobrar por ella sería regalarla.
  if (!input.isReplacingExistingSite) {
    const maxSites = limitFor(input.plan, "active_sites");

    if (maxSites !== null && input.activeSites >= maxSites) {
      const upgrade = cheapestPlanAllowing("active_sites", input.activeSites + 1);
      const plural = maxSites === 1 ? "1 proyecto" : `${maxSites} proyectos`;

      return {
        allowed: false,
        reason: "site_limit_reached",
        message: upgrade
          ? `Tu plan incluye ${plural} y ya lo estás usando. Con el plan ${upgrade.name} (${formatEuros(upgrade.priceCentsMonth)}/mes) tendrías ${describeLimit(upgrade.limits.active_sites)}.`
          : `Tu plan incluye ${plural} y ya lo estás usando.`,
        upgradeTo: upgrade?.code ?? null,
        // Siempre hay una salida que no cuesta dinero. Si la única opción fuese pagar,
        // el mensaje sería un peaje, no una ayuda.
        action: upgrade
          ? `Cambiar al plan ${upgrade.name}, o sustituir uno de tus proyectos actuales`
          : "Sustituye uno de tus proyectos actuales",
      };
    }
  }

  return { allowed: true };
}

function describeLimit(value: number | null): string {
  if (value === null) return "proyectos ilimitados";
  return value === 1 ? "1 proyecto" : `${value} proyectos`;
}

/**
 * Precio a mostrar en la web.
 *
 * Convención española, y no es cosmética: a un particular se le enseña el precio con
 * IVA incluido, y a una empresa desglosado. Mostrar «9 $ + impuestos» se lee como
 * extranjero, y el extranjero es justo de quien nos diferenciamos.
 */
export function displayPrice(
  plan: PlanCode,
  audience: "consumer" | "business",
  vatRate: number,
): string {
  const net = PLANS[plan].priceCentsMonth;
  if (net === 0) return "Gratis";

  if (audience === "business") {
    return `${formatEuros(net)}/mes + IVA`;
  }

  const gross = Math.round(net * (1 + vatRate / 100));
  return `${formatEuros(gross)}/mes, IVA incluido`;
}
