#!/usr/bin/env node
/**
 * Comprueba que las credenciales de `.env` funcionan de verdad.
 *
 * Existe para que la puesta en marcha no sea «pega esto y reza». Cada credencial se
 * usa contra su servicio real, y si falla se dice qué falta y dónde arreglarlo. Así
 * no hace falta acertar a la primera con los permisos del token: pegas, ejecutas, y
 * el script te va guiando.
 *
 *   node scripts/verificar-credenciales.mjs
 *
 * No escribe nada en ningún sitio: solo lee. Es seguro ejecutarlo las veces que haga
 * falta.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ENV_PATH = fileURLToPath(new URL("../.env", import.meta.url));

const c = {
  reset: "[0m", bold: "[1m", dim: "[2m",
  green: "[32m", red: "[31m", yellow: "[33m", cyan: "[36m",
};

const resultados = [];

function ok(qué, detalle = "") {
  resultados.push({ estado: "ok", qué });
  console.log(`  ${c.green}✓${c.reset} ${qué}${detalle ? ` ${c.dim}${detalle}${c.reset}` : ""}`);
}

function mal(qué, porqué, cómoArreglarlo) {
  resultados.push({ estado: "mal", qué });
  console.log(`  ${c.red}✗${c.reset} ${qué}`);
  console.log(`    ${c.dim}${porqué}${c.reset}`);
  if (cómoArreglarlo) console.log(`    ${c.cyan}→ ${cómoArreglarlo}${c.reset}`);
}

function pendiente(qué, porqué) {
  resultados.push({ estado: "pendiente", qué });
  console.log(`  ${c.yellow}·${c.reset} ${qué} ${c.dim}${porqué}${c.reset}`);
}

/** Lector de .env mínimo: no merece una dependencia. */
function cargarEnv() {
  let texto;
  try {
    texto = readFileSync(ENV_PATH, "utf8");
  } catch {
    console.log(`${c.red}No encuentro el archivo .env${c.reset}`);
    console.log(`${c.cyan}→ Copia la plantilla:  cp .env.example .env${c.reset}`);
    console.log(`${c.dim}  Guía completa en docs/PUESTA-EN-MARCHA.md${c.reset}\n`);
    process.exit(1);
  }

  const env = { ...process.env };
  for (const línea of texto.split("\n")) {
    const limpia = línea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const igual = limpia.indexOf("=");
    if (igual < 0) continue;
    const clave = limpia.slice(0, igual).trim();
    const valor = limpia.slice(igual + 1).trim().replace(/^["']|["']$/g, "");
    // Las variables de entorno reales ganan a las del archivo: es donde deben vivir
    // las claves sensibles.
    if (!env[clave]) env[clave] = valor;
  }
  return env;
}

async function pedirCloudflare(token, ruta) {
  const respuesta = await fetch(`https://api.cloudflare.com/client/v4${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { estado: respuesta.status, cuerpo: await respuesta.json().catch(() => ({})) };
}

/**
 * Comprueba que hay salida a internet antes de culpar a las credenciales.
 *
 * Ojo con cómo se comprueba esto, porque la primera versión daba un falso positivo:
 * el proxy de egreso del entorno **responde** con un 403 en lugar de cortar la
 * conexión, así que `fetch` no lanza excepción y todo parecía correcto. Un token
 * perfectamente válido se habría reportado como inválido.
 *
 * La señal fiable es la cabecera `x-deny-reason` que añade el proxy.
 */
async function comprobarRed() {
  console.log(`\n${c.bold}Red${c.reset}`);

  const destinos = [
    "https://api.cloudflare.com/client/v4/",
    "https://api.stripe.com/v1",
  ];

  for (const destino of destinos) {
    const host = new URL(destino).host;
    try {
      const respuesta = await fetch(destino, { signal: AbortSignal.timeout(10_000) });

      if (respuesta.headers.get("x-deny-reason")) {
        mal(
          `El proxy del entorno bloquea ${host}`,
          await respuesta.text().catch(() => "Host fuera de la lista permitida."),
          "Añade api.cloudflare.com, *.supabase.co, *.supabase.com, api.stripe.com y *.r2.cloudflarestorage.com al acceso de red del entorno. Ver Paso 0 de docs/PUESTA-EN-MARCHA.md",
        );
        return false;
      }
    } catch (error) {
      mal(
        `No hay salida hacia ${host}`,
        String(error.cause?.code ?? error.message ?? error),
        "Revisa la política de red del entorno. Ver Paso 0 de docs/PUESTA-EN-MARCHA.md",
      );
      return false;
    }
  }

  ok("Hay salida a internet");
  return true;
}

async function comprobarCloudflare(env, cuenta) {
  const prefijo = cuenta === "app" ? "CF_APP" : "CF_CONTENT";
  const etiqueta = cuenta === "app" ? "app" : "contenido";

  console.log(`\n${c.bold}Cloudflare · cuenta «${etiqueta}»${c.reset}`);

  const token = env[`${prefijo}_API_TOKEN`];
  const accountId = env[`${prefijo}_ACCOUNT_ID`];

  if (!token) {
    mal(
      `${prefijo}_API_TOKEN sin rellenar`,
      "Es el token que me deja crear buckets, KV y desplegar el Worker.",
      "Mi perfil → Tokens de API → Crear token personalizado. Ver Paso 2.",
    );
    return;
  }

  const verificacion = await pedirCloudflare(token, "/user/tokens/verify");
  if (!verificacion.cuerpo?.success) {
    mal(
      "El token no es válido",
      verificacion.cuerpo?.errors?.[0]?.message ?? `HTTP ${verificacion.estado}`,
      "Revisa que lo has copiado entero. Solo se muestra una vez: si lo has perdido, crea otro.",
    );
    return;
  }
  ok("Token válido");

  if (!accountId) {
    mal(
      `${prefijo}_ACCOUNT_ID sin rellenar`,
      "Sin el id de cuenta no sé dónde crear las cosas.",
      "Está en el panel de Cloudflare, en la barra lateral derecha de la vista de la cuenta.",
    );
    return;
  }

  // Los permisos se comprueban usándolos, no leyéndolos: es la única forma de saber
  // que el token tiene lo que necesita.
  const r2 = await pedirCloudflare(token, `/accounts/${accountId}/r2/buckets`);
  if (r2.cuerpo?.success) {
    const n = r2.cuerpo.result?.buckets?.length ?? 0;
    ok("Permiso de R2", `(${n} bucket${n === 1 ? "" : "s"} ahora mismo)`);
  } else {
    mal(
      "Falta el permiso de R2",
      r2.cuerpo?.errors?.[0]?.message ?? `HTTP ${r2.estado}`,
      "Añade al token: Cuenta → Workers R2 Storage → Editar",
    );
  }

  const kv = await pedirCloudflare(token, `/accounts/${accountId}/storage/kv/namespaces`);
  if (kv.cuerpo?.success) {
    ok("Permiso de KV");
  } else {
    mal(
      "Falta el permiso de KV",
      kv.cuerpo?.errors?.[0]?.message ?? `HTTP ${kv.estado}`,
      "Añade al token: Cuenta → Workers KV Storage → Editar",
    );
  }

  const workers = await pedirCloudflare(token, `/accounts/${accountId}/workers/scripts`);
  if (workers.cuerpo?.success) {
    ok("Permiso de Workers");
  } else {
    mal(
      "Falta el permiso de Workers",
      workers.cuerpo?.errors?.[0]?.message ?? `HTTP ${workers.estado}`,
      "Añade al token: Cuenta → Workers Scripts → Editar",
    );
  }

  const zoneId = env[`${prefijo}_ZONE_ID`];
  if (!zoneId) {
    pendiente(`${prefijo}_ZONE_ID sin rellenar`, "— hace falta para los registros DNS");
  } else {
    const dns = await pedirCloudflare(token, `/zones/${zoneId}/dns_records?per_page=1`);
    if (dns.cuerpo?.success) ok("Permiso de DNS sobre la zona");
    else {
      mal(
        "Falta el permiso de DNS",
        dns.cuerpo?.errors?.[0]?.message ?? `HTTP ${dns.estado}`,
        "Añade al token: Zona → DNS → Editar, sobre esa zona",
      );
    }
  }
}

async function comprobarSupabase(env) {
  console.log(`\n${c.bold}Supabase${c.reset}`);

  const url = env["SUPABASE_URL"];
  if (!url) {
    mal(
      "SUPABASE_URL sin rellenar",
      "Es la URL del proyecto.",
      "Configuración del proyecto → API → Project URL. Ver Paso 3.",
    );
    return;
  }

  try {
    const respuesta = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: env["SUPABASE_ANON_KEY"] ?? "" },
      signal: AbortSignal.timeout(15_000),
    });
    if (respuesta.ok || respuesta.status === 404) ok("El proyecto responde", `(${url})`);
    else if (respuesta.status === 401) {
      mal(
        "La clave anon no es válida",
        `HTTP ${respuesta.status}`,
        "Configuración del proyecto → API → anon / public",
      );
    } else mal("El proyecto no responde como se espera", `HTTP ${respuesta.status}`);
  } catch (error) {
    mal("No se puede llegar al proyecto", String(error.message ?? error));
    return;
  }

  if (!env["SUPABASE_SERVICE_ROLE_KEY"]) {
    mal(
      "SUPABASE_SERVICE_ROLE_KEY sin rellenar",
      "Sin ella no puedo escribir versiones ni emitir facturas desde el servidor.",
      "Configuración del proyecto → API → service_role. Ojo: esquiva RLS, trátala como una contraseña maestra.",
    );
  } else {
    ok("Clave de servicio presente");
  }

  const dbUrl = env["SUPABASE_DB_URL"];
  if (!dbUrl) {
    mal(
      "SUPABASE_DB_URL sin rellenar",
      "Es la conexión que uso para aplicar las migraciones.",
      "Configuración → Base de datos → Connection string. Lleva la contraseña que te dio al crear el proyecto.",
    );
    return;
  }

  // La región importa y es difícil de cambiar después: mejor avisar ahora que
  // descubrirlo con clientes dentro.
  if (/eu-central-1|frankfurt/i.test(dbUrl) || /eu-central-1/i.test(url)) {
    ok("Región europea (Fráncfort)");
  } else {
    pendiente(
      "No puedo confirmar la región desde la URL",
      "— comprueba a mano que el proyecto está en Fráncfort (eu-central-1)",
    );
  }

  try {
    const { default: pg } = await import("pg");
    const cliente = new pg.Client({ connectionString: dbUrl, connectionTimeoutMillis: 15_000 });
    await cliente.connect();
    const { rows } = await cliente.query("select current_database() as db");
    await cliente.end();
    ok("Conexión a Postgres", `(${rows[0].db})`);
  } catch (error) {
    mal(
      "No se puede conectar a Postgres",
      String(error.message ?? error),
      "Revisa que la contraseña de la cadena de conexión es la correcta.",
    );
  }
}

async function main() {
  console.log(`\n${c.bold}Magic Upload — verificación de credenciales${c.reset}`);
  console.log(`${c.dim}Guía completa en docs/PUESTA-EN-MARCHA.md${c.reset}`);

  const env = cargarEnv();

  if (!(await comprobarRed())) {
    console.log(
      `\n${c.yellow}Sin salida a internet no puedo comprobar nada más.${c.reset}\n`,
    );
    process.exit(1);
  }

  await comprobarCloudflare(env, "app");
  await comprobarCloudflare(env, "contenido");
  await comprobarSupabase(env);

  const fallos = resultados.filter((r) => r.estado === "mal").length;
  const pendientes = resultados.filter((r) => r.estado === "pendiente").length;

  console.log("");
  if (fallos === 0 && pendientes === 0) {
    console.log(`${c.green}${c.bold}Todo correcto.${c.reset} Dímelo y sigo yo desde aquí.\n`);
  } else if (fallos === 0) {
    console.log(
      `${c.yellow}Lo esencial funciona${c.reset}, quedan ${pendientes} cosa(s) por rellenar.\n`,
    );
  } else {
    console.log(
      `${c.red}${fallos} cosa(s) por arreglar${c.reset}. Cada una lleva arriba qué hacer.\n`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\n${c.red}El script ha fallado:${c.reset}`, error);
  process.exit(1);
});
