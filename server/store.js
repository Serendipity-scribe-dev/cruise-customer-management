import pg from "pg";
import { buildSeed } from "./seed.js";

/* Both stores expose the same small async interface, so the app never knows which one it has:
   list, get, insert, update, remove, addAudit, listAudit */

export function createMemoryStore(seed = buildSeed()) {
  let rows = seed.map((c, i) => ({ ...structuredClone(c), id: i + 1 }));
  let nextId = rows.length + 1;
  let audit = [];
  return {
    kind: "memory",
    async list() { return structuredClone(rows); },
    async get(id) { const c = rows.find((x) => x.id === id); return c ? structuredClone(c) : null; },
    async insert(c) { const row = { ...structuredClone(c), id: nextId++ }; rows.push(row); return structuredClone(row); },
    async update(c) {
      const i = rows.findIndex((x) => x.id === c.id);
      if (i < 0) return null;
      rows[i] = structuredClone(c);
      return structuredClone(c);
    },
    async remove(id) { const n = rows.length; rows = rows.filter((x) => x.id !== id); return rows.length < n; },
    async addAudit(e) { audit.unshift(e); audit = audit.slice(0, 500); },
    async listAudit({ customerId = null, limit = 50 } = {}) {
      return audit.filter((a) => customerId == null || a.customerId === customerId).slice(0, limit);
    },
  };
}

// Each customer is stored as one JSONB document (bookings, travelers, payments and notes live inside it).
export function createPgStore(url) {
  const pool = new pg.Pool({ connectionString: url, max: 3 });
  const hydrate = (r) => ({ ...r.data, id: r.id });
  let ready;

  const init = () =>
    (ready ??= (async () => {
      await pool.query("CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, data JSONB NOT NULL)");
      await pool.query(
        "CREATE TABLE IF NOT EXISTS audit_log (id SERIAL PRIMARY KEY, customer_id INT, data JSONB NOT NULL)"
      );
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(7421)"); // stops two cold starts seeding twice
        const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM customers");
        if (rows[0].n === 0) {
          for (const c of buildSeed()) await client.query("INSERT INTO customers (data) VALUES ($1)", [c]);
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    })().catch((e) => {
      ready = undefined;
      throw e;
    }));

  return {
    kind: "postgres",
    async list() {
      await init();
      return (await pool.query("SELECT id, data FROM customers ORDER BY id")).rows.map(hydrate);
    },
    async get(id) {
      await init();
      const { rows } = await pool.query("SELECT id, data FROM customers WHERE id = $1", [id]);
      return rows[0] ? hydrate(rows[0]) : null;
    },
    async insert(c) {
      await init();
      const { id: _drop, ...data } = c;
      const { rows } = await pool.query("INSERT INTO customers (data) VALUES ($1) RETURNING id, data", [data]);
      return hydrate(rows[0]);
    },
    async update(c) {
      await init();
      const { id, ...data } = c;
      const { rows } = await pool.query("UPDATE customers SET data = $2 WHERE id = $1 RETURNING id, data", [id, data]);
      return rows[0] ? hydrate(rows[0]) : null;
    },
    async remove(id) {
      await init();
      return (await pool.query("DELETE FROM customers WHERE id = $1", [id])).rowCount > 0;
    },
    async addAudit(e) {
      await init();
      await pool.query("INSERT INTO audit_log (customer_id, data) VALUES ($1, $2)", [e.customerId, e]);
    },
    async listAudit({ customerId = null, limit = 50 } = {}) {
      await init();
      const { rows } = await pool.query(
        "SELECT data FROM audit_log WHERE ($1::int IS NULL OR customer_id = $1) ORDER BY id DESC LIMIT $2",
        [customerId, limit]
      );
      return rows.map((r) => r.data);
    },
  };
}

export const createDefaultStore = () =>
  process.env.DATABASE_URL ? createPgStore(process.env.DATABASE_URL) : createMemoryStore();
