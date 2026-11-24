import { useEffect, useState } from "react";
import { api } from "./api.js";
import Customers from "./Customers.jsx";
import Audit from "./Audit.jsx";

export default function App() {
  const [page, setPage] = useState("customers");

  // Auto-set a default user (no login required)
  const user = { username: "admin", role: "admin" };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">⚓ Cruise<span>CRM</span></div>
        <nav className="nav">
          <button className={page === "customers" ? "active" : ""} onClick={() => setPage("customers")}>Customers</button>
          <button className={page === "audit" ? "active" : ""} onClick={() => setPage("audit")}>Audit log</button>
        </nav>
      </header>
      <main className="container">
        {page === "customers" ? <Customers user={user} /> : <Audit />}
      </main>
    </div>
  );
}
