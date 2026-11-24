import { randomUUID } from "node:crypto";
import { addDays } from "./domain.js";

// All dates are relative to today so the demo always looks current.
const t = () => new Date().toISOString().slice(0, 10);
const d = (n) => addDays(t(), n);
const ago = (n) => new Date(Date.now() - n * 864e5).toISOString();

const trav = (name, relation, exp) => ({ id: randomUUID(), name, relation, passportExpiry: exp ? d(exp) : "" });
const note = (type, text, by, daysAgo) => ({ id: randomUUID(), type, text, by, at: ago(daysAgo) });

function bk(ship, destination, nights, offset, cabin, amount, paid, status, travelers = []) {
  const pax = 1 + travelers.length;
  return {
    id: randomUUID(), sailingId: null, ship, destination, nights, date: d(offset), cabin,
    pricePerPerson: amount / pax, amount, status, travelers,
    payments: paid ? [{ id: randomUUID(), amount: paid, method: "Card", date: d(Math.min(-3, offset - 120)) }] : [],
    dueDate: d(offset - 75),
    createdAt: ago(Math.max(10, 120 - offset)),
  };
}
const cust = (name, email, phone, passport, preferences, created, bookings = [], notes = []) => ({
  name, email, phone, passportExpiry: d(passport), preferences, createdAt: ago(created), bookings, notes,
});

export function buildSeed() {
  return [
    cust("Emily Carter", "emily.carter@example.com", "+1 305 555 0141", 1200, "Balcony cabins. Celebrates an anniversary cruise every June.", 700, [
      bk("Symphony of the Seas", "Western Caribbean", 7, -540, "Balcony", 8400, 8400, "Completed", [trav("James Carter", "Spouse", 900)]),
      bk("Icon of the Seas", "Eastern Caribbean", 7, 200, "Suite", 9880, 2500, "Deposit Paid", [trav("James Carter", "Spouse", 900)]),
    ], [note("Call", "Wants a suite for the next anniversary sailing. Asked about dining packages.", "agent", 12)]),

    cust("Rajesh Menon", "rajesh.menon@example.com", "+91 98450 12345", 300, "Vegetarian meals. Travels with parents, wheelchair access needed.", 90, [
      bk("Celebrity Edge", "Greek Isles", 10, 160, "Ocean View", 9000, 3000, "Deposit Paid", [trav("Suresh Menon", "Father", 900), trav("Lata Menon", "Mother", 700)]),
    ], [note("Email", "Sent accessible-cabin options. Waiting for passport copies for his mother.", "agent", 4)]),

    cust("Sofia Rossi", "sofia.rossi@example.com", "+39 333 555 0192", 1800, "Honeymooners. Interested in Alaska next.", 400, [
      bk("MSC Seascape", "Mediterranean", 8, -120, "Balcony", 6600, 6600, "Completed", [trav("Marco Rossi", "Spouse", 1500)]),
    ], [note("Meeting", "Showed Alaska brochures at the travel fair. Follow up in January.", "admin", 30)]),

    cust("Daniel Okafor", "d.okafor@example.com", "+44 7700 900123", 150, "First-time cruiser. Budget conscious.", 45, [
      bk("Norwegian Bliss", "Alaska", 7, 130, "Inside", 1800, 0, "Pending Payment"),
    ], [note("Call", "Nervous about seasickness. Explained cabin location tips.", "agent", 6)]),

    cust("Aiko Tanaka", "aiko.tanaka@example.com", "+81 90 5555 0177", 2000, "Solo traveller. Loves photography excursions.", 600, [
      bk("Viking Neptune", "Norwegian Fjords", 9, -500, "Veranda", 6900, 6900, "Completed"),
      bk("Viking Venus", "Baltic", 12, 190, "Veranda", 7300, 7300, "Confirmed"),
    ]),

    cust("Lucas Müller", "lucas.muller@example.com", "+49 151 5555 0166", 900, "Family of four. Needs connecting cabins.", 80, [
      bk("Disney Wish", "Bahamas", 4, 70, "Balcony", 7680, 1500, "Deposit Paid", [trav("Anna Müller", "Spouse", 800), trav("Felix Müller", "Child", 1200), trav("Mia Müller", "Child", 1200)]),
    ], [note("Call", "Final payment reminder sent. Said the transfer would go out this week.", "agent", 2)]),

    cust("Priya Nair", "priya.nair@example.com", "+91 99620 55012", 2400, "Honeymoon. Wants a private dinner on board.", 60, [
      bk("Norwegian Bliss", "Alaska", 7, 150, "Balcony", 5760, 5760, "Confirmed", [trav("Arjun Nair", "Spouse", 2300)]),
    ]),

    cust("Marcus Johnson", "marcus.j@example.com", "+1 212 555 0188", 1500, "Interested in transatlantic crossings.", 8, [], [
      note("Email", "Enquired about Queen Mary 2. Sent brochure and fares.", "agent", 8),
    ]),

    cust("Chloe Dubois", "chloe.dubois@example.com", "+33 6 55 55 01 44", 1000, "Prefers small ships. Usually books in spring.", 300, [
      bk("MSC Seascape", "Mediterranean", 8, 90, "Ocean View", 3300, 500, "Cancelled", [trav("Hugo Dubois", "Partner", 1000)]),
      bk("Queen Mary 2", "Transatlantic", 7, 340, "Inside", 4400, 0, "Pending Payment", [trav("Hugo Dubois", "Partner", 1000)]),
    ], [note("Call", "Cancelled the Med sailing (work conflict). Rebooked for the crossing.", "admin", 20)]),

    cust("Hannah Schmidt", "hannah.schmidt@example.com", "+49 170 5555 0123", 1700, "Loyal repeat guest. Prefers Celebrity and Viking.", 1200, [
      bk("Celebrity Apex", "Greek Isles", 10, -900, "Suite", 6200, 6200, "Completed"),
      bk("Viking Sky", "Norwegian Fjords", 9, -400, "Veranda", 5800, 5800, "Completed"),
    ], [note("Note", "No upcoming sailing. Good candidate for a rebooking offer.", "admin", 15)]),

    cust("Omar Haddad", "omar.haddad@example.com", "+971 50 555 0166", 1100, "Suites only. Halal meals.", 150, [
      bk("MSC Seascape", "Mediterranean", 8, 80, "Suite", 8580, 4290, "Deposit Paid", [trav("Leila Haddad", "Spouse", 1100)]),
    ]),

    cust("Grace Kim", "grace.kim@example.com", "+82 10 5555 0199", 2200, "Prefers quiet cabins away from lifts.", 25, [
      bk("Icon of the Seas", "Eastern Caribbean", 7, 230, "Ocean View", 2375, 0, "Pending Payment"),
    ]),
  ];
}
