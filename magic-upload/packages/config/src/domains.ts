/**
 * Dominios del servicio.
 *
 * La separación entre el dominio de la aplicación y el del contenido de usuario NO es
 * una preferencia de despliegue: es una decisión de arquitectura con dos motivos, y
 * está registrada en ADR-0001.
 *
 *  1. Reputación. El contenido de usuario es un pasivo: un par de enlaces de phishing
 *     muy difundidos pueden meter el dominio en listas de bloqueo durante semanas.
 *     Si eso pasa, tiene que caer el dominio desechable, no el corporativo.
 *  2. Seguridad. Al vivir el contenido en otro dominio, ningún HTML subido por un
 *     usuario puede leer ni escribir las cookies de sesión del panel.
 *
 * No unifiques estos dos valores, ni siquiera "temporalmente para una demo".
 */

/** Dominio de la aplicación: marketing, panel, checkout, API y MCP. */
// TODO: verificar — dominio pendiente de registrar por el product owner.
export const APP_DOMAIN = "magicupload.es";

/**
 * Dominio del contenido de usuario. Deliberadamente corto y desechable: es el que
 * puede acabar quemado en listas de bloqueo, y sustituirlo debe ser barato.
 */
// TODO: verificar — dominio pendiente de registrar por el product owner.
export const CONTENT_DOMAIN = "mgup.site";

/** Subdominio de envío de correo. Nunca el dominio de contenido. */
// TODO: verificar — pendiente de elegir proveedor de email transaccional en la UE.
export const MAIL_DOMAIN = `mail.${APP_DOMAIN}`;

/** Región de datos. Todo dato personal vive en la UE (ver ARCHITECTURE.md §8). */
// TODO: fijar — Fráncfort o Irlanda.
export const DATA_REGION = "eu" as const;

/** Longitud mínima y máxima de un subdominio de usuario. */
export const SUBDOMAIN_MIN_LENGTH = 3;
export const SUBDOMAIN_MAX_LENGTH = 63;

/**
 * Un subdominio válido: minúsculas, dígitos y guiones, sin guion inicial ni final.
 * La lista de reservados y de marcas suplantadas NO vive aquí: vive en la tabla
 * `blocked_patterns`, para poder añadir una marca sin desplegar.
 */
export const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** URL pública de un sitio a partir de su subdominio. */
export function siteUrl(subdomain: string): string {
  return `https://${subdomain}.${CONTENT_DOMAIN}`;
}
