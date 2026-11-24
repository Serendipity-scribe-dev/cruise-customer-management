import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { Badge, Drawer, Modal } from "./ui.jsx";
import { daysFromNow, fmtDate, initials, money, statusClass } from "./utils.js";
import CustomerForm from "./CustomerForm.jsx";

const OPEN = ["Pending Payment", "Deposit Paid", "Confirmed"];

export default function Profile({ id, user, meta, onClose, onChanged, onDeleted }) {
  const [c, setC] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("bookings");
  const [modal, setModal] = useState(null); // {type, booking?}

  useEffect(() => {
    api(`/api/customers/${id}`).then(setC).catch((e) => setError(e.message));
  }, [id]);

  // Sends a change, shows the fresh customer and tells the list to refresh. Throws on failure.
  const mutate = useCallback(async (path, opts) => {
    const next = await api(`/api/customers/${id}${path}`, opts);
    setC(next);
    onChanged();
    return next;
  }, [id, onChanged]);

  // For buttons that have no modal to show an error in
  const run = async (fn) => {
    try { setError(""); await fn(); } catch (e) { setError(e.message); }
  };

  async function remove() {
    if (!confirm(`Delete ${c.name} and all their bookings? This can't be undone.`)) return;
    run(async () => { await api(`/api/customers/${id}`, { method: "DELETE" }); onDeleted(); });
  }

  return (
    <Drawer onClose={onClose}>
      {!c ? (
        <p className={error ? "error flush" : "muted"}>{error || "Loading…"}</p>
      ) : (
        <>
          <div className="drawer-head">
            <div className="avatar lg">{initials(c.name)}</div>
            <div>
              <h2>{c.name}</h2>
              <div className="muted small">{c.email}{c.phone && ` · ${c.phone}`}</div>
            </div>
          </div>

          <div className="chips">
            <div><span className="muted small">Paid to date</span><strong>{money(c.summary.collected)}</strong></div>
            <div><span className="muted small">Balance due</span><strong className={c.summary.overdueCount ? "text-warn" : ""}>{money(c.summary.balanceDue)}</strong></div>
            <div><span className="muted small">Trips completed</span><strong>{c.summary.tripsCompleted}</strong></div>
          </div>

          <dl className="details">
            <dt>Passport expiry</dt><dd>{fmtDate(c.passportExpiry)}</dd>
            <dt>Preferences</dt><dd>{c.preferences || "—"}</dd>
          </dl>

          {error && <div className="error flush">{error}</div>}

          <div className="tabs" role="tablist">
            <button role="tab" className={tab === "bookings" ? "active" : ""} onClick={() => setTab("bookings")}>Bookings ({c.bookings.length})</button>
          </div>

          {tab === "bookings" && (
            <>
              <div className="between mb">
                <span className="muted small">Final payment is due 75 days before sailing.</span>
                <button className="btn primary sm" onClick={() => setModal({ type: "booking" })}>+ Add booking</button>
              </div>
              {c.bookings.length === 0 && <p className="empty-box">No bookings yet. Add the first one to start tracking payments and travelers.</p>}
              {c.bookings.map((b) => (
                <BookingCard
                  key={b.id}
                  b={b}
                  lead={c.name}
                  meta={meta}
                  onStatus={(status) => run(() => mutate(`/bookings/${b.id}`, { method: "PATCH", body: { status } }))}
                  onCancel={() => confirm(`Cancel the ${b.destination} booking? Payments already taken are kept on record.`) &&
                    run(() => mutate(`/bookings/${b.id}`, { method: "PATCH", body: { status: "Cancelled" } }))}
                  onPay={() => setModal({ type: "payment", booking: b })}
                  onAddTraveler={() => setModal({ type: "traveler", booking: b })}
                />
              ))}
            </>
          )}

          <div className="actions">
            <button className="btn" onClick={() => setModal({ type: "edit" })}>Edit details</button>
            {user.role === "admin" && <button className="btn danger" onClick={remove}>Delete customer</button>}
          </div>

          {modal?.type === "booking" && (
            <BookingModal
              meta={meta}
              onClose={() => setModal(null)}
              onSubmit={async (body) => { await mutate("/bookings", { method: "POST", body }); setModal(null); setTab("bookings"); }}
            />
          )}
          {modal?.type === "payment" && (
            <PaymentModal
              booking={modal.booking}
              meta={meta}
              onClose={() => setModal(null)}
              onSubmit={async (body) => { await mutate(`/bookings/${modal.booking.id}/payments`, { method: "POST", body }); setModal(null); }}
            />
          )}
          {modal?.type === "traveler" && (
            <TravelerModal
              booking={modal.booking}
              onClose={() => setModal(null)}
              onSubmit={async (body) => { await mutate(`/bookings/${modal.booking.id}/travelers`, { method: "POST", body }); setModal(null); }}
            />
          )}
          {modal?.type === "edit" && (
            <CustomerForm
              initial={c}
              onClose={() => setModal(null)}
              onSaved={(next) => { setC(next); onChanged(); setModal(null); }}
            />
          )}
        </>
      )}
    </Drawer>
  );
}

/* ---------------- bookings ---------------- */

function BookingCard({ b, lead, meta, onStatus, onCancel, onPay, onAddTraveler }) {
  const open = OPEN.includes(b.status);
  const pct = b.amount ? Math.min(100, Math.round((b.paid / b.amount) * 100)) : 0;
  const days = daysFromNow(b.date);

  return (
    <div className={`booking ${b.status === "Cancelled" ? "dim" : ""}`}>
      <div className="between top">
        <div>
          <strong>{b.destination}</strong>
          <div className="muted small">{b.ship} · {b.nights} nights · {b.cabin}</div>
        </div>
        {open ? (
          <select className={`status-select ${statusClass(b.status)}`} value={b.status} onChange={(e) => onStatus(e.target.value)} aria-label="Booking status">
            {meta.statuses.filter((s) => s !== "Cancelled").map((s) => <option key={s}>{s}</option>)}
          </select>
        ) : (
          <Badge className={statusClass(b.status)}>{b.status}</Badge>
        )}
      </div>

      <div className="small">
        Sails {fmtDate(b.date)}
        {open && days >= 0 && <span className="muted"> · in {days} days</span>}
      </div>

      {b.passportIssues.length > 0 && (
        <div className="alert">
          Passport check: {b.passportIssues.map((p) => `${p.name} (expires ${fmtDate(p.passportExpiry)})`).join(", ")} must be valid for 6 months after sailing.
        </div>
      )}

      <div className="pay">
        <div className="bar" aria-hidden="true"><div style={{ width: pct + "%" }} /></div>
        <div className="between small">
          <span>{money(b.paid)} of {money(b.amount)} paid</span>
          <strong>{b.balance > 0 ? `${money(b.balance)} due` : b.status === "Cancelled" ? "" : "Paid in full"}</strong>
        </div>
        {open && b.balance > 0 && (
          <div className={`small ${b.overdue ? "text-warn" : "muted"}`}>
            {b.overdue ? `Overdue since ${fmtDate(b.dueDate)}` : `Final payment due ${fmtDate(b.dueDate)}`}
          </div>
        )}
      </div>

      <div className="pax">
        <div className="small muted">Passengers ({1 + b.travelers.length})</div>
        <div className="pax-row small"><span>{lead}</span><span className="muted">Lead guest</span></div>
        {b.travelers.length > 0 && (
          <div className="pax-row small"><span>{b.travelers.length} extra companion{b.travelers.length > 1 ? "s" : ""}</span></div>
        )}
      </div>

      {b.payments.length > 0 && (
        <details className="payments small">
          <summary>Payment history ({b.payments.length})</summary>
          {b.payments.map((p) => (
            <div className="pax-row" key={p.id}><span>{fmtDate(p.date)} · {p.method}</span><strong>{money(p.amount)}</strong></div>
          ))}
        </details>
      )}

      {open && (
        <div className="card-actions">
          {b.balance > 0 && <button className="btn sm" onClick={onPay}>Record payment</button>}
          <button className="btn sm" onClick={onAddTraveler}>+ Companion</button>
          <button className="btn sm danger" onClick={onCancel}>Cancel booking</button>
        </div>
      )}
    </div>
  );
}

function useSubmit(onSubmit) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    try { setBusy(true); setErr(""); await onSubmit(); } catch (ex) { setErr(ex.message); setBusy(false); }
  };
  return { err, busy, submit };
}

function BookingModal({ meta, onClose, onSubmit }) {
  const [f, setF] = useState({ sailingId: "", cabin: "Balcony", deposit: "", method: "Card", extraCompanions: 0 });
  const sailing = meta.sailings.find((s) => s.id === f.sailingId);
  const perPerson = sailing?.prices[f.cabin] || 0;
  const total = perPerson * (1 + f.extraCompanions);
  const deposit = Number(f.deposit) || 0;
  const { err, busy, submit } = useSubmit(() => onSubmit({ ...f }));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title="Add booking" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {err && <div className="error flush">{err}</div>}
        <label>Sailing
          <select className="input" value={f.sailingId} onChange={set("sailingId")} required>
            <option value="">Choose a sailing</option>
            {meta.sailings.map((s) => (
              <option key={s.id} value={s.id}>{s.destination} · {s.ship} · {fmtDate(s.date)} · {s.nights} nights</option>
            ))}
          </select>
        </label>
        <label>Cabin
          <select className="input" value={f.cabin} onChange={set("cabin")}>
            {meta.cabins.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>

        <label>No. of extra companions
          <input className="input" type="number" min="0" max="7" step="1" value={f.extraCompanions} onChange={(e) => setF({ ...f, extraCompanions: Math.max(0, Math.min(7, parseInt(e.target.value) || 0)) })} />
        </label>

        <div className="row">
          <label>Deposit taken now (optional)
            <input className="input" type="number" min="0" max={total || undefined} step="1" value={f.deposit} onChange={set("deposit")} placeholder="0" />
          </label>
          <label>Payment method
            <select className="input" value={f.method} onChange={set("method")}>
              {meta.methods.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
        </div>

        {sailing && (
          <div className="summary-box">
            <div className="between"><span>{money(perPerson)} × {1 + f.extraCompanions} {f.extraCompanions ? "passengers" : "passenger"}</span><strong>{money(total)}</strong></div>
            <div className="between muted small"><span>Balance after deposit</span><span>{money(Math.max(0, total - deposit))}</span></div>
          </div>
        )}

        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Add booking"}</button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentModal({ booking, meta, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Card");
  const { err, busy, submit } = useSubmit(() => onSubmit({ amount, method }));
  return (
    <Modal title="Record payment" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {err && <div className="error flush">{err}</div>}
        <div className="summary-box">
          <div className="between"><span>{booking.destination}</span><span className="muted small">{booking.ship}</span></div>
          <div className="between"><span>Balance due</span><strong>{money(booking.balance)}</strong></div>
        </div>
        <label>Amount received
          <input className="input" type="number" min="0.01" max={booking.balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </label>
        <button type="button" className="link left" onClick={() => setAmount(String(booking.balance))}>Pay full balance ({money(booking.balance)})</button>
        <label>Method
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {meta.methods.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Record payment"}</button>
        </div>
      </form>
    </Modal>
  );
}

function TravelerModal({ booking, onClose, onSubmit }) {
  const [count, setCount] = useState(1);
  const { err, busy, submit } = useSubmit(() => onSubmit({ count }));
  return (
    <Modal title="Add companions" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {err && <div className="error flush">{err}</div>}
        <p className="muted small">Each extra companion adds {money(booking.pricePerPerson)} ({booking.cabin}) to the fare.</p>
        <label>No. of extra companions
          <input className="input" type="number" min="1" max={7 - booking.travelers.length} step="1" value={count} onChange={(e) => setCount(Math.max(1, Math.min(7 - booking.travelers.length, parseInt(e.target.value) || 1)))} autoFocus />
        </label>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Add companions"}</button>
        </div>
      </form>
    </Modal>
  );
}


