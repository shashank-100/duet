// D1 data access. All reads that cross into the client go through the shapers here.

import type {
  DateSummary,
  Observation,
  ParticipantSummary,
  Preferences,
  ProfileDetail,
  SourceDocument,
  SourceItem,
  Turn,
} from "../shared/types";
import type { AgentProfile } from "./harness";

export const now = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

type Row = Record<string, unknown>;

const PARTICIPANT_COLUMNS = `p.id, p.kind, p.display_name, p.linkedin_url, p.instagram_url, p.status, p.status_detail,
  p.dating_enabled, p.approved_at, p.approved_by, COALESCE(pr.headline, '') AS headline`;

export function toSummary(r: Row): ParticipantSummary {
  return {
    id: String(r.id),
    kind: r.kind as ParticipantSummary["kind"],
    display_name: String(r.display_name),
    linkedin_url: String(r.linkedin_url),
    instagram_url: String(r.instagram_url),
    status: r.status as ParticipantSummary["status"],
    status_detail: (r.status_detail as string | null) ?? null,
    dating_enabled: Boolean(r.dating_enabled),
    headline: String(r.headline ?? ""),
    approved_at: (r.approved_at as string | null) ?? null,
    approved_by: (r.approved_by as string | null) ?? null,
  };
}

export async function listParticipants(db: D1Database, kind?: "demo" | "real"): Promise<ParticipantSummary[]> {
  const sql = `SELECT ${PARTICIPANT_COLUMNS} FROM participants p LEFT JOIN profiles pr ON pr.participant_id = p.id
    WHERE p.status = 'approved' ${kind ? "AND p.kind = ?1" : ""} ORDER BY p.kind, p.display_name`;
  const { results } = await (kind ? db.prepare(sql).bind(kind) : db.prepare(sql)).all<Row>();
  return results.map(toSummary);
}

export async function getSummary(db: D1Database, id: string): Promise<ParticipantSummary | null> {
  const r = await db
    .prepare(`SELECT ${PARTICIPANT_COLUMNS} FROM participants p LEFT JOIN profiles pr ON pr.participant_id = p.id WHERE p.id = ?1`)
    .bind(id)
    .first<Row>();
  return r ? toSummary(r) : null;
}

export function toPreferences(r: Row | null): Preferences {
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  let openTo: Preferences["open_to"] = [];
  try {
    openTo = JSON.parse(String(r?.open_to ?? "[]")) as Preferences["open_to"];
  } catch {
    openTo = [];
  }
  return {
    age: num(r?.age),
    gender: (str(r?.gender) as Preferences["gender"]) ?? null,
    open_to: openTo,
    age_min: num(r?.age_min),
    age_max: num(r?.age_max),
    location: str(r?.location),
    looking_for: str(r?.looking_for),
    priorities: str(r?.priorities),
    boundaries: str(r?.boundaries),
  };
}

export async function getPreferences(db: D1Database, id: string): Promise<Preferences> {
  return toPreferences(await db.prepare("SELECT * FROM preferences WHERE participant_id = ?1").bind(id).first<Row>());
}

export async function savePreferences(db: D1Database, id: string, p: Preferences): Promise<void> {
  await db
    .prepare(
      `INSERT INTO preferences (participant_id, age, gender, open_to, age_min, age_max, location, looking_for, priorities, boundaries)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
       ON CONFLICT(participant_id) DO UPDATE SET age=?2, gender=?3, open_to=?4, age_min=?5, age_max=?6, location=?7,
         looking_for=?8, priorities=?9, boundaries=?10`,
    )
    .bind(id, p.age, p.gender, JSON.stringify(p.open_to), p.age_min, p.age_max, p.location, p.looking_for, p.priorities, p.boundaries)
    .run();
}

export async function getItems(db: D1Database, id: string): Promise<SourceItem[]> {
  const { results } = await db
    .prepare("SELECT id, platform, field, url, text FROM source_items WHERE participant_id = ?1 ORDER BY platform, ord")
    .bind(id)
    .all<SourceItem>();
  return results;
}

export async function getObservations(db: D1Database, id: string): Promise<(Observation & { platform: string | null; url: string | null })[]> {
  const { results } = await db
    .prepare(
      `SELECT o.*, si.platform AS platform, si.url AS url, si.field AS field FROM observations o
       LEFT JOIN source_items si ON si.id = o.source_item_id WHERE o.participant_id = ?1 ORDER BY o.ord, o.rowid`,
    )
    .bind(id)
    .all<Row>();
  return results.map((r) => ({
    id: String(r.id),
    category: r.category as Observation["category"],
    label: String(r.label),
    detail: String(r.detail ?? ""),
    origin: r.origin as Observation["origin"],
    source_item_id: (r.source_item_id as string | null) ?? null,
    quote: (r.quote as string | null) ?? null,
    edited: Boolean(r.edited),
    platform: (r.platform as string | null) ?? null,
    url: (r.url as string | null) ?? null,
    source: r.platform ? { platform: r.platform as "linkedin" | "instagram", url: String(r.url), field: String(r.field) } : null,
  }));
}

export async function getProfileDetail(db: D1Database, id: string, isOwner: boolean): Promise<ProfileDetail | null> {
  const summary = await getSummary(db, id);
  if (!summary) return null;
  const [profile, preferences, observations, sources, items, events] = await Promise.all([
    db.prepare("SELECT * FROM profiles WHERE participant_id = ?1").bind(id).first<Row>(),
    getPreferences(db, id),
    getObservations(db, id),
    db.prepare("SELECT * FROM source_documents WHERE participant_id = ?1 ORDER BY created_at DESC").bind(id).all<SourceDocument>(),
    getItems(db, id),
    db.prepare("SELECT step, status, message, at FROM ingest_events WHERE participant_id = ?1 ORDER BY id DESC LIMIT 40").bind(id).all<ProfileDetail["events"][number]>(),
  ]);
  let unknowns: string[] = [];
  try {
    unknowns = JSON.parse(String(profile?.unknowns ?? "[]")) as string[];
  } catch {
    unknowns = [];
  }
  return {
    ...summary,
    summary: String(profile?.summary ?? ""),
    unknowns,
    analysis_model: (profile?.analysis_model as string | null) ?? null,
    analyzed_at: (profile?.analyzed_at as string | null) ?? null,
    dropped_claims: Number(profile?.dropped_claims ?? 0),
    // Age/gender/orientation are only used for eligibility and shown to the owner, never publicly.
    preferences: isOwner ? preferences : { ...preferences, age: null, gender: null, open_to: [], age_min: null, age_max: null },
    observations,
    sources: sources.results,
    items,
    events: events.results,
    is_owner: isOwner,
  };
}

export async function getAgentProfile(db: D1Database, id: string): Promise<AgentProfile> {
  const d = await getProfileDetail(db, id, true);
  if (!d) throw new Error(`Participant ${id} not found`);
  return {
    id: d.id,
    display_name: d.display_name,
    kind: d.kind,
    headline: d.headline,
    summary: d.summary,
    unknowns: d.unknowns,
    preferences: d.preferences,
    observations: d.observations,
  };
}

export async function logEvent(db: D1Database, participantId: string, step: string, status: string, message: string): Promise<void> {
  await db.prepare("INSERT INTO ingest_events (participant_id, step, status, message) VALUES (?1, ?2, ?3, ?4)").bind(participantId, step, status, message).run();
}

export async function setStatus(db: D1Database, id: string, status: string, detail: string | null): Promise<void> {
  await db.prepare("UPDATE participants SET status = ?2, status_detail = ?3, updated_at = ?4 WHERE id = ?1").bind(id, status, detail, now()).run();
}

const DATE_SELECT = `SELECT d.*, pa.display_name AS a_name, pa.kind AS a_kind, pb.display_name AS b_name, pb.kind AS b_kind,
  (SELECT COUNT(*) FROM turns t WHERE t.date_id = d.id) AS turn_count, s.score_a, s.score_b
  FROM dates d JOIN participants pa ON pa.id = d.a_id JOIN participants pb ON pb.id = d.b_id
  LEFT JOIN assessments s ON s.date_id = d.id`;

export function toDateSummary(r: Row): DateSummary {
  return {
    id: String(r.id),
    pool: r.pool as DateSummary["pool"],
    status: r.status as DateSummary["status"],
    error: (r.error as string | null) ?? null,
    a: { id: String(r.a_id), display_name: String(r.a_name), kind: r.a_kind as "demo" | "real" },
    b: { id: String(r.b_id), display_name: String(r.b_name), kind: r.b_kind as "demo" | "real" },
    turn_count: Number(r.turn_count ?? 0),
    created_at: String(r.created_at),
    completed_at: (r.completed_at as string | null) ?? null,
    score_a: r.score_a === null || r.score_a === undefined ? null : Number(r.score_a),
    score_b: r.score_b === null || r.score_b === undefined ? null : Number(r.score_b),
  };
}

export async function listDates(db: D1Database, filter: { pool?: string; participant?: string; limit?: number }): Promise<DateSummary[]> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (filter.pool) {
    binds.push(filter.pool);
    where.push(`d.pool = ?${binds.length}`);
  }
  if (filter.participant) {
    binds.push(filter.participant);
    where.push(`(d.a_id = ?${binds.length} OR d.b_id = ?${binds.length})`);
  }
  const sql = `${DATE_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY CASE d.status WHEN 'running' THEN 0 WHEN 'evaluating' THEN 0 WHEN 'starting' THEN 1 WHEN 'queued' THEN 2 ELSE 3 END,
    COALESCE(d.completed_at, d.created_at) DESC LIMIT ${Math.min(filter.limit ?? 500, 1000)}`;
  const { results } = await db.prepare(sql).bind(...binds).all<Row>();
  return results.map(toDateSummary);
}

export async function getDateRow(db: D1Database, id: string): Promise<(DateSummary & { model: string | null }) | null> {
  const r = await db.prepare(`${DATE_SELECT} WHERE d.id = ?1`).bind(id).first<Row>();
  return r ? { ...toDateSummary(r), model: (r.model as string | null) ?? null } : null;
}

export async function getTurns(db: D1Database, dateId: string): Promise<Turn[]> {
  const { results } = await db.prepare("SELECT idx, speaker_id, phase, content, created_at FROM turns WHERE date_id = ?1 ORDER BY idx").bind(dateId).all<Turn>();
  return results;
}
