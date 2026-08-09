/**
 * Validación de subdominios de usuario.
 *
 * El subdominio es la URL del cliente y **es estable entre re-subidas**: una vez
 * elegido, el usuario lo manda por correo, lo mete en una propuesta y lo enseña en una
 * reunión. Por eso se valida bien en el primer intento, con comprobación en vivo
 * mientras escribe, y no después de subir.
 *
 * Las listas de reservados de este archivo son la SEMILLA de la tabla
 * `blocked_patterns`. En producción se leen de base de datos, para poder añadir una
 * marca suplantada sin desplegar. Cuando el equipo de moderación vea a alguien
 * registrando `correos-es`, tiene que poder bloquearlo esa misma tarde.
 */

import { SUBDOMAIN_MAX_LENGTH, SUBDOMAIN_MIN_LENGTH, SUBDOMAIN_PATTERN } from "./domains.js";

export type SubdomainRejection =
  | "too_short"
  | "too_long"
  | "invalid_characters"
  | "leading_or_trailing_hyphen"
  | "double_hyphen"
  | "reserved"
  | "brand_lookalike";

export interface SubdomainCheck {
  readonly valid: boolean;
  readonly reason: SubdomainRejection | null;
  /** Mensaje en español, listo para mostrar debajo del campo. */
  readonly message: string | null;
  /** Forma canónica: minúsculas y sin espacios sobrantes. */
  readonly normalized: string;
}

/**
 * Subdominios que nos reservamos.
 *
 * Tres motivos distintos mezclados en una lista, y conviene tenerlos presentes al
 * añadir entradas:
 *
 *   · Infraestructura: si alguien registra `www` o `api`, rompe cosas.
 *   · Suplantación: un sitio en `soporte.mgup.site` que pide credenciales es phishing
 *     contra nosotros mismos.
 *   · Futuro: nombres que vamos a necesitar y que sería caro recuperar.
 */
export const RESERVED_SUBDOMAINS: readonly string[] = [
  // Infraestructura y protocolo.
  // `ns` y `mx` son más cortos que `SUBDOMAIN_MIN_LENGTH`, así que hoy nadie puede
  // registrarlos de todas formas. Se quedan a propósito: si algún día se baja el
  // mínimo a 2, no queremos que estos dos pasen a estar libres sin que nadie lo note.
  "www", "api", "app", "cdn", "static", "assets", "mail", "smtp", "imap", "pop",
  "ftp", "ns", "ns1", "ns2", "mx", "dns", "vpn", "proxy", "gateway", "localhost",
  "test", "staging", "dev", "preview", "internal", "private", "public",
  // Marca y suplantación: nunca en manos de un usuario
  "magicupload", "magic-upload", "mgup", "admin", "administrador", "soporte",
  "support", "ayuda", "help", "cuenta", "cuentas", "account", "accounts",
  "login", "acceso", "signin", "signup", "registro", "password", "contrasena",
  "seguridad", "security", "verificar", "verify", "facturacion", "billing",
  "pago", "pagos", "payment", "payments", "checkout", "factura", "facturas",
  // Futuro del producto
  "blog", "docs", "documentacion", "estado", "status", "precios", "pricing",
  "legal", "privacidad", "privacy", "terminos", "cookies", "subencargados",
  "abuso", "abuse", "denuncia", "contacto", "contact", "empleo", "prensa",
  // Protocolo y estándares
  "well-known", "acme", "autoconfig", "autodiscover", "robots", "sitemap",
];

/**
 * Marcas cuya suplantación es el phishing más habitual en España.
 *
 * Se comprueban como subcadena, no como igualdad: `bbva-seguro` y `mi-correos-es` son
 * exactamente lo que queremos parar. Genera falsos positivos —alguien con un apellido
 * o un negocio que contenga una de estas palabras— y por eso el mensaje invita a
 * escribirnos en lugar de cerrar la puerta.
 *
 * TODO: revisar con moderación una vez haya tráfico real. La lista definitiva la
 * dictan los intentos que veamos, no lo que imaginemos ahora.
 */
export const BRAND_LOOKALIKES: readonly string[] = [
  // Administración española: el señuelo más rentable
  "aeat", "agenciatributaria", "hacienda", "seguridadsocial", "segsocial",
  "dgt", "sepe", "correos", "administracion", "gob-es", "clave-pin",
  // Banca española
  "bbva", "santander", "caixabank", "lacaixa", "bankinter", "sabadell",
  "unicaja", "ibercaja", "kutxabank", "abanca", "openbank", "cajamar",
  // Pagos y plataformas
  "bizum", "paypal", "stripe", "redsys", "verifiedbyvisa",
  // Tecnológicas suplantadas con frecuencia
  "microsoft", "office365", "outlook", "google", "gmail", "apple", "icloud",
  "amazon", "netflix", "whatsapp", "instagram", "facebook", "dropbox",
  // Energía y telecos españolas
  "endesa", "iberdrola", "naturgy", "movistar", "vodafone", "orange", "jazztel",
];

/**
 * Comprueba si un subdominio se puede registrar.
 *
 * Función pura: la usa el navegador mientras el usuario escribe y el servidor al
 * crear el sitio. Las mismas reglas en los dos sitios, porque el cliente no es
 * autoridad y una discrepancia sería un error después de haber dicho que sí.
 */
export function checkSubdomain(raw: string): SubdomainCheck {
  const normalized = raw.trim().toLowerCase();

  if (normalized.length < SUBDOMAIN_MIN_LENGTH) {
    return reject(
      normalized,
      "too_short",
      `El enlace necesita al menos ${SUBDOMAIN_MIN_LENGTH} caracteres.`,
    );
  }

  if (normalized.length > SUBDOMAIN_MAX_LENGTH) {
    return reject(
      normalized,
      "too_long",
      `El enlace no puede pasar de ${SUBDOMAIN_MAX_LENGTH} caracteres.`,
    );
  }

  if (normalized.startsWith("-") || normalized.endsWith("-")) {
    return reject(
      normalized,
      "leading_or_trailing_hyphen",
      "El enlace no puede empezar ni terminar con un guion.",
    );
  }

  // `xn--` es el prefijo de los dominios internacionalizados (Punycode). Permitir un
  // doble guion en la posición 3 abriría la puerta a subdominios que se renderizan
  // como otra cosa en la barra del navegador, que es un ataque de suplantación real.
  if (normalized.includes("--")) {
    return reject(
      normalized,
      "double_hyphen",
      "El enlace no puede llevar dos guiones seguidos.",
    );
  }

  if (!SUBDOMAIN_PATTERN.test(normalized)) {
    return reject(
      normalized,
      "invalid_characters",
      "El enlace solo admite letras sin tilde, números y guiones. Nada de espacios, eñes ni símbolos.",
    );
  }

  if (RESERVED_SUBDOMAINS.includes(normalized)) {
    return reject(normalized, "reserved", "Ese enlace está reservado. Prueba con otro.");
  }

  const brand = BRAND_LOOKALIKES.find((needle) => normalized.includes(needle));
  if (brand) {
    return reject(
      normalized,
      "brand_lookalike",
      // No acusamos a nadie: la mayoría de las veces será una coincidencia legítima.
      `No podemos dar enlaces que contengan «${brand}», porque se usan para suplantar a esa marca. Si es el nombre real de tu negocio, escríbenos y lo revisamos.`,
    );
  }

  return { valid: true, reason: null, message: null, normalized };
}

/**
 * Propone alternativas cuando el enlace elegido no está disponible.
 *
 * Un campo que solo dice «no disponible» deja al usuario pensando. Este es el momento
 * de decidir el nombre y conviene que sea rápido.
 */
export function suggestAlternatives(raw: string, isTaken: (candidate: string) => boolean): string[] {
  const base = raw.trim().toLowerCase().replace(/-+$/, "");
  const candidates = [
    `${base}-web`,
    `${base}-es`,
    `${base}-online`,
    `${base}2`,
    `${base}-oficial`,
  ];

  return candidates
    .filter((candidate) => checkSubdomain(candidate).valid && !isTaken(candidate))
    .slice(0, 3);
}

function reject(
  normalized: string,
  reason: SubdomainRejection,
  message: string,
): SubdomainCheck {
  return { valid: false, reason, message, normalized };
}
