import { useState } from "react";
import { api } from "./api.js";
import { Modal } from "./ui.jsx";

const EMPTY = { name: "", email: "", phone: "", passportExpiry: "", preferences: "" };

export default function CustomerForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial ? { ...EMPTY, ...initial } : EMPTY);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const editing = !!initial?.id;

  async function submit(e) {
    e.preventDefault();
    try {
      setBusy(true);
      setErr("");
      const saved = await api(editing ? `/api/customers/${initial.id}` : "/api/customers", {
        method: editing ? "PUT" : "POST",
        body: f,
      });
      onSaved(saved);
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? "Edit customer" : "New customer"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {err && <div className="error flush">{err}</div>}
        <label>Full name<input className="input" value={f.name} onChange={set("name")} required autoFocus /></label>
        <label>Email<input className="input" type="email" value={f.email} onChange={set("email")} required /></label>
        <div className="row">
          <label>Phone<input className="input" value={f.phone} onChange={set("phone")} placeholder="+1 305 555 0100" /></label>
          <label>Passport expiry<input className="input" type="date" value={f.passportExpiry} onChange={set("passportExpiry")} /></label>
        </div>
        <label>Preferences<textarea className="input" rows="3" value={f.preferences} onChange={set("preferences")} placeholder="Cabin type, dietary needs, accessibility, favourite cruise lines" /></label>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create customer"}</button>
        </div>
      </form>
    </Modal>
  );
}
