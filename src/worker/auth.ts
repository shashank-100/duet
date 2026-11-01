// Participant ownership. No accounts: each submission gets a random secret; its SHA-256 hash is
// stored, and the browser holds "<id>.<secret>" in an HttpOnly cookie plus a private manage link.

const COOKIE = "duet_session";
const MAX_OWNED = 6;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function newToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function tokenMatches(token: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash) return false;
  const a = new TextEncoder().encode(await sha256(token));
  const b = new TextEncoder().encode(storedHash);
  return a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
}

export function readSessions(cookieHeader: string | null | undefined): { id: string; token: string }[] {
  const raw = (cookieHeader ?? "")
    .split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return [];
  return decodeURIComponent(raw)
    .split(",")
    .map((pair) => {
      const dot = pair.indexOf(".");
      return dot > 0 ? { id: pair.slice(0, dot), token: pair.slice(dot + 1) } : null;
    })
    .filter((x): x is { id: string; token: string } => !!x && /^p_[a-f0-9]{16}$/.test(x.id));
}

export function sessionCookie(sessions: { id: string; token: string }[], secure: boolean): string {
  const value = encodeURIComponent(sessions.slice(-MAX_OWNED).map((s) => `${s.id}.${s.token}`).join(","));
  const attrs = [`${COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=31536000"];
  if (secure) attrs.push("Secure");
  if (!value) attrs.push("Max-Age=0");
  return attrs.join("; ");
}

export async function ownerOf(db: D1Database, cookieHeader: string | null | undefined, participantId: string): Promise<boolean> {
  const s = readSessions(cookieHeader).find((x) => x.id === participantId);
  if (!s) return false;
  const row = await db.prepare("SELECT token_hash FROM participants WHERE id = ?1 AND kind = 'real'").bind(participantId).first<{ token_hash: string | null }>();
  return tokenMatches(s.token, row?.token_hash ?? null);
}

export async function adminOk(authorization: string | null | undefined, adminToken: string | undefined): Promise<boolean> {
  if (!adminToken || !authorization?.startsWith("Bearer ")) return false;
  const a = new TextEncoder().encode(await sha256(authorization.slice(7)));
  const b = new TextEncoder().encode(await sha256(adminToken));
  return crypto.subtle.timingSafeEqual(a, b);
}
