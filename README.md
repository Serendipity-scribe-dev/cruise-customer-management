# ⚓ Cruise CRM

A customer relationship management system built for cruise booking agencies. Track customers, manage bookings across multiple sailings, record payments, and monitor passport compliance — all in one place.

---

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [How to Use](#how-to-use)
  - [Customers](#customers)
  - [Bookings](#bookings)
  - [Companions](#companions)
  - [Payments](#payments)
  - [Audit Log](#audit-log)
- [Project Structure](#project-structure)
- [Deployment (Vercel)](#deployment-vercel)
- [Environment Variables](#environment-variables)
- [Architecture & Design Decisions](#architecture--design-decisions)

---

## Features

| Area | What it does |
|------|-------------|
| **Customers** | Create, edit, delete (admin), search by name/email/phone, filter, sort, paginate. Duplicate emails are rejected. |
| **Bookings** | Multiple bookings per customer, each with ship, destination, cabin type, sailing date, and status tracking. |
| **Companions** | Add extra companions to a booking by count. The fare is per-person, so the total updates automatically. |
| **Payments** | Record deposits and instalments. Balance due, final-payment due date (75 days before sailing), overdue flag. Status moves automatically: first payment → Deposit Paid, fully paid → Confirmed. |
| **Passport Rule** | Lead guest and every companion must have a passport valid ≥ 6 months after sailing, otherwise the booking is flagged. |
| **Audit Log** | Every change records who did it, what, and when. Available as a global page. |
| **Dashboard Stats** | At-a-glance cards for total customers, upcoming sailings, balance outstanding, overdue payments, passport alerts, and total collected. |

---

## Prerequisites

- **Node.js** v18 or later (tested with v20+)
- **npm** (comes with Node.js)
- **PostgreSQL** *(optional)* — without it, the app uses an in-memory store seeded with demo data

---

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd cruise-crm
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

This starts **both** the API server (port 3001) and the Vite dev server (port 5173) in a single terminal.

### 4. Open the app

Go to **http://localhost:5173** in your browser.

> No login is required — the app loads directly into the dashboard with full admin access.

### 5. Run tests

```bash
npm test
```

Runs the API test suite using Node's built-in test runner (`node:test`).

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Starts API + frontend dev servers concurrently |
| `npm run dev:api` | Starts only the Express API server on port 3001 (with `--watch` for auto-reload) |
| `npm run dev:web` | Starts only the Vite frontend dev server on port 5173 |
| `npm run build` | Builds the production frontend bundle to `dist/` |
| `npm run preview` | Serves the production build locally for testing |
| `npm test` | Runs the API test suite |

---

## How to Use

### Customers

1. **View all customers** — The main page shows a sortable, paginated table with customer name, next sailing, balance due, and status badges.
2. **Search** — Type in the search bar to filter by name, email, or phone number.
3. **Filter** — Use the dropdown to show: All customers, Upcoming sailing, Payment overdue, Passport alert, or No bookings.
4. **Sort** — Click any column header (Customer, Next sailing, Balance due) to sort ascending/descending.
5. **Create a customer** — Click the **"+ New customer"** button. Fill in the name, email, phone, passport expiry, and preferences.
6. **View profile** — Click any row to open the customer's detail drawer on the right.
7. **Edit a customer** — In the profile drawer, click **"Edit details"** at the bottom.
8. **Delete a customer** — In the profile drawer, click **"Delete customer"** (this permanently removes the customer and all their bookings).

### Bookings

1. Open a customer's profile by clicking their row.
2. Click **"+ Add booking"** in the Bookings tab.
3. **Select a sailing** — Choose from available upcoming sailings (ship, destination, date, duration).
4. **Choose cabin type** — Inside, Ocean View, Balcony, or Suite. Prices are per person and vary by cabin.
5. **Add companions** — Enter the number of extra companions (0–7). The price summary updates in real-time.
6. **Record a deposit** *(optional)* — Enter the initial payment amount and method.
7. Click **"Add booking"** to save.

**Manage booking status:**
- Use the status dropdown on each booking card to change between: Pending Payment → Deposit Paid → Confirmed.
- Click **"Cancel booking"** to cancel (payments already recorded are kept on file).

### Companions

- When creating a booking, set the **"No. of extra companions"** field (0–7 additional passengers beyond the lead guest).
- To add more companions to an existing booking, click **"+ Companion"** on the booking card.
- Each companion adds the per-person fare to the total booking amount.
- Maximum 8 total passengers per booking (1 lead guest + 7 companions).

### Payments

1. On any open booking with a balance due, click **"Record payment"**.
2. Enter the amount received (or click **"Pay full balance"** to auto-fill).
3. Choose the payment method: Card, Bank transfer, UPI, or Cash.
4. Click **"Record payment"** to save.

**Automatic status updates:**
- First payment recorded → status changes to **Deposit Paid**
- Full amount paid → status changes to **Confirmed**

**Payment due dates:**
- Final payment is due **75 days before the sailing date**
- Overdue payments are highlighted with a warning

### Audit Log

- Click **"Audit log"** in the top navigation bar.
- View a chronological record of all actions: customer creation/updates/deletions, bookings, payments, companions added, and notes.
- Each entry shows the timestamp, who performed the action, what was done, the affected customer, and details.
- Click **"Refresh"** to reload the latest entries.

---

## Project Structure

```
cruise-crm/
├── api/
│   └── index.js              # Vercel serverless entry point
├── server/
│   ├── app.js                # Express routes, middleware, audit logging
│   ├── auth.js               # Token signing & verification (HMAC-SHA256)
│   ├── domain.js             # Business rules, validation, derived data (pure functions)
│   ├── sailings.js           # Sailing catalog with dynamic dates
│   ├── seed.js               # Demo data generator (dates relative to today)
│   └── store.js              # Data layer — in-memory + PostgreSQL, same interface
├── src/
│   ├── App.jsx               # Root component, top navigation
│   ├── Customers.jsx         # Customer list page with stats, search, filters, pagination
│   ├── Profile.jsx           # Customer detail drawer, booking cards, modals
│   ├── CustomerForm.jsx      # Create / edit customer modal
│   ├── Audit.jsx             # Global audit log page
│   ├── api.js                # Frontend API client (fetch wrapper)
│   ├── ui.jsx                # Shared UI components (Drawer, Modal, Badge)
│   ├── utils.js              # Date formatting, currency, helpers
│   ├── styles.css            # All styles
│   └── main.jsx              # React entry point
├── tests/
│   └── api.test.js           # API integration tests (node:test)
├── index.html                # Vite HTML entry
├── vite.config.js            # Vite config with API proxy
├── vercel.json               # Vercel routing config
├── package.json
└── .env.example              # Environment variable template
```

---

## Environment Variables
Copy `.env.example` to `.env` to get started.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string. When set, data is persisted across restarts. |

---

## Architecture & Design Decisions

- **JSONB document per customer** — Bookings, companions, payments, and notes are nested inside each customer document. This keeps the store interface tiny and writes atomic per customer. The trade-off: search, sort, and pagination run in Node after loading all rows, which is fine for thousands of customers but not millions. A relational schema with SQL-side filtering would be the next step.

- **Server owns the rules** — Prices, deposits, status changes, companion fare calculations, and passport checks are all computed and validated server-side. The client never sends totals or derived data.

- **Last write wins** — Concurrent edits to the same customer use a simple last-write-wins strategy. Fine for a small team; a version column would add optimistic concurrency for more users.



