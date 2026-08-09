/**
 * Verificación contra PostgreSQL real de las dos reglas duras de ADR-0004.
 *
 * Hasta ahora estaban solo afirmadas en la documentación. Aquí se comprueban:
 *
 *   1. **La numeración de facturas no tiene huecos**, ni con emisiones concurrentes ni
 *      cuando una transacción hace rollback.
 *   2. **Las facturas son inmutables**, incluido para el rol de servicio, que es el
 *      que esquiva RLS y el que usaría un script de «arreglar una factura rápido».
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createUser,
  databaseAvailable,
  setupDatabase,
  type TestDatabase,
} from "./harness.js";

const available = await databaseAvailable();

describe.skipIf(!available)("facturación contra PostgreSQL", () => {
  let db: TestDatabase;
  let orgId: string;

  beforeAll(async () => {
    db = await setupDatabase("test_billing");
    await db.service(`
      insert into plans (code, name, price_cents_month, price_cents_year, sort_order)
      values ('free','Gratis',0,0,1), ('basic','Básico',899,8990,2)
    `);
    ({ orgId } = await createUser(db, "ana@ejemplo.es"));
    await db.service("insert into invoice_sequences (series) values ('A2026'), ('R2026')");
  });

  afterAll(async () => {
    await db?.close();
  });

  /** Emite una factura completa en una sola transacción, como hará la aplicación. */
  async function issueInvoice(series = "A2026", baseCents = 899): Promise<number> {
    const vat = Math.round(baseCents * 0.21);
    const [row] = await db.service<{ number: number }>(
      `
      insert into invoices (
        org_id, series, number, operation_date,
        issuer_snapshot, customer_snapshot,
        tax_regime, base_cents, vat_rate, vat_cents, total_cents
      ) values (
        $1, $2, next_invoice_number($2), current_date,
        '{"nombre":"Magic Upload SL"}'::jsonb, '{"nombre":"Cliente"}'::jsonb,
        'es_standard', $3, 21, $4, $5
      ) returning number
      `,
      [orgId, series, baseCents, vat, baseCents + vat],
    );
    return row!.number;
  }

  describe("numeración sin huecos", () => {
    it("empieza en 1 y avanza de uno en uno", async () => {
      expect(await issueInvoice()).toBe(1);
      expect(await issueInvoice()).toBe(2);
      expect(await issueInvoice()).toBe(3);
    });

    it("cada serie lleva su propia numeración", async () => {
      // La rectificativa va en su propia serie y empieza por su propio 1.
      expect(await issueInvoice("R2026")).toBe(1);
      expect(await issueInvoice("A2026")).toBe(4);
    });

    it("veinte emisiones concurrentes no repiten ni saltan un número", async () => {
      // Es la prueba que motiva usar una tabla con bloqueo de fila en lugar de un
      // contador en la aplicación. Con un contador en memoria, esto produciría
      // duplicados; con una secuencia de Postgres, huecos al hacer rollback.
      const before = await nextNumber("A2026");

      const numbers = await Promise.all(
        Array.from({ length: 20 }, () => issueInvoice("A2026")),
      );

      const sorted = [...numbers].sort((a, b) => a - b);
      const expected = Array.from({ length: 20 }, (_, i) => before + i);

      expect(sorted).toEqual(expected);
      expect(new Set(numbers).size).toBe(20); // sin duplicados
    });

    it("un rollback devuelve el número: no se pierde", async () => {
      // Aquí es donde una secuencia de Postgres (`serial`) fallaría. Las secuencias
      // son deliberadamente no transaccionales y dejan hueco al hacer rollback, que
      // es exactamente el problema con Hacienda que queremos evitar.
      const before = await nextNumber("A2026");

      const client = await db.client();
      try {
        await client.query("begin");
        await client.query("select next_invoice_number('A2026')");
        await client.query("rollback");
      } finally {
        await client.end();
      }

      expect(await nextNumber("A2026")).toBe(before);

      // Y la siguiente factura real toma ese mismo número, sin saltárselo.
      expect(await issueInvoice("A2026")).toBe(before);
    });

    it("no deja emitir en una serie que no existe", async () => {
      await expect(issueInvoice("NOEXISTE")).rejects.toThrow();
    });

    it("la serie completa queda correlativa, sin huecos", async () => {
      // La comprobación que haría una inspección: ordenar los números de la serie y
      // ver que no falta ninguno.
      const rows = await db.service<{ number: number }>(
        "select number from invoices where series = 'A2026' order by number",
      );
      const numbers = rows.map((r) => r.number);

      expect(numbers).toEqual(
        Array.from({ length: numbers.length }, (_, i) => i + 1),
      );
    });
  });

  describe("inmutabilidad", () => {
    it("el rol de servicio no puede modificar una factura", async () => {
      // Este es EL test. El rol de servicio esquiva RLS, así que si la inmutabilidad
      // dependiera solo de las políticas, esto pasaría sin problema.
      await expect(
        db.service("update invoices set total_cents = 1 where series = 'A2026'"),
      ).rejects.toThrow(/inmutables/);
    });

    it("el rol de servicio no puede borrar una factura", async () => {
      await expect(
        db.service("delete from invoices where series = 'A2026'"),
      ).rejects.toThrow(/no se borran/);
    });

    it("el mensaje dice qué hacer en su lugar", async () => {
      await expect(
        db.service("update invoices set base_cents = 0 where series = 'A2026'"),
      ).rejects.toThrow(/rectificativa/);
    });

    it("tampoco se pueden tocar las líneas ni el registro", async () => {
      const [invoice] = await db.service<{ id: string }>(
        "select id from invoices where series = 'A2026' limit 1",
      );
      await db.service(
        `insert into invoice_lines (invoice_id, position, description, unit_price_cents, vat_rate)
         values ($1, 1, 'Suscripción Básico — agosto 2026', 899, 21)`,
        [invoice!.id],
      );

      await expect(
        db.service("update invoice_lines set unit_price_cents = 0"),
      ).rejects.toThrow(/inmutables/);
    });

    it("la aritmética no puede cuadrar mal ni en la inserción", async () => {
      // Como no se puede editar, un total incoherente sería permanente. La restricción
      // impide que llegue a existir.
      await expect(
        db.service(
          `insert into invoices (org_id, series, number, operation_date,
             issuer_snapshot, customer_snapshot, tax_regime,
             base_cents, vat_rate, vat_cents, total_cents)
           values ($1,'A2026', next_invoice_number('A2026'), current_date,
             '{}'::jsonb, '{}'::jsonb, 'es_standard', 1000, 21, 210, 9999)`,
          [orgId],
        ),
      ).rejects.toThrow(/invoices_total_matches/);
    });
  });

  describe("rectificativas", () => {
    it("marcan la original como rectificada sin editar nada más", async () => {
      const [original] = await db.service<{ id: string; total_cents: number }>(
        "select id, total_cents from invoices where series = 'A2026' order by number limit 1",
      );
      // La rectificativa referencia a la original AL INSERTARSE: en ese momento ya
      // sabe a qué factura corrige, así que no hace falta un UPDATE posterior.
      await db.service(
        `insert into invoices (org_id, series, number, operation_date,
           issuer_snapshot, customer_snapshot, tax_regime,
           base_cents, vat_rate, vat_cents, total_cents, rectifies_invoice_id)
         values ($1,'R2026', next_invoice_number('R2026'), current_date,
           '{}'::jsonb, '{}'::jsonb, 'es_standard', -899, 21, -189, -1088, $2)`,
        [orgId, original!.id],
      );

      await db.service("select mark_invoice_rectified($1)", [original!.id]);

      const [after] = await db.service<{ status: string; total_cents: number }>(
        "select status, total_cents from invoices where id = $1",
        [original!.id],
      );

      expect(after!.status).toBe("rectified");
      // El importe original NO cambia: eso es lo que significa rectificar.
      expect(after!.total_cents).toBe(original!.total_cents);
    });

    it("una factura ya rectificada no se puede volver a rectificar", async () => {
      const [original] = await db.service<{ id: string }>(
        "select id from invoices where status = 'rectified' limit 1",
      );

      await expect(
        db.service("select mark_invoice_rectified($1)", [original!.id]),
      ).rejects.toThrow(/no está en estado emitida/);
    });

    it("marcar el estado sigue sin permitir tocar ningún importe", async () => {
      // La excepción es de una sola columna. Si alguien intenta colar un importe en el
      // mismo UPDATE, el trigger lo ve porque compara la fila entera menos `status`.
      await expect(
        db.service(
          "update invoices set status = 'void', total_cents = 1 where series = 'A2026'",
        ),
      ).rejects.toThrow(/inmutables/);
    });
  });

  describe("registro de facturación encadenado (Verifactu)", () => {
    it("guarda la cadena de huellas y admite la respuesta de la AEAT", async () => {
      const rows = await db.service<{ id: string }>(
        "select id from invoices where series = 'A2026' order by number limit 2",
      );

      await db.service(
        `insert into invoice_registry (invoice_id, kind, prev_hash, hash, payload)
         values ($1,'alta', null, 'h1', '{}'::jsonb), ($2,'alta','h1','h2','{}'::jsonb)`,
        [rows[0]!.id, rows[1]!.id],
      );

      const [registry] = await db.service<{ id: string; aeat_status: string }>(
        "select id, aeat_status from invoice_registry where hash = 'h2'",
      );
      expect(registry!.aeat_status).toBe("pendiente");

      await db.service("select record_aeat_response($1, 'aceptado', '{\"csv\":\"X\"}'::jsonb)", [
        registry!.id,
      ]);

      const [after] = await db.service<{ aeat_status: string }>(
        "select aeat_status from invoice_registry where id = $1",
        [registry!.id],
      );
      expect(after!.aeat_status).toBe("aceptado");
    });

    it("un registro no se puede alterar por la vía normal", async () => {
      await expect(
        db.service("update invoice_registry set hash = 'falsificado'"),
      ).rejects.toThrow(/cadena de huellas no se altera/);
    });
  });

  async function nextNumber(series: string): Promise<number> {
    const [row] = await db.service<{ next_number: number }>(
      "select next_number from invoice_sequences where series = $1",
      [series],
    );
    return row!.next_number;
  }
});

if (!available) {
  // Un salto silencioso es un test que pasa sin probar nada.
  console.warn(
    "\n⚠️  Tests de base de datos saltados: no hay PostgreSQL en " +
      "MAGIC_UPLOAD_TEST_DB. Arráncalo con packages/db/scripts/start-test-db.sh\n",
  );
}
