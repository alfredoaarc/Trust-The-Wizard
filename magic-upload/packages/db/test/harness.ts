/**
 * Arnés para probar el esquema contra un PostgreSQL real.
 *
 * Probar RLS leyendo el SQL no sirve de nada: una política mal escrita se lee
 * perfectamente. Aquí se levanta el esquema de cero, se crean usuarios, y se consulta
 * **suplantando a cada uno** para comprobar quién ve qué.
 *
 * Cada suite usa su propia BASE DE DATOS, no su propio esquema. La diferencia importa:
 * las funciones `security definer` fijan `search_path = public` —que es lo correcto,
 * porque evita que alguien las secuestre creando una tabla homónima en otro esquema—,
 * así que probarlas fuera de `public` sería probar algo que no desplegamos. Con una
 * base por suite todo vive en `public`, igual que en producción, y siguen aisladas.
 *
 * Si no hay base de datos disponible, los tests se saltan con un aviso visible en
 * lugar de fallar: el CI no debe ponerse rojo por infraestructura ausente, pero tampoco
 * verde en silencio sin haber probado nada.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));
const SHIM = fileURLToPath(new URL("./supabase-shim.sql", import.meta.url));

/**
 * Conexión al servidor de pruebas.
 *
 * Se configura con las variables estándar `PGHOST`, `PGPORT` y `PGUSER`, que `pg` ya
 * entiende. Por defecto apunta al socket que deja `scripts/start-test-db.sh`.
 *
 * No se usa cadena de conexión porque `new URL()` no admite un socket Unix como host,
 * y el socket es lo que permite arrancar un PostgreSQL desechable sin puerto TCP.
 */
const SERVER: pg.ClientConfig = {
  host: process.env["PGHOST"] ?? "/tmp/mupg",
  port: Number(process.env["PGPORT"] ?? 55432),
  user: process.env["PGUSER"] ?? "postgres",
};

/** Base de mantenimiento: la que se usa para crear y borrar las demás. */
const MAINTENANCE_DB = process.env["PGDATABASE"] ?? "postgres";

export async function databaseAvailable(): Promise<boolean> {
  const client = new pg.Client({ ...SERVER, database: MAINTENANCE_DB });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

export interface TestDatabase {
  /** Ejecuta como rol de servicio: esquiva RLS, igual que en Supabase. */
  service<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  /** Ejecuta suplantando a un usuario autenticado concreto. Aplica RLS. */
  as<T = unknown>(userId: string, sql: string, params?: readonly unknown[]): Promise<T[]>;
  /** Ejecuta sin sesión, como visitante anónimo. Aplica RLS. */
  anon<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  /** Cliente crudo, para las pruebas de transacciones y concurrencia. */
  client(): Promise<pg.Client>;
  close(): Promise<void>;
}

/** Crea una base de datos limpia y aplica el shim y todas las migraciones. */
export async function setupDatabase(name: string): Promise<TestDatabase> {
  const maintenance = new pg.Client({ ...SERVER, database: MAINTENANCE_DB });
  await maintenance.connect();
  try {
    // `with (force)` cierra las conexiones que hayan quedado de una ejecución anterior
    // interrumpida; sin eso, un test cancelado bloquea todos los siguientes.
    await maintenance.query(`drop database if exists ${name} with (force)`);
    await maintenance.query(`create database ${name}`);
  } finally {
    await maintenance.end();
  }

  const database = { ...SERVER, database: name };
  const setup = new pg.Client(database);
  await setup.connect();
  try {
    await setup.query(readFileSync(SHIM, "utf8"));

    const migrations = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    for (const file of migrations) {
      await setup.query(readFileSync(`${MIGRATIONS_DIR}${file}`, "utf8"));
    }

    // En Supabase esto lo hacen los `default privileges` del proyecto.
    await setup.query(`
      grant select, insert, update, delete on all tables in schema public
        to authenticated, service_role;
      grant select on all tables in schema public to anon;
      grant usage on all sequences in schema public to authenticated, service_role;
      grant execute on all functions in schema public to anon, authenticated, service_role;
    `);
  } finally {
    await setup.end();
  }

  const pool = new pg.Pool({ ...database, max: 10 });

  async function run<T>(
    role: string,
    userId: string | null,
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const client = await pool.connect();
    try {
      // Así es como PostgREST entrega la identidad a las políticas en Supabase:
      // un ajuste de sesión que `auth.uid()` lee.
      await client.query(
        userId
          ? `set request.jwt.claims = '${JSON.stringify({ sub: userId })}'`
          : "set request.jwt.claims = ''",
      );
      await client.query(`set role ${role}`);
      const result = await client.query(sql, params as unknown[]);
      return result.rows as T[];
    } finally {
      // Sin esto, la conexión vuelve al pool con el rol puesto y la siguiente consulta
      // se ejecutaría con permisos que no le tocan.
      await client.query("reset role").catch(() => {});
      client.release();
    }
  }

  return {
    service: (sql, params) => run("service_role", null, sql, params),
    as: (userId, sql, params) => run("authenticated", userId, sql, params),
    anon: (sql, params) => run("anon", null, sql, params),
    async client() {
      const client = new pg.Client(database);
      await client.connect();
      return client;
    },
    async close() {
      await pool.end();
    },
  };
}

/** Crea un usuario y devuelve su id y el de su organización personal. */
export async function createUser(
  db: TestDatabase,
  email: string,
): Promise<{ userId: string; orgId: string }> {
  const [user] = await db.service<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [email],
  );
  const userId = user!.id;

  const [membership] = await db.service<{ org_id: string }>(
    "select org_id from memberships where user_id = $1",
    [userId],
  );

  return { userId, orgId: membership!.org_id };
}
