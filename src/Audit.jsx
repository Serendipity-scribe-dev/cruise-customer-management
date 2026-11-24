import { useEffect, useState } from "react";
import { api } from "./api.js";
import { fmtDateTime } from "./utils.js";

export const ACTION_LABELS = {
  "auth.login": "Signed in",
  "customer.create": "Created customer",
  "customer.update": "Updated customer",
  "customer.delete": "Deleted customer",
  "booking.create": "Added booking",
  "booking.status": "Changed booking status",
  "booking.cancel": "Cancelled booking",
  "payment.add": "Recorded payment",
  "traveler.add": "Added traveler",
  "traveler.remove": "Removed traveler",
  "note.add": "Added note",
};

export default function Audit() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  const load = () => api("/api/audit?limit=100").then((r) => { setRows(r); setError(""); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="page-head">
        <h1>Audit log</h1>
        <button className="btn" onClick={load}>Refresh</button>
      </div>
      <section className="card">
        {error && <div className="error">{error}</div>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Customer</th><th>Details</th></tr></thead>
            <tbody>
              {!rows && <tr><td colSpan="5" className="muted center">Loading…</td></tr>}
              {rows?.length === 0 && <tr><td colSpan="5" className="empty">Nothing recorded yet. Changes to customers will show up here.</td></tr>}
              {rows?.map((e) => (
                <tr key={e.id} className="static">
                  <td className="nowrap">{fmtDateTime(e.at)}</td>
                  <td>{e.user}</td>
                  <td>{ACTION_LABELS[e.action] || e.action}</td>
                  <td>{e.customerName || "—"}</td>
                  <td className="muted">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
