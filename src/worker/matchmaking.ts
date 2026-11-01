// Scheduling: creates dates for newly approved participants and dispatches queued dates
// to DateRoom Durable Objects with bounded concurrency. Runs on approval, on date completion,
// and every minute from cron (which also revives stalled dates).

import { mutuallyEligible, pairsToSchedule, type Candidate } from "./eligibility";
import { getPreferences, newId, now, toPreferences } from "./db";

type Row = Record<string, unknown>;

export async function candidates(db: D1Database, kind: "demo" | "real"): Promise<Candidate[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.kind, p.status, p.dating_enabled, pr.* FROM participants p
       LEFT JOIN preferences pr ON pr.participant_id = p.id WHERE p.kind = ?1`,
    )
    .bind(kind)
    .all<Row>();
  return results.map((r) => ({
    id: String(r.id),
    kind: r.kind as "demo" | "real",
    approved: r.status === "approved",
    dating_enabled: Boolean(r.dating_enabled),
    preferences: toPreferences(r),
  }));
}

export async function scheduleDatesFor(db: D1Database, participantId: string): Promise<number> {
  const me = await db.prepare("SELECT id, kind, status, dating_enabled FROM participants WHERE id = ?1").bind(participantId).first<Row>();
  if (!me) return 0;
  const kind = me.kind as "demo" | "real";
  const all = await candidates(db, kind);
  const self = all.find((c) => c.id === participantId);
  if (!self) return 0;
  const { results } = await db
    .prepare("SELECT a_id, b_id FROM dates WHERE (a_id = ?1 OR b_id = ?1) AND status != 'failed'")
    .bind(participantId)
    .all<Row>();
  const existing = new Set(results.map((r) => `${r.a_id}|${r.b_id}`));
  const pairs = pairsToSchedule(self, all, existing);
  if (!pairs.length) return 0;
  // A previously failed date for the same pair is replaced by a fresh one.
  await db.batch(
    pairs.flatMap(([a, b]) => [
      db.prepare("DELETE FROM dates WHERE a_id = ?1 AND b_id = ?2 AND status = 'failed'").bind(a, b),
      db.prepare("INSERT OR IGNORE INTO dates (id, pool, a_id, b_id, status) VALUES (?1, ?2, ?3, ?4, 'queued')").bind(newId("date"), kind, a, b),
    ]),
  );
  return pairs.length;
}

export async function createPracticeDate(db: D1Database, realId: string, demoId: string): Promise<string> {
  const real = await db.prepare("SELECT kind, status FROM participants WHERE id = ?1").bind(realId).first<Row>();
  const demo = await db.prepare("SELECT kind, status FROM participants WHERE id = ?1").bind(demoId).first<Row>();
  if (real?.kind !== "real" || real.status !== "approved") throw new Error("Approve your profile before starting a practice date.");
  if (demo?.kind !== "demo" || demo.status !== "approved") throw new Error("Practice dates are only with approved fictional demo agents.");
  const [rp, dp] = await Promise.all([getPreferences(db, realId), getPreferences(db, demoId)]);
  // Practice dates respect both sides' stated preferences, but cross the demo/real pool boundary.
  if (!mutuallyEligible({ id: realId, kind: "real", approved: true, dating_enabled: true, preferences: rp }, { id: demoId, kind: "real", approved: true, dating_enabled: true, preferences: dp })) {
    throw new Error("Based on what you and this demo persona stated (who you're open to, age range), this pairing isn't eligible. Pick another.");
  }
  const existing = await db.prepare("SELECT id, status FROM dates WHERE a_id = ?1 AND b_id = ?2").bind(realId, demoId).first<Row>();
  if (existing && existing.status !== "failed") return String(existing.id);
  if (existing) await db.prepare("DELETE FROM dates WHERE id = ?1").bind(existing.id).run();
  const id = newId("date");
  await db.prepare("INSERT INTO dates (id, pool, a_id, b_id, status) VALUES (?1, 'practice', ?2, ?3, 'queued')").bind(id, realId, demoId).run();
  return id;
}

export interface DispatchEnv {
  DB: D1Database;
  DATE_ROOM: DurableObjectNamespace<import("./date-room").DateRoom>;
  MAX_CONCURRENT_DATES?: string;
}

export function roomFor(env: DispatchEnv, dateId: string) {
  return env.DATE_ROOM.get(env.DATE_ROOM.idFromName(dateId));
}

export async function dispatch(env: DispatchEnv): Promise<{ started: number; revived: number }> {
  const max = Math.max(1, Number(env.MAX_CONCURRENT_DATES || 6));
  // Revive dates whose room stopped heartbeating (e.g. after a deploy or crash).
  const stale = new Date(Date.now() - 3 * 60_000).toISOString();
  const { results: stalled } = await env.DB
    .prepare("SELECT id FROM dates WHERE status IN ('starting','running','evaluating') AND COALESCE(heartbeat_at, started_at, created_at) < ?1 LIMIT 20")
    .bind(stale)
    .all<Row>();
  for (const r of stalled) await roomFor(env, String(r.id)).start(String(r.id));

  const active = await env.DB.prepare("SELECT COUNT(*) AS n FROM dates WHERE status IN ('starting','running','evaluating')").first<{ n: number }>();
  const slots = max - Number(active?.n ?? 0);
  if (slots <= 0) return { started: 0, revived: stalled.length };
  const { results: queued } = await env.DB
    .prepare(
      `SELECT id FROM dates WHERE status = 'queued'
       ORDER BY CASE pool WHEN 'practice' THEN 0 WHEN 'real' THEN 1 ELSE 2 END, created_at LIMIT ?1`,
    )
    .bind(slots)
    .all<Row>();
  let started = 0;
  for (const r of queued) {
    const id = String(r.id);
    const res = await env.DB.prepare("UPDATE dates SET status = 'starting', started_at = ?2, heartbeat_at = ?2 WHERE id = ?1 AND status = 'queued'").bind(id, now()).run();
    if (!res.meta.changes) continue;
    await roomFor(env, id).start(id);
    started++;
  }
  return { started, revived: stalled.length };
}
