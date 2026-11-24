import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { Badge } from "./ui.jsx";
import { fmtDate, initials, money, statusClass } from "./utils.js";
import CustomerForm from "./CustomerForm.jsx";
import Profile from "./Profile.jsx";

const VIEWS = [
  ["all", "All customers"],
  ["upcoming", "Upcoming sailing"],
  ["overdue", "Payment overdue"],
  ["passport", "Passport alert"],
  ["nobooking", "No bookings"],
];

export default function Customers({ user }) {
  const [params, setParams] = useState({ q: "", view: "all", sort: "created", dir: "desc", page: 1 });
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const seq = useRef(0);

  useEffect(() => { api("/api/sailings").then(setMeta).catch((e) => setError(e.message)); }, []);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      setLoading(true);
      const res = await api(`/api/customers?${new URLSearchParams({ ...params, pageSize: 8 })}`);
      if (mine === seq.current) { setData(res); setError(""); }
    } catch (e) {
      if (mine === seq.current) setError(e.message);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    const t = setTimeout(load, params.q ? 250 : 0); // debounce typing only
    return () => clearTimeout(t);
  }, [load, params.q]);

  const patch = (p) => setParams((prev) => ({ ...prev, page: 1, ...p }));
  const sortBy = (key) => patch({ sort: key, dir: params.sort === key && params.dir === "asc" ? "desc" : "asc" });
  const arrow = (key) => (params.sort === key ? (params.dir === "asc" ? " ↑" : " ↓") : "");
  const stats = data?.stats;
  const items = data?.items || [];
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.pageSize) : 0;

  return (
    <>
      <div className="page-head">
        <h1>Customers</h1>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New customer</button>
      </div>

      <section className="stats">
        <Stat label="Customers" value={stats?.customers} />
        <Stat label="Upcoming sailings" value={stats?.upcoming} onClick={() => patch({ view: "upcoming" })} />
        <Stat label="Balance outstanding" value={stats && money(stats.outstanding)} />
        <Stat label="Payments overdue" value={stats?.overdue} warn={stats?.overdue > 0} onClick={() => patch({ view: "overdue" })} />
        <Stat label="Passport alerts" value={stats?.passportAlerts} warn={stats?.passportAlerts > 0} onClick={() => patch({ view: "passport" })} />
        <Stat label="Collected" value={stats && money(stats.collected)} />
      </section>

      <section className="card">
        <div className="toolbar">
          <input
            className="input"
            placeholder="Search by name, email or phone"
            aria-label="Search customers"
            value={params.q}
            onChange={(e) => patch({ q: e.target.value })}
          />
          <select className="input select" aria-label="Filter" value={params.view} onChange={(e) => patch({ view: e.target.value })}>
            {VIEWS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="table-wrap">
          <table className={loading ? "is-loading" : ""}>
            <thead>
              <tr>
                <th><button className="th-btn" onClick={() => sortBy("name")}>Customer{arrow("name")}</button></th>
                <th><button className="th-btn" onClick={() => sortBy("sailing")}>Next sailing{arrow("sailing")}</button></th>
                <th><button className="th-btn" onClick={() => sortBy("balance")}>Balance due{arrow("balance")}</button></th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!data && loading && <tr><td colSpan="5" className="muted center">Loading…</td></tr>}
              {data && items.length === 0 && (
                <tr><td colSpan="5" className="empty">
                  No customers match these filters.{" "}
                  <button className="link" onClick={() => patch({ q: "", view: "all" })}>Clear filters</button>
                </td></tr>
              )}
              {items.map((c) => {
                const nb = c.summary.next;
                return (
                  <tr key={c.id} tabIndex={0} onClick={() => setSelectedId(c.id)} onKeyDown={(e) => e.key === "Enter" && setSelectedId(c.id)}>
                    <td>
                      <div className="person">
                        <div className="avatar">{initials(c.name)}</div>
                        <div>
                          <div className="name">{c.name}</div>
                          <div className="muted small">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {nb ? (<><div>{nb.destination}</div><div className="muted small">{fmtDate(nb.date)} · {nb.ship}</div></>) : <span className="muted">None booked</span>}
                    </td>
                    <td>
                      {c.summary.balanceDue > 0
                        ? <strong>{money(c.summary.balanceDue)}</strong>
                        : <span className="muted">{nb ? "Paid in full" : "—"}</span>}
                    </td>
                    <td>
                      <div className="status-stack">
                        {nb && <Badge className={statusClass(nb.status)}>{nb.status}</Badge>}
                        {c.summary.overdueCount > 0 && <Badge className="warn">Payment overdue</Badge>}
                        {c.summary.passportAlerts > 0 && <Badge className="warn">Passport check</Badge>}
                        {!nb && c.summary.overdueCount === 0 && <span className="muted">—</span>}
                      </div>
                    </td>
                    <td className="right muted">›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="pager">
            <span className="muted small">Showing {from}–{to} of {data.total}</span>
            <div className="pager-btns">
              <button className="btn sm" disabled={data.page <= 1} onClick={() => setParams({ ...params, page: data.page - 1 })}>Previous</button>
              <span className="small">Page {data.page} of {data.pages}</span>
              <button className="btn sm" disabled={data.page >= data.pages} onClick={() => setParams({ ...params, page: data.page + 1 })}>Next</button>
            </div>
          </div>
        )}
      </section>

      {selectedId && meta && (
        <Profile
          id={selectedId}
          user={user}
          meta={meta}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onDeleted={() => { setSelectedId(null); load(); }}
        />
      )}

      {creating && (
        <CustomerForm
          onClose={() => setCreating(false)}
          onSaved={(c) => { setCreating(false); setSelectedId(c.id); load(); }}
        />
      )}
    </>
  );
}

function Stat({ label, value, warn, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`card stat ${warn ? "stat-warn" : ""} ${onClick ? "clickable" : ""}`} onClick={onClick}>
      <div className="muted small">{label}</div>
      <div className="stat-value">{value ?? "…"}</div>
    </Tag>
  );
}
