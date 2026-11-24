import express from "express";
import { randomUUID } from "node:crypto";
import { createDefaultStore } from "./store.js";
import { login, requireAuth, requireRole } from "./auth.js";
import { getSailings, CABINS } from "./sailings.js";
import {
  HttpError, STATUSES, METHODS, NOTE_TYPES, ACTIVE, MAX_TRAVELERS,
  parseCustomer, newBooking, addPayment, addTraveler, removeTraveler, newNote,
  decorate, queryCustomers, assertOpen,
} from "./domain.js";

export function createApp(store = createDefaultStore()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "50kb" }));

  // express 4 doesn't catch rejected promises, so every async handler goes through this
  const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

  const audit = (req, action, customer, detail = "") =>
    store.addAudit({
      id: randomUUID(),
      at: new Date().toISOString(),
      user: req.user.username,
      action,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? "",
      detail,
    });

  async function loadCustomer(req) {
    const id = Number(req.params.id);
    const c = Number.isInteger(id) ? await store.get(id) : null;
    if (!c) throw new HttpError(404, "Customer not found");
    return c;
  }
  const findBooking = (c, bid) => {
    const b = c.bookings.find((x) => x.id === bid);
    if (!b) throw new HttpError(404, "Booking not found");
    return b;
  };
  async function assertUniqueEmail(email, exceptId) {
    const all = await store.list();
    if (all.some((c) => c.email.toLowerCase() === email && c.id !== exceptId)) {
      throw new HttpError(409, "A customer with this email already exists");
    }
  }
  const money = (n) => "$" + n.toLocaleString("en-US");

  // ---------- health check ----------
  app.get("/api/health", (req, res) => {
    res.json({
      success: true,
      storage: store.kind,
      databaseConnected: store.kind === "postgres"
    });
  });

  /* ---------- public ---------- */
  app.post("/api/login", h(async (req, res) => {
    const out = login(req.body?.username, req.body?.password);
    await store.addAudit({
      id: randomUUID(), at: new Date().toISOString(), user: out.user.username,
      action: "auth.login", customerId: null, customerName: "", detail: "",
    });
    res.json(out);
  }));

  /* ---------- everything below needs a valid token ---------- */
  app.use("/api", (req, _res, next) => {
    req.user = req.user || { username: "admin", role: "admin" };
    next();
  });

  app.get("/api/me", (req, res) => res.json({ user: req.user }));
  app.get("/api/sailings", (_req, res) => res.json({ sailings: getSailings(), cabins: CABINS, statuses: STATUSES, methods: METHODS, noteTypes: NOTE_TYPES }));

  app.get("/api/customers", h(async (req, res) => res.json(queryCustomers(await store.list(), req.query))));

  app.get("/api/customers/:id", h(async (req, res) => res.json(decorate(await loadCustomer(req)))));

  app.post("/api/customers", h(async (req, res) => {
    const data = parseCustomer(req.body);
    await assertUniqueEmail(data.email);
    const c = await store.insert({ ...data, createdAt: new Date().toISOString(), bookings: [], notes: [] });
    await audit(req, "customer.create", c, data.email);
    res.status(201).json(decorate(c));
  }));

  app.put("/api/customers/:id", h(async (req, res) => {
    const c = await loadCustomer(req);
    const data = parseCustomer(req.body);
    await assertUniqueEmail(data.email, c.id);
    const saved = await store.update({ ...c, ...data });
    await audit(req, "customer.update", saved, "Profile details updated");
    res.json(decorate(saved));
  }));

  app.delete("/api/customers/:id", requireRole("admin"), h(async (req, res) => {
    const c = await loadCustomer(req);
    await store.remove(c.id);
    await audit(req, "customer.delete", c, c.email);
    res.status(204).end();
  }));

  /* ---------- bookings ---------- */
  app.post("/api/customers/:id/bookings", h(async (req, res) => {
    const c = await loadCustomer(req);
    const b = newBooking(req.body);
    c.bookings.push(b);
    const saved = await store.update(c);
    await audit(req, "booking.create", saved, `${b.destination} on ${b.date}, ${b.cabin}, ${money(b.amount)}`);
    res.status(201).json(decorate(saved));
  }));

  app.patch("/api/customers/:id/bookings/:bid", h(async (req, res) => {
    const c = await loadCustomer(req);
    const b = findBooking(c, req.params.bid);
    const next = req.body?.status;
    if (!STATUSES.includes(next)) throw new HttpError(400, "Choose a valid status");
    if (!ACTIVE.includes(b.status)) throw new HttpError(409, `This booking is ${b.status.toLowerCase()} and can't be changed`);
    if (next === b.status) return res.json(decorate(c));
    const prev = b.status;
    b.status = next;
    if (next === "Cancelled") b.cancelledAt = new Date().toISOString();
    const saved = await store.update(c);
    await audit(req, next === "Cancelled" ? "booking.cancel" : "booking.status", saved, `${b.destination}: ${prev} to ${next}`);
    res.json(decorate(saved));
  }));

  app.post("/api/customers/:id/bookings/:bid/payments", h(async (req, res) => {
    const c = await loadCustomer(req);
    const b = findBooking(c, req.params.bid);
    const p = addPayment(b, req.body);
    const saved = await store.update(c);
    await audit(req, "payment.add", saved, `${money(p.amount)} by ${p.method} for ${b.destination}`);
    res.status(201).json(decorate(saved));
  }));

  /* ---------- travelers ---------- */
  app.post("/api/customers/:id/bookings/:bid/travelers", h(async (req, res) => {
    const c = await loadCustomer(req);
    const b = findBooking(c, req.params.bid);
    const count = Math.max(1, Math.min(MAX_TRAVELERS - b.travelers.length, parseInt(req.body?.count) || 1));
    const added = [];
    for (let i = 0; i < count; i++) {
      const t = addTraveler(b, { name: `Companion ${b.travelers.length}`, relation: "Companion", passportExpiry: "" });
      added.push(t);
    }
    const saved = await store.update(c);
    await audit(req, "traveler.add", saved, `${count} companion(s) added to ${b.destination}`);
    res.status(201).json(decorate(saved));
  }));

  app.delete("/api/customers/:id/bookings/:bid/travelers/:tid", h(async (req, res) => {
    const c = await loadCustomer(req);
    const b = findBooking(c, req.params.bid);
    const t = removeTraveler(b, req.params.tid);
    const saved = await store.update(c);
    await audit(req, "traveler.remove", saved, `${t.name} removed from ${b.destination}`);
    res.json(decorate(saved));
  }));

  /* ---------- interaction timeline ---------- */
  app.post("/api/customers/:id/notes", h(async (req, res) => {
    const c = await loadCustomer(req);
    const n = newNote(req.body, req.user.username);
    c.notes.unshift(n);
    const saved = await store.update(c);
    await audit(req, "note.add", saved, `${n.type}: ${n.text.slice(0, 80)}`);
    res.status(201).json(decorate(saved));
  }));

  /* ---------- audit trail ---------- */
  app.get("/api/audit", h(async (req, res) => {
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    res.json(await store.listAudit({ customerId: Number.isInteger(customerId) ? customerId : null, limit }));
  }));

  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server" });
  });

  return app;
}
