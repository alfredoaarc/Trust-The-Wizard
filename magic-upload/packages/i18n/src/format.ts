/**
 * Formatos españoles.
 *
 * No es un detalle estético. Mostrar «$9 + tax» o «08/09/2026» en formato americano se
 * lee como extranjero, y el extranjero es exactamente de quien nos diferenciamos. Un
 * usuario que ve un formato que no es el suyo asume, con razón, que la factura tampoco
 * va a servirle a su gestoría.
 *
 * Convenciones: fechas dd/mm/aaaa · decimales con coma · miles con punto ·
 * moneda «1.234,56 €», símbolo detrás y con espacio.
 */

export const LOCALE = "es-ES";

/** Zona horaria de referencia del producto. */
export const TIME_ZONE = "Europe/Madrid";

/**
 * Importe en euros a partir de céntimos.
 *
 * El dinero se maneja SIEMPRE en céntimos enteros. Un `number` en euros acumula error
 * de coma flotante, y en una factura inmutable ese error no se puede corregir: hay que
 * emitir una rectificativa.
 */
export function formatEuros(cents: number, opts: { decimals?: boolean } = {}): string {
  const showDecimals = opts.decimals ?? true;
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
    useGrouping: GROUPING,
  }).format(cents / 100);
}

/**
 * Agrupación de millares.
 *
 * Por defecto, `es-ES` en ICU NO agrupa los números de cuatro cifras: da «1234,56 €»
 * en lugar de «1.234,56 €». Es la recomendación de la RAE para prosa, y es correcta
 * ahí. Pero en una factura o en un panel de cifras nadie escribe «1234,56 €», y una
 * factura que se lee rara es una factura que la gestoría mira dos veces.
 *
 * Forzamos la agrupación siempre. Es una desviación deliberada del locale, y se aplica
 * por igual a importes y a números para que no haya dos convenciones en la misma
 * pantalla.
 */
const GROUPING = "always" as const;

/** Número con separadores españoles: miles con punto, decimales con coma. */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: GROUPING,
  }).format(value);
}

/** Porcentaje, para tipos impositivos: 21 → «21 %». */
export function formatPercent(value: number): string {
  return `${formatNumber(value, Number.isInteger(value) ? 0 : 2)} %`;
}

/** Fecha en dd/mm/aaaa. */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

/** Fecha y hora: «09/08/2026, 19:42». */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
    hour12: false,
  }).format(date);
}

/** Solo la hora: «19:42». Para la vista de analítica. */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
    hour12: false,
  }).format(date);
}

/**
 * Tamaño de archivo en unidades que el usuario entiende.
 *
 * Usamos múltiplos de 1024 pero con las etiquetas cortas habituales, porque es lo que
 * muestra el explorador de archivos del usuario. Si su sistema dice «34 MB» y nosotros
 * decimos «32,4 MiB», el usuario cree que le estamos engañando con el límite.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${formatNumber(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // Un decimal por debajo de 10 («9,4 MB»), ninguno por encima («34 MB»). Un valor
  // redondo nunca lleva decimal: «2 GB», no «2,0 GB».
  const decimals = value < 10 && !Number.isInteger(value) ? 1 : 0;
  return `${formatNumber(value, decimals)} ${units[unit]}`;
}

/**
 * Lista en español con «y» final: «Dinahosting, Raiola y Webempresa».
 * `Intl.ListFormat` lo hace bien y evita el clásico «a, b, and c» traducido a medias.
 */
export function formatList(items: readonly string[]): string {
  return new Intl.ListFormat(LOCALE, { style: "long", type: "conjunction" }).format(items);
}

/**
 * Tiempo relativo: «hace 3 minutos», «ayer».
 * Para el panel de analítica, donde «última visita ayer a las 19:42» vende más que
 * una marca de tiempo absoluta.
 */
export function formatRelative(date: Date, now: Date): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 60) return rtf.format(Math.round(seconds), "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 2_592_000) return rtf.format(Math.round(seconds / 86_400), "day");
  if (abs < 31_536_000) return rtf.format(Math.round(seconds / 2_592_000), "month");
  return rtf.format(Math.round(seconds / 31_536_000), "year");
}
