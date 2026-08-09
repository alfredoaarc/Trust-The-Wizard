/**
 * Planes y límites.
 *
 * **Los valores de este archivo son la semilla de la tabla `plan_limits`, no la fuente
 * de verdad.** En producción los límites se leen de base de datos para poder ajustar
 * un plan sin desplegar. Aquí viven para poder sembrar la base, para los tests, y para
 * que la tabla de precios de la web tenga algo que renderizar antes de que haya BD.
 *
 * Cuatro de estos valores NO son parámetros que alguien pueda subir o bajar mirando
 * una hoja de costes. Son decisiones de producto tomadas contra puntos de dolor
 * documentados de la competencia, y están marcadas una a una más abajo.
 */

export type PlanCode = "free" | "basic" | "pro" | "agency";

export type LimitKey =
  | "active_sites"
  | "max_file_bytes"
  | "daily_publishes"
  | "password_sites"
  | "custom_domains"
  | "monthly_visits"
  | "analytics_per_visitor"
  | "analytics_export"
  | "white_label"
  | "api_requests_per_minute";

/** `null` significa ilimitado. No es lo mismo que 0, que significa «no incluido». */
export type LimitValue = number | null;

const MB = 1024 * 1024;
const GB = 1024 * MB;

export interface Plan {
  readonly code: PlanCode;
  readonly name: string;
  /** Precio mensual SIN IVA, en céntimos. El mostrado se calcula según el cliente. */
  readonly priceCentsMonth: number;
  readonly limits: Readonly<Record<LimitKey, LimitValue>>;
}

export const PLANS: Readonly<Record<PlanCode, Plan>> = {
  free: {
    code: "free",
    name: "Gratis",
    priceCentsMonth: 0,
    limits: {
      active_sites: 1,

      // ── DECISIÓN DE PRODUCTO 1: 25 MB en el plan gratuito, PDF incluido ──────
      //
      // La competencia da 3 MB, y 0,5 MB para PDF. Su única reseña de 0,0 sobre 5 en
      // G2 es de un director financiero hispanohablante que no pudo publicar la carta
      // de un negocio por ese límite. Ese es exactamente nuestro cliente y ese es
      // exactamente el momento en que lo captamos.
      //
      // No bajar esto para ahorrar almacenamiento. El almacenamiento es barato; ese
      // usuario, no.
      max_file_bytes: 25 * MB,

      // ── DECISIÓN DE PRODUCTO 2: ediciones ilimitadas ─────────────────────────
      //
      // La competencia limita a 3 al día en el plan gratuito y genera quejas
      // constantes. Limitar las ediciones castiga justo al usuario que está
      // iterando, es decir, al que todavía se está enganchando al producto.
      daily_publishes: null,

      // Contraseña en el plan gratuito para 1 sitio. La competencia la cobra a 18 $
      // al mes, y eso ya no se sostiene: PageDrop y Stacktree la regalan.
      password_sites: 1,

      custom_domains: 0,
      monthly_visits: 10_000,
      analytics_per_visitor: 0,
      analytics_export: 0,
      white_label: 0,

      // La API en el plan gratuito no es generosidad: es supervivencia. Cerrarla mata
      // la adopción entre desarrolladores, que son quienes recomiendan.
      api_requests_per_minute: 10,
    },
  },

  basic: {
    code: "basic",
    name: "Básico",
    priceCentsMonth: 899, // TODO: verificar — precio orientativo, sin confirmar.
    limits: {
      // ── DECISIÓN DE PRODUCTO 3: escalón de 3 proyectos ───────────────────────
      //
      // La competencia salta de 1 a 5 y hay peticiones explícitas de un punto
      // intermedio. Es su fuga de embudo más visible: el usuario que necesita 2 o 3
      // sitios no paga por 5.
      active_sites: 3,

      max_file_bytes: 100 * MB,
      daily_publishes: null,
      password_sites: null,
      custom_domains: 1,
      monthly_visits: 100_000,
      analytics_per_visitor: 1,
      analytics_export: 0,
      white_label: 0,
      api_requests_per_minute: 60,
    },
  },

  pro: {
    code: "pro",
    name: "Pro",
    priceCentsMonth: 1900, // TODO: verificar — precio orientativo, sin confirmar.
    limits: {
      active_sites: 10,
      max_file_bytes: 500 * MB,
      daily_publishes: null,
      password_sites: null,
      custom_domains: 5,
      monthly_visits: 500_000,
      analytics_per_visitor: 1,
      analytics_export: 0,
      white_label: 0,
      api_requests_per_minute: 300,
    },
  },

  agency: {
    code: "agency",
    name: "Agencia",
    priceCentsMonth: 3900, // TODO: verificar — precio orientativo, sin confirmar.
    limits: {
      active_sites: null,
      max_file_bytes: 2 * GB,
      daily_publishes: null,
      password_sites: null,

      // TODO: verificar — «ilimitados» choca con el coste por hostname de Cloudflare
      // for SaaS. Hay que medirlo antes de la slice 7 y decidirlo como producto, no
      // poner un límite improvisado. Ver ARCHITECTURE.md §4.
      custom_domains: null,

      monthly_visits: null,
      analytics_per_visitor: 1,
      analytics_export: 1,
      white_label: 1,
      api_requests_per_minute: 1000,
    },
  },
};

/** Planes en el orden en que se muestran en la página de precios. */
export const PLAN_ORDER: readonly PlanCode[] = ["free", "basic", "pro", "agency"];

export function limitFor(plan: PlanCode, key: LimitKey): LimitValue {
  return PLANS[plan].limits[key];
}

/**
 * El plan más barato que permite el valor pedido para un límite.
 *
 * Es lo que convierte un mensaje de error en una venta: en lugar de decir «no puedes»,
 * decimos exactamente qué plan sí puede y cuánto cuesta.
 */
export function cheapestPlanAllowing(key: LimitKey, needed: number): Plan | null {
  for (const code of PLAN_ORDER) {
    const limit = limitFor(code, key);
    if (limit === null || limit >= needed) return PLANS[code];
  }
  return null;
}
