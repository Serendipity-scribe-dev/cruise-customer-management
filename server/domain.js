import { randomUUID } from "node:crypto";
import { getSailings, CABINS } from "./sailings.js";

export const STATUSES = ["Pending Payment", "Deposit Paid", "Confirmed", "Completed", "Cancelled"];
export const ACTIVE = ["Pending Payment", "Deposit Paid", "Confirmed"];
export const NOTE_TYPES = ["Note", "Call", "Email", "Meeting"];
export const METHODS = ["Card", "Bank transfer", "UPI", "Cash"];

// Business rules
export const FINAL_PAYMENT_DAYS = 75; // final payment is due 75 days before sailing
export const PASSPORT_MONTHS = 6; // passport must be valid 6 months after sailing
export const MAX_TRAVELERS = 7; // plus the lead guest = 8 passengers

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);

/* ---------- dates & numbers ---------- */
export const today = () => new Date().toISOString().slice(0, 10);
const utc = (iso) => new Date(iso + "T00:00:00Z");
export const addDays = (iso, n) => new Date(utc(iso).getTime() + n * 864e5).toISOString().slice(0, 10);
export const addMonths = (iso, n) => {
  const d = utc(iso);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const round2 = (n) => Math.round(n * 100) / 100;
const sum = (list) => round2(list.reduce((s, n) => s + n, 0));
export const paidOf = (b) => sum(b.payments.map((p) => p.amount));
const str = (v) => (typeof v === "string" ? v.trim() : "");

/* ---------- input parsing / validation ---------- */
export function parseCustomer(b = {}) {
  const c = {
    name: str(b.name),
    email: str(b.email).toLowerCase(),
    phone: str(b.phone),
    passportExpiry: str(b.passportExpiry),
    preferences: str(b.preferences),
  };
  if (c.name.length < 2 || c.name.length > 100) throw bad("Name must be 2 to 100 characters");
  if (!/^\S+@\S+\.\S+$/.test(c.email) || c.email.length > 120) throw bad("Enter a valid email address");
  if (c.phone && !/^[+\d][\d\s()-]{5,19}$/.test(c.phone)) throw bad("Enter a valid phone number");
  if (c.passportExpiry && !isDate(c.passportExpiry)) throw bad("Enter a valid passport expiry date");
  if (c.preferences.length > 500) throw bad("Preferences must be under 500 characters");
  return c;
}

export function newTraveler(b = {}) {
  const t = {
    id: randomUUID(),
    name: str(b.name),
    relation: str(b.relation) || "Companion",
    passportExpiry: str(b.passportExpiry),
  };
  if (t.name.length < 2 || t.name.length > 100) throw bad("Traveler name must be 2 to 100 characters");
  if (t.relation.length > 40) throw bad("Relation must be under 40 characters");
  if (t.passportExpiry && !isDate(t.passportExpiry)) throw bad("Enter a valid traveler passport expiry date");
  return t;
}

export function newNote(b = {}, user) {
  const type = NOTE_TYPES.includes(b.type) ? b.type : "Note";
  const text = str(b.text);
  if (!text) throw bad("Write something before saving");
  if (text.length > 1000) throw bad("Notes must be under 1000 characters");
  return { id: randomUUID(), type, text, by: user, at: new Date().toISOString() };
}

/* ---------- bookings & payments ---------- */
export function newBooking(body = {}) {
  const sailing = getSailings().find((s) => s.id === body.sailingId);
  if (!sailing) throw bad("Choose a sailing");
  if (!CABINS.includes(body.cabin)) throw bad("Choose a cabin type");
  const travelers = [];
  const extraCompanions = Math.max(0, Math.min(MAX_TRAVELERS, parseInt(body.extraCompanions) || 0));
  for (let i = 0; i < extraCompanions; i++) {
    travelers.push({ id: randomUUID(), name: `Companion ${i + 1}`, relation: "Companion", passportExpiry: "" });
  }
  if (travelers.length > MAX_TRAVELERS) throw bad(`A booking supports up to ${MAX_TRAVELERS + 1} passengers`);

  const pricePerPerson = sailing.prices[body.cabin];
  const amount = pricePerPerson * (1 + travelers.length);
  const deposit = body.deposit === "" || body.deposit == null ? 0 : round2(Number(body.deposit));
  if (!Number.isFinite(deposit) || deposit < 0 || deposit > amount) {
    throw bad("Deposit must be between 0 and the total fare");
  }

  const due = addDays(sailing.date, -FINAL_PAYMENT_DAYS);
  const earliest = addDays(today(), 7); // bookings inside the final-payment window are due within a week
  const booking = {
    id: randomUUID(),
    sailingId: sailing.id,
    ship: sailing.ship,
    destination: sailing.destination,
    nights: sailing.nights,
    date: sailing.date,
    cabin: body.cabin,
    pricePerPerson,
    amount,
    status: "Pending Payment",
    travelers,
    payments: [],
    dueDate: due > earliest ? due : earliest,
    createdAt: new Date().toISOString(),
  };
  if (deposit > 0) addPayment(booking, { amount: deposit, method: body.method });
  return booking;
}

export function assertOpen(b) {
  if (!ACTIVE.includes(b.status)) throw new HttpError(409, `This booking is ${b.status.toLowerCase()} and can't be changed`);
}

export function addPayment(b, body = {}) {
  assertOpen(b);
  const amount = round2(Number(body.amount));
  const balance = round2(b.amount - paidOf(b));
  const method = body.method == null || body.method === "" ? "Card" : body.method;
  if (!METHODS.includes(method)) throw bad("Choose a payment method");
  if (!Number.isFinite(amount) || amount <= 0) throw bad("Payment amount must be greater than 0");
  if (amount > balance) throw bad(`Payment is more than the balance due ($${balance.toLocaleString("en-US")})`);
  const payment = { id: randomUUID(), amount, method, date: today() };
  b.payments.push(payment);
  reconcile(b);
  return payment;
}

// Keeps status in step with money: first payment -> Deposit Paid, fully paid -> Confirmed
export function reconcile(b, { fareChanged = false } = {}) {
  if (!ACTIVE.includes(b.status)) return;
  const paid = paidOf(b);
  const balance = round2(b.amount - paid);
  if (balance <= 0 && paid > 0) b.status = "Confirmed";
  else if (fareChanged && b.status === "Confirmed") b.status = paid > 0 ? "Deposit Paid" : "Pending Payment";
  else if (paid > 0 && b.status === "Pending Payment") b.status = "Deposit Paid";
}

export function addTraveler(b, body) {
  assertOpen(b);
  if (b.travelers.length >= MAX_TRAVELERS) throw bad(`A booking supports up to ${MAX_TRAVELERS + 1} passengers`);
  const t = newTraveler(body);
  b.travelers.push(t);
  b.amount = b.pricePerPerson * (1 + b.travelers.length);
  reconcile(b, { fareChanged: true });
  return t;
}

export function removeTraveler(b, travelerId) {
  assertOpen(b);
  const i = b.travelers.findIndex((t) => t.id === travelerId);
  if (i < 0) throw new HttpError(404, "Traveler not found");
  const newAmount = b.pricePerPerson * b.travelers.length; // one fewer passenger
  if (paidOf(b) > newAmount) throw new HttpError(409, "Payments already exceed the new fare. Handle the refund first");
  const [removed] = b.travelers.splice(i, 1);
  b.amount = newAmount;
  reconcile(b, { fareChanged: true });
  return removed;
}

/* ---------- derived data ---------- */
export function passportIssues(customer, booking) {
  const limit = addMonths(booking.date, PASSPORT_MONTHS);
  return [{ name: customer.name, passportExpiry: customer.passportExpiry }, ...booking.travelers]
    .filter((p) => p.passportExpiry && p.passportExpiry < limit)
    .map((p) => ({ name: p.name, passportExpiry: p.passportExpiry }));
}

export function decorate(c) {
  const t = today();
  const bookings = c.bookings
    .map((b) => {
      const open = ACTIVE.includes(b.status);
      const paid = paidOf(b);
      const balance = round2(b.amount - paid);
      return {
        ...b,
        paid,
        balance,
        overdue: open && balance > 0 && b.dueDate < t,
        passportIssues: open && b.date >= t ? passportIssues(c, b) : [],
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const open = bookings.filter((b) => ACTIVE.includes(b.status));
  const upcoming = open.filter((b) => b.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  return {
    ...c,
    bookings,
    summary: {
      next: upcoming[0] || null,
      balanceDue: sum(open.map((b) => b.balance)),
      overdueCount: open.filter((b) => b.overdue).length,
      passportAlerts: upcoming.filter((b) => b.passportIssues.length).length,
      collected: sum(bookings.filter((b) => b.status !== "Cancelled").map((b) => b.paid)),
      tripsCompleted: bookings.filter((b) => b.status === "Completed").length,
    },
  };
}

/* ---------- list query: search, filter, sort, paginate ---------- */
export const VIEWS = ["all", "upcoming", "overdue", "passport", "nobooking"];

export function computeStats(rows) {
  return {
    customers: rows.length,
    upcoming: rows.filter((c) => c.summary.next).length,
    outstanding: sum(rows.map((c) => c.summary.balanceDue)),
    overdue: rows.filter((c) => c.summary.overdueCount > 0).length,
    passportAlerts: rows.filter((c) => c.summary.passportAlerts > 0).length,
    collected: sum(rows.map((c) => c.summary.collected)),
  };
}

export function queryCustomers(customers, q = {}) {
  const all = customers.map(decorate);
  const term = String(q.q || "").toLowerCase().trim();
  let rows = all;
  if (term) rows = rows.filter((c) => [c.name, c.email, c.phone].some((v) => (v || "").toLowerCase().includes(term)));

  const view = {
    upcoming: (c) => c.summary.next,
    overdue: (c) => c.summary.overdueCount > 0,
    passport: (c) => c.summary.passportAlerts > 0,
    nobooking: (c) => c.bookings.length === 0,
  }[q.view];
  if (view) rows = rows.filter(view);

  const dir = q.dir === "desc" ? -1 : 1;
  const keys = {
    name: (c) => c.name.toLowerCase(),
    sailing: (c) => c.summary.next?.date ?? (dir === 1 ? "9999-12-31" : ""), // no sailing always sorts last
    balance: (c) => c.summary.balanceDue,
    created: (c) => c.createdAt,
  };
  const get = keys[q.sort] || keys.name;
  rows = [...rows].sort((a, b) => {
  const x = get(a), y = get(b);

  if (q.sort === "created") {
    return (x < y ? -1 : x > y ? 1 : 0) * dir || (b.id - a.id);
  }

  return (x < y ? -1 : x > y ? 1 : 0) * dir || a.name.localeCompare(b.name);
});
  const pageSize = Math.min(50, Math.max(1, parseInt(q.pageSize, 10) || 8));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pages, Math.max(1, parseInt(q.page, 10) || 1));
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pages,
    pageSize,
    stats: computeStats(all),
  };
}
