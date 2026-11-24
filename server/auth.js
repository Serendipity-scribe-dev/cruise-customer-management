import crypto from "node:crypto";
import { HttpError } from "./domain.js";

// Stateless signed tokens (HMAC-SHA256), so auth works across serverless instances.
const secret = () => process.env.AUTH_SECRET || "dev-only-secret-change-me";
const TTL_MS = 12 * 60 * 60 * 1000;

const users = () => [
  { username: "admin", password: process.env.ADMIN_PASSWORD || "admin123", role: "admin" },
  { username: "agent", password: process.env.AGENT_PASSWORD || "agent123", role: "agent" },
];

const b64 = (s) => Buffer.from(s).toString("base64url");
const mac = (body) => crypto.createHmac("sha256", secret()).update(body).digest("base64url");
const digest = (s) => crypto.createHash("sha256").update(String(s)).digest();

export function login(username, password) {
  const u = users().find((x) => x.username === String(username || "").trim().toLowerCase());
  const ok = u && crypto.timingSafeEqual(digest(u.password), digest(password));
  if (!ok) throw new HttpError(401, "Wrong username or password");
  const user = { username: u.username, role: u.role };
  const body = b64(JSON.stringify({ ...user, exp: Date.now() + TTL_MS }));
  return { token: `${body}.${mac(body)}`, user };
}

export function verifyToken(token = "") {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = mac(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? { username: p.username, role: p.role } : null;
  } catch {
    return null;
  }
}

export function requireAuth(req, _res, next) {
  const user = verifyToken((req.headers.authorization || "").replace(/^Bearer /, ""));
  if (!user) return next(new HttpError(401, "Please sign in"));
  req.user = user;
  next();
}

export const requireRole = (role) => (req, _res, next) =>
  req.user.role === role ? next() : next(new HttpError(403, "Only an admin can do this"));
