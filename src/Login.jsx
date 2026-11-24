import { useState } from "react";
import { api, setToken } from "./api.js";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    try {
      setBusy(true);
      setError("");
      const { token, user } = await api("/api/login", { method: "POST", body: { username, password } });
      setToken(token);
      onLogin(user);
    } catch (ex) {
      setError(ex.message);
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand dark">⚓ Cruise<span>CRM</span></div>
        <h1>Sign in</h1>
        {error && <div className="error flush">{error}</div>}
        <label>Username
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" required />
        </label>
        <label>Password
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="btn primary wide" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="muted small demo-hint">
          Demo accounts: <strong>admin</strong> / admin123 (can delete customers) and <strong>agent</strong> / agent123.
        </p>
      </form>
    </div>
  );
}
