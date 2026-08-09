/**
 * Aislamiento entre organizaciones, comprobado contra PostgreSQL real.
 *
 * Una política RLS mal escrita se LEE perfectamente. La única forma de saber que hace
 * lo que dice es consultar suplantando a cada usuario y mirar qué filas salen.
 *
 * El caso que protege esto es concreto: dos agencias distintas, cada una con las
 * propuestas de sus clientes. Que una vea las de la otra no es un bug, es el final del
 * producto.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createUser,
  databaseAvailable,
  setupDatabase,
  type TestDatabase,
} from "./harness.js";

const available = await databaseAvailable();

describe.skipIf(!available)("RLS contra PostgreSQL", () => {
  let db: TestDatabase;

  // Dos agencias sin ninguna relación, y un empleado de la primera.
  let ana = { userId: "", orgId: "" };
  let bruno = { userId: "", orgId: "" };
  let carla = { userId: "", orgId: "" };
  let sitioDeAna = "";
  let sitioDeBruno = "";

  beforeAll(async () => {
    db = await setupDatabase("test_rls");
    await db.service(`
      insert into plans (code, name, price_cents_month, price_cents_year, sort_order)
      values ('free','Gratis',0,0,1), ('agency','Agencia',3900,39000,4)
    `);

    ana = await createUser(db, "ana@agencia-uno.es");
    bruno = await createUser(db, "bruno@agencia-dos.es");
    carla = await createUser(db, "carla@agencia-uno.es");

    // Carla entra en la organización de Ana como `member`.
    await db.service("insert into memberships (org_id, user_id, role) values ($1,$2,'member')", [
      ana.orgId,
      carla.userId,
    ]);

    sitioDeAna = await createSite(ana.orgId, "propuesta-acme", "Acme");
    sitioDeBruno = await createSite(bruno.orgId, "propuesta-zeta", "Zeta");
  });

  afterAll(async () => {
    await db?.close();
  });

  async function createSite(orgId: string, subdomain: string, name: string): Promise<string> {
    const [row] = await db.service<{ id: string }>(
      "insert into sites (org_id, subdomain, name) values ($1,$2,$3) returning id",
      [orgId, subdomain, name],
    );
    return row!.id;
  }

  describe("alta de usuario", () => {
    it("crea perfil y organización personal en la misma transacción", async () => {
      // Nunca existe un usuario sin organización. Si existiera, cada pantalla del panel
      // tendría que gestionar ese estado intermedio y una de ellas se olvidaría.
      const [perfil] = await db.service("select id from profiles where id = $1", [ana.userId]);
      expect(perfil).toBeDefined();
      expect(ana.orgId).toBeTruthy();
    });

    it("el usuario es owner de su organización personal", async () => {
      const [m] = await db.service<{ role: string }>(
        "select role from memberships where org_id = $1 and user_id = $2",
        [ana.orgId, ana.userId],
      );
      expect(m!.role).toBe("owner");
    });

    it("dos usuarios con el mismo nombre de correo no colisionan de slug", async () => {
      const uno = await createUser(db, "info@empresa-a.es");
      const dos = await createUser(db, "info@empresa-b.es");
      expect(uno.orgId).not.toBe(dos.orgId);
    });
  });

  describe("dos agencias no se ven", () => {
    it("Ana solo ve sus sitios", async () => {
      const filas = await db.as<{ subdomain: string }>(ana.userId, "select subdomain from sites");
      expect(filas.map((f) => f.subdomain)).toEqual(["propuesta-acme"]);
    });

    it("Bruno solo ve los suyos", async () => {
      const filas = await db.as<{ subdomain: string }>(bruno.userId, "select subdomain from sites");
      expect(filas.map((f) => f.subdomain)).toEqual(["propuesta-zeta"]);
    });

    it("pedir el sitio de otro por su id devuelve vacío, no un error", async () => {
      // Un error revelaría que el sitio existe. Vacío no revela nada.
      const filas = await db.as(ana.userId, "select * from sites where id = $1", [sitioDeBruno]);
      expect(filas).toEqual([]);
    });

    it("Ana no puede modificar el sitio de Bruno", async () => {
      await db.as(ana.userId, "update sites set noindex = true where id = $1", [sitioDeBruno]);

      const [sitio] = await db.service<{ noindex: boolean }>(
        "select noindex from sites where id = $1",
        [sitioDeBruno],
      );
      // El UPDATE no falla: simplemente no encuentra ninguna fila que le pertenezca.
      expect(sitio!.noindex).toBe(false);
    });

    it("Ana no puede crear un sitio dentro de la organización de Bruno", async () => {
      await expect(
        db.as(ana.userId, "insert into sites (org_id, subdomain, name) values ($1,'colado','X')", [
          bruno.orgId,
        ]),
      ).rejects.toThrow(/row-level security/);
    });

    it("Ana no ve la organización de Bruno", async () => {
      const filas = await db.as(ana.userId, "select id from organizations where id = $1", [
        bruno.orgId,
      ]);
      expect(filas).toEqual([]);
    });

    it("ni sus miembros", async () => {
      const filas = await db.as(ana.userId, "select user_id from memberships where org_id = $1", [
        bruno.orgId,
      ]);
      expect(filas).toEqual([]);
    });
  });

  describe("roles dentro de una organización", () => {
    it("un member ve los sitios de su organización", async () => {
      const filas = await db.as<{ subdomain: string }>(carla.userId, "select subdomain from sites");
      expect(filas.map((f) => f.subdomain)).toEqual(["propuesta-acme"]);
    });

    it("un member puede publicar y editar sitios", async () => {
      // Publicar es el trabajo diario: si un `member` no pudiera, el rol no serviría.
      await db.as(carla.userId, "update sites set noindex = true where id = $1", [sitioDeAna]);

      const [sitio] = await db.service<{ noindex: boolean }>(
        "select noindex from sites where id = $1",
        [sitioDeAna],
      );
      expect(sitio!.noindex).toBe(true);
    });

    it("un member NO puede borrar un sitio", async () => {
      // Borrar es destructivo y queda para owner y admin.
      await db.as(carla.userId, "delete from sites where id = $1", [sitioDeAna]);

      const filas = await db.service("select id from sites where id = $1", [sitioDeAna]);
      expect(filas).toHaveLength(1);
    });

    it("un member NO puede invitar a nadie", async () => {
      const intruso = await createUser(db, "intruso@fuera.es");

      await expect(
        db.as(carla.userId, "insert into memberships (org_id, user_id) values ($1,$2)", [
          ana.orgId,
          intruso.userId,
        ]),
      ).rejects.toThrow(/row-level security/);
    });

    it("un owner sí puede invitar", async () => {
      const nuevo = await createUser(db, "nuevo@agencia-uno.es");

      await db.as(ana.userId, "insert into memberships (org_id, user_id) values ($1,$2)", [
        ana.orgId,
        nuevo.userId,
      ]);

      const filas = await db.service("select 1 from memberships where org_id = $1 and user_id = $2", [
        ana.orgId,
        nuevo.userId,
      ]);
      expect(filas).toHaveLength(1);
    });
  });

  describe("datos de facturación", () => {
    it("solo owner y admin ven el perfil fiscal", async () => {
      // En una organización personal —freelance— el domicilio fiscal es el domicilio
      // particular del titular. Un colaborador invitado para publicar una web no
      // tiene por qué verlo.
      await db.service(
        `insert into billing_profiles (org_id, legal_name, tax_id, tax_id_type, is_business,
           address_line1, postal_code, city, country_code, tax_zone)
         values ($1,'Agencia Uno SL','B12345674','cif',true,'Calle Mayor 1','28001','Madrid','ES','es_peninsula_baleares')`,
        [ana.orgId],
      );

      expect(await db.as(ana.userId, "select tax_id from billing_profiles")).toHaveLength(1);
      expect(await db.as(carla.userId, "select tax_id from billing_profiles")).toEqual([]);
    });

    it("un member tampoco lo puede modificar", async () => {
      // Ojo con la forma de comprobarlo: un UPDATE bloqueado por RLS NO lanza error,
      // simplemente no encuentra filas que le pertenezcan. Esperar una excepción daría
      // un test verde que no prueba nada.
      await db.as(carla.userId, "update billing_profiles set tax_id = 'X' where org_id = $1", [
        ana.orgId,
      ]);

      const [perfil] = await db.service<{ tax_id: string }>(
        "select tax_id from billing_profiles where org_id = $1",
        [ana.orgId],
      );
      expect(perfil!.tax_id).toBe("B12345674");
    });

    it("Bruno no ve el NIF de la agencia de Ana", async () => {
      const filas = await db.as(bruno.userId, "select tax_id from billing_profiles");
      expect(filas).toEqual([]);
    });
  });

  describe("lo que ve un visitante sin sesión", () => {
    it("nada de sitios, organizaciones ni facturas", async () => {
      for (const tabla of ["sites", "organizations", "memberships", "billing_profiles", "invoices"]) {
        const filas = await db.anon(`select * from ${tabla}`);
        expect(filas, tabla).toEqual([]);
      }
    });

    it("pero sí los planes y sus límites: la página de precios no exige cuenta", async () => {
      const planes = await db.anon<{ code: string }>("select code from plans order by sort_order");
      expect(planes.map((p) => p.code)).toEqual(["free", "agency"]);
    });
  });

  describe("degradación sin destrucción (ADR-0007)", () => {
    it("archivar conserva el sitio y fija la ventana de 12 meses", async () => {
      await db.service("select archive_site($1)", [sitioDeAna]);

      const [sitio] = await db.service<{
        status: string;
        archived_at: Date;
        purgeable_at: Date;
      }>("select status, archived_at, purgeable_at from sites where id = $1", [sitioDeAna]);

      expect(sitio!.status).toBe("archived");
      expect(sitio!.archived_at).toBeInstanceOf(Date);

      // La ventana de recuperación son 12 meses. Si este test se cae porque alguien la
      // acortó «para ahorrar almacenamiento», que lea ADR-0007 antes de tocarlo: es una
      // decisión de marca, no una ineficiencia.
      const meses =
        (sitio!.purgeable_at.getTime() - sitio!.archived_at.getTime()) / (1000 * 60 * 60 * 24 * 30);
      expect(Math.round(meses)).toBe(12);
    });

    it("el sitio archivado sigue existiendo y su dueño lo sigue viendo", async () => {
      const filas = await db.as(ana.userId, "select id from sites where id = $1", [sitioDeAna]);
      expect(filas).toHaveLength(1);
    });
  });

  describe("integridad del puntero de versión activa (ADR-0002)", () => {
    it("no se puede borrar la versión que un sitio está sirviendo", async () => {
      const [version] = await db.service<{ id: string }>(
        `insert into site_versions (site_id, r2_prefix, bytes, file_count, checksum, source)
         values ($1,'sites/x/v1/',1024,3,'abc','upload_zip') returning id`,
        [sitioDeBruno],
      );
      await db.service("update sites set active_version_id = $1 where id = $2", [
        version!.id,
        sitioDeBruno,
      ]);

      // `on delete restrict`: borrar la versión activa dejaría el sitio sirviendo un
      // prefijo de R2 que ya no tiene fila. El puntero atómico deja de serlo.
      await expect(
        db.service("delete from site_versions where id = $1", [version!.id]),
      ).rejects.toThrow(/foreign key|violates/i);
    });

    it("un subdominio no se puede registrar dos veces", async () => {
      await expect(
        db.service("insert into sites (org_id, subdomain, name) values ($1,'propuesta-acme','Otro')", [
          bruno.orgId,
        ]),
      ).rejects.toThrow(/duplicate key|unique/i);
    });

    it("y la comparación de subdominios ignora mayúsculas", async () => {
      // `citext`: si «Propuesta-Acme» y «propuesta-acme» fuesen sitios distintos,
      // tendríamos dos URL que la gente lee como la misma.
      await expect(
        db.service("insert into sites (org_id, subdomain, name) values ($1,'Propuesta-ACME','Otro')", [
          bruno.orgId,
        ]),
      ).rejects.toThrow(/duplicate key|unique/i);
    });
  });
});
