export const fmtDate = (d) =>
  d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (d) =>
  new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const money = (n) => "$" + Number(n || 0).toLocaleString("en-US");
export const initials = (n) => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
export const statusClass = (s) => "st-" + s.replace(/\s/g, "");
export const daysFromNow = (iso) => Math.round((new Date(iso + "T00:00:00") - new Date().setHours(0, 0, 0, 0)) / 864e5);
