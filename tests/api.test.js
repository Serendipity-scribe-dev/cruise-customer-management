import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { createMemoryStore } from "../server/store.js";

let server, base;

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test.before(async () => {
  server = createApp(createMemoryStore()).listen(0);
  base = `http://localhost:${server.address().port}`;
});
test.after(() => server.close());

test("allows requests without a token (no auth required)", async () => {
  assert.equal((await call("GET", "/api/customers")).status, 200);
});

test("lists customers with pagination and sorting", async () => {
  const r = await call("GET", "/api/customers?pageSize=5&sort=name&dir=asc");
  assert.equal(r.body.items.length, 5);
  assert.equal(r.body.pages, 3);
  const names = r.body.items.map((c) => c.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  const last = await call("GET", "/api/customers?pageSize=5&page=99");
  assert.equal(last.body.page, 3);
});

test("search and filters", async () => {
  assert.equal((await call("GET", "/api/customers?q=emily")).body.total, 1);
  const overdue = (await call("GET", "/api/customers?view=overdue")).body.items;
  assert.ok(overdue.length >= 1 && overdue.every((c) => c.summary.overdueCount > 0));
  const none = (await call("GET", "/api/customers?view=nobooking")).body.items;
  assert.ok(none.every((c) => c.bookings.length === 0));
});

test("validates input and blocks duplicate emails", async () => {
  assert.equal((await call("POST", "/api/customers", { name: "A", email: "bad" })).status, 400);
  const ok = await call("POST", "/api/customers", { name: "Test Guest", email: "Test.Guest@example.com" });
  assert.equal(ok.status, 201);
  const dup = await call("POST", "/api/customers", { name: "Other Person", email: "test.guest@EXAMPLE.com" });
  assert.equal(dup.status, 409);
});

test("booking lifecycle: price, deposit, payments, travelers, cancel", async () => {
  const { sailings } = (await call("GET", "/api/sailings")).body;
  const s = sailings[0];
  const c = (await call("POST", "/api/customers", { name: "Booking Tester", email: "bt@example.com" })).body;

  const created = await call("POST", `/api/customers/${c.id}/bookings`, {
    sailingId: s.id, cabin: "Balcony", deposit: 500, method: "UPI",
    extraCompanions: 1,
  });
  assert.equal(created.status, 201);
  let b = created.body.bookings[0];
  assert.equal(b.amount, s.prices.Balcony * 2);
  assert.equal(b.status, "Deposit Paid");
  assert.equal(b.paid, 500);

  assert.equal((await call("POST", `/api/customers/${c.id}/bookings/${b.id}/payments`, { amount: 99999999 })).status, 400);

  const rest = b.balance;
  const paid = await call("POST", `/api/customers/${c.id}/bookings/${b.id}/payments`, { amount: rest });
  b = paid.body.bookings[0];
  assert.equal(b.status, "Confirmed");
  assert.equal(b.balance, 0);

  const added = await call("POST", `/api/customers/${c.id}/bookings/${b.id}/travelers`, { count: 1 });
  b = added.body.bookings[0];
  assert.equal(b.amount, s.prices.Balcony * 3);
  assert.equal(b.status, "Deposit Paid"); // fare went up, so no longer fully paid

  const cancel = await call("PATCH", `/api/customers/${c.id}/bookings/${b.id}`, { status: "Cancelled" });
  assert.equal(cancel.body.bookings[0].status, "Cancelled");
  assert.equal(cancel.body.summary.next, null);
  assert.equal((await call("POST", `/api/customers/${c.id}/bookings/${b.id}/payments`, { amount: 10 })).status, 409);
});

test("flags passports that expire within 6 months of sailing", async () => {
  const { sailings } = (await call("GET", "/api/sailings")).body;
  const s = sailings[0];
  const d = new Date(s.date + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 2);
  const c = (await call("POST", "/api/customers", {
    name: "Passport Risk", email: "pr@example.com", passportExpiry: d.toISOString().slice(0, 10),
  })).body;
  const r = await call("POST", `/api/customers/${c.id}/bookings`, { sailingId: s.id, cabin: "Inside" });
  assert.equal(r.body.summary.passportAlerts, 1);
  assert.equal(r.body.bookings[0].passportIssues[0].name, "Passport Risk");
});

test("notes are stored newest first with the author", async () => {
  const c = (await call("GET", "/api/customers?q=emily")).body.items[0];
  const r = await call("POST", `/api/customers/${c.id}/notes`, { type: "Call", text: "Called about June" });
  assert.equal(r.body.notes[0].text, "Called about June");
  assert.equal(r.body.notes[0].by, "admin");
});

test("admins can delete customers", async () => {
  const c = (await call("POST", "/api/customers", { name: "To Delete", email: "del@example.com" })).body;
  assert.equal((await call("DELETE", `/api/customers/${c.id}`)).status, 204);
  assert.equal((await call("GET", `/api/customers/${c.id}`)).status, 404);
});

test("audit trail records who did what", async () => {
  const log = (await call("GET", "/api/audit?limit=100")).body;
  const actions = new Set(log.map((e) => e.action));
  for (const a of ["customer.create", "booking.create", "payment.add", "booking.cancel", "note.add", "customer.delete"]) {
    assert.ok(actions.has(a), `missing ${a}`);
  }
  assert.ok(log.every((e) => e.user && e.at));
  const noteEntry = log.find((e) => e.action === "note.add");
  assert.equal(noteEntry.user, "admin");
});
