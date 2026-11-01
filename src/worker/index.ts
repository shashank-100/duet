import { Hono, type Context } from "hono";
import { GENDERS, OBSERVATION_CATEGORIES, type DateDetail, type Gender, type Preferences } from "../shared/types";
import { adminOk, newToken, ownerOf, readSessions, sessionCookie, sha256, tokenMatches } from "./auth";
import { getDateRow, getProfileDetail, getTurns, listDates, listParticipants, logEvent, newId, now, savePreferences, setStatus } from "./db";
import { PERSONAS } from "./demo/personas";
import { seedDemo } from "./demo/seed";
import { DATE_PLAN } from "./harness";
import { storeResult } from "./retrieval/store";
import { createLLM } from "./llm";
import { OPERATOR_SOURCE, TRY_SOURCE } from "./ingest";
import { createPracticeDate, dispatch, roomFor, scheduleDatesFor } from "./matchmaking";
import { rankingFor } from "./rankings";
import { exportResult, type UploadedFile } from "./retrieval/exports";
import { LinkError, normalizeInstagram, normalizeLinkedIn } from "./retrieval/urls";

export { DateRoom } from "./date-room";
export { IngestWorkflow } from "./ingest";

const CONSENT_VERSION = "2026-10-09";
type C = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  console.error(JSON.stringify({ msg: "unhandled", path: c.req.path, error: err.message, stack: err.stack }));
  return c.json({ error: "Something went wrong on our side. Please try again." }, 500);
});

const bad = (c: C, error: string, status: 400 | 403 | 404 | 409 | 413 | 429 = 400) => c.json({ error }, status);

async function requireOwner(c: C, id: string): Promise<boolean> {
  return ownerOf(c.env.DB, c.req.header("cookie"), id);
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}
function int(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function parsePreferences(body: Record<string, unknown>): Preferences {
  const gender = GENDERS.includes(body.gender as Gender) ? (body.gender as Gender) : null;
  const openTo = Array.isArray(body.open_to) ? (body.open_to as unknown[]).filter((g): g is Gender => GENDERS.includes(g as Gender)) : [];
  let ageMin = int(body.age_min, 18, 99);
  let ageMax = int(body.age_max, 18, 99);
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
  return {
    age: int(body.age, 18, 99),
    gender,
    open_to: [...new Set(openTo)],
    age_min: ageMin,
    age_max: ageMax,
    location: str(body.location, 80),
    looking_for: str(body.looking_for, 400),
    priorities: str(body.priorities, 600),
    boundaries: str(body.boundaries, 400),
  };
}

// ---------- public reads ----------

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/config", async (c) => {
  let model = "unconfigured";
  try {
    model = createLLM(c.env).model;
  } catch (err) {
    model = `error: ${(err as Error).message}`;
  }
  const { results } = await c.env.DB.prepare(
    `SELECT p.kind, p.status, COUNT(*) AS n FROM participants p GROUP BY p.kind, p.status`,
  ).all<{ kind: string; status: string; n: number }>();
  const { results: dates } = await c.env.DB.prepare(`SELECT pool, status, COUNT(*) AS n FROM dates GROUP BY pool, status`).all<{ pool: string; status: string; n: number }>();
  return c.json({
    model,
    retrievers: { apify: Boolean(c.env.APIFY_TOKEN), public_fetch: true, data_export: true },
    participants: results,
    dates,
    demo_personas: PERSONAS.length,
  });
});

app.get("/api/participants", async (c) => {
  const kind = c.req.query("kind");
  return c.json(await listParticipants(c.env.DB, kind === "demo" || kind === "real" ? kind : undefined));
});

app.get("/api/participants/:id", async (c) => {
  const id = c.req.param("id");
  const isOwner = await requireOwner(c, id);
  const detail = await getProfileDetail(c.env.DB, id, isOwner);
  // Real participants' drafts are private to them until they approve.
  if (!detail) return bad(c, "Profile not found.", 404);
  // Real participants' drafts are private until approved: show only who they are and the progress.
  if (detail.kind === "real" && !isOwner && detail.status !== "approved") {
    return c.json({ ...detail, headline: "", summary: "", observations: [], items: [], unknowns: [], events: [] });
  }
  return c.json(detail);
});

app.get("/api/dates", async (c) => {
  return c.json(await listDates(c.env.DB, { pool: c.req.query("pool") || undefined, participant: c.req.query("participant") || undefined, limit: Number(c.req.query("limit") || 500) }));
});

app.get("/api/dates/:id", async (c) => {
  const id = c.req.param("id");
  const date = await getDateRow(c.env.DB, id);
  if (!date) return bad(c, "Date not found.", 404);
  const [turns, assessment] = await Promise.all([
    getTurns(c.env.DB, id),
    c.env.DB.prepare("SELECT data FROM assessments WHERE date_id = ?1").bind(id).first<{ data: string }>(),
  ]);
  const detail: DateDetail = {
    ...date,
    turns,
    assessment: assessment ? JSON.parse(assessment.data) : null,
    plan: DATE_PLAN.map((p) => ({ phase: p.phase, speaker: p.speaker })),
  };
  return c.json(detail);
});

app.get("/api/dates/:id/live", async (c) => {
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") return bad(c, "Expected a WebSocket upgrade.");
  const id = c.req.param("id");
  const exists = await c.env.DB.prepare("SELECT 1 FROM dates WHERE id = ?1").bind(id).first();
  if (!exists) return bad(c, "Date not found.", 404);
  const url = new URL(c.req.url);
  url.searchParams.set("date", id);
  return roomFor(c.env, id).fetch(new Request(url.toString(), c.req.raw));
});

app.get("/api/rankings/:id", async (c) => {
  const id = c.req.param("id");
  const isOwner = await requireOwner(c, id);
  const ranking = await rankingFor(c.env.DB, id);
  if (!ranking || (ranking.participant.kind === "real" && !isOwner && ranking.participant.status !== "approved")) return bad(c, "Ranking not found.", 404);
  return c.json(ranking);
});

app.get("/api/demo/sources/:slug", (c) => {
  const p = PERSONAS.find((x) => x.slug === c.req.param("slug"));
  if (!p) return bad(c, "Unknown demo persona.", 404);
  return c.json({ fictional: true, name: p.name, location: p.location, linkedin: p.linkedin, instagram: p.instagram });
});

// ---------- sessions ----------

app.get("/api/me", async (c) => {
  const sessions = readSessions(c.req.header("cookie"));
  const owned = [];
  for (const s of sessions) {
    const row = await c.env.DB.prepare("SELECT id, display_name, status, token_hash FROM participants WHERE id = ?1").bind(s.id).first<{ id: string; display_name: string; status: string; token_hash: string }>();
    if (row && (await tokenMatches(s.token, row.token_hash))) owned.push({ id: row.id, display_name: row.display_name, status: row.status });
  }
  return c.json({ participants: owned });
});

app.post("/api/session", async (c) => {
  const body = await c.req.json<{ id?: string; token?: string }>().catch(() => ({}) as { id?: string; token?: string });
  if (!body.id || !body.token) return bad(c, "Missing manage link details.");
  const row = await c.env.DB.prepare("SELECT token_hash FROM participants WHERE id = ?1").bind(body.id).first<{ token_hash: string }>();
  if (!row || !(await tokenMatches(body.token, row.token_hash))) return bad(c, "That manage link is not valid (or the profile was deleted).", 403);
  const sessions = readSessions(c.req.header("cookie")).filter((s) => s.id !== body.id);
  sessions.push({ id: body.id, token: body.token });
  c.header("set-cookie", sessionCookie(sessions, new URL(c.req.url).protocol === "https:"));
  return c.json({ ok: true, id: body.id });
});

// ---------- enrollment ----------

app.post("/api/participants", async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body) return bad(c, "Invalid request.");
  const name = str(body.display_name, 60);
  if (!name) return bad(c, "Please enter the first name (or name) you want your agent to use.");
  let linkedin: string;
  let instagram: string;
  try {
    linkedin = normalizeLinkedIn(String(body.linkedin_url ?? ""));
  } catch (err) {
    return bad(c, err instanceof LinkError ? `LinkedIn: ${err.message}` : "Invalid LinkedIn link.");
  }
  try {
    instagram = normalizeInstagram(String(body.instagram_url ?? ""));
  } catch (err) {
    return bad(c, err instanceof LinkError ? `Instagram: ${err.message}` : "Invalid Instagram link.");
  }
  const consent = (body.consent ?? {}) as Record<string, unknown>;
  for (const key of ["adult", "own_accounts", "analysis", "agent_dating", "visibility"]) {
    if (consent[key] !== true) return bad(c, "All consent boxes must be checked to continue.");
  }
  const prefs = parsePreferences((body.preferences ?? {}) as Record<string, unknown>);
  if (prefs.age === null) return bad(c, "Please enter your age (18+). It is only used for eligibility and is never shown publicly.");

  // Open sign-up: anyone with the link can add profiles; there is no per-network limit.
  const ipHash = await sha256(`${c.req.header("cf-connecting-ip") ?? "local"}|duet`);
  const dupe = await c.env.DB.prepare("SELECT id FROM participants WHERE kind = 'real' AND (linkedin_url = ?1 OR instagram_url = ?2)").bind(linkedin, instagram).first<{ id: string }>();
  if (dupe) return bad(c, "A profile with one of these links already exists. If it's yours, open it with your manage link, or delete it there first.", 409);

  const id = `p_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const token = newToken();
  await c.env.DB.prepare(
    `INSERT INTO participants (id, kind, display_name, linkedin_url, instagram_url, status, status_detail, consent_at, consent_version, token_hash, ip_hash)
     VALUES (?1, 'real', ?2, ?3, ?4, 'submitted', 'Queued for retrieval.', ?5, ?6, ?7, ?8)`,
  )
    .bind(id, name, linkedin, instagram, now(), CONSENT_VERSION, await sha256(token), ipHash)
    .run();
  await savePreferences(c.env.DB, id, prefs);
  await logEvent(c.env.DB, id, "consent", "ok", `Consent recorded (version ${CONSENT_VERSION}) for analysis of ${linkedin} and ${instagram}.`);
  await c.env.INGEST.create({ id: `ingest-${id}-${Date.now()}`, params: { participantId: id, mode: "full" } });
  const sessions = readSessions(c.req.header("cookie"));
  sessions.push({ id, token });
  c.header("set-cookie", sessionCookie(sessions, new URL(c.req.url).protocol === "https:"));
  return c.json({ id, manage_path: `/manage/${id}#${token}` }, 201);
});

// Try it: a judge enters two people (LinkedIn + public Instagram each); their agents date each other.
app.post("/api/try", async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body || body.permission !== true) return bad(c, "Please confirm the two profiles are public and you're allowed to use them.");
  const people: { name: string; linkedin: string; instagram: string }[] = [];
  for (const key of ["a", "b"]) {
    const p = (body[key] ?? {}) as Record<string, unknown>;
    const name = str(p.display_name, 60);
    if (!name) return bad(c, `Person ${key.toUpperCase()}: please enter a name.`);
    try {
      people.push({ name, linkedin: normalizeLinkedIn(String(p.linkedin_url ?? "")), instagram: normalizeInstagram(String(p.instagram_url ?? "")) });
    } catch (err) {
      return bad(c, `Person ${key.toUpperCase()}: ${err instanceof LinkError ? err.message : "invalid link."}`);
    }
  }
  if (people[0].linkedin === people[1].linkedin || people[0].instagram === people[1].instagram) return bad(c, "Enter two different people.");
  const ids = people.map(() => `p_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`);
  const existing: (string | null)[] = [];
  for (const p of people) {
    const row = await c.env.DB.prepare("SELECT id FROM participants WHERE kind = 'real' AND (linkedin_url = ?1 OR instagram_url = ?2)").bind(p.linkedin, p.instagram).first<{ id: string }>();
    existing.push(row?.id ?? null);
  }
  const finalIds = ids.map((id, i) => existing[i] ?? id);
  for (let i = 0; i < 2; i++) {
    if (existing[i]) continue;
    const p = people[i];
    await c.env.DB.prepare(
      `INSERT INTO participants (id, kind, display_name, linkedin_url, instagram_url, status, status_detail, consent_at, consent_version, token_hash, ip_hash, pair_with)
       VALUES (?1, 'real', ?2, ?3, ?4, 'submitted', 'Queued for retrieval.', ?5, ?6, NULL, 'try', ?7)`,
    )
      .bind(finalIds[i], p.name, p.linkedin, p.instagram, now(), TRY_SOURCE, finalIds[1 - i])
      .run();
    await savePreferences(c.env.DB, finalIds[i], parsePreferences({ open_to: ["woman", "man", "nonbinary"], age_min: 18, age_max: 99 }));
    await logEvent(c.env.DB, finalIds[i], "added", "ok", `Entered on the home page as a pair, with the submitter confirming permission: ${p.linkedin} and ${p.instagram}.`);
    await c.env.INGEST.create({ id: `ingest-${finalIds[i]}-${Date.now()}`, params: { participantId: finalIds[i], mode: "full" } });
  }
  // Both already known (e.g. two of the 26): date them right away.
  if (existing[0] && existing[1]) {
    const already = await c.env.DB.prepare("SELECT id FROM dates WHERE (a_id = ?1 AND b_id = ?2) OR (a_id = ?2 AND b_id = ?1)").bind(finalIds[0], finalIds[1]).first();
    if (!already) await c.env.DB.prepare("INSERT INTO dates (id, pool, a_id, b_id, status) VALUES (?1, 'real', ?2, ?3, 'queued')").bind(newId("date"), finalIds[0], finalIds[1]).run();
    c.executionCtx.waitUntil(dispatch(c.env));
  }
  return c.json({ a: finalIds[0], b: finalIds[1] }, 201);
});

// ---------- owner actions ----------

app.use("/api/participants/:id/*", async (c, next) => {
  if (c.req.method === "GET") return next();
  if (!(await requireOwner(c, c.req.param("id")!))) return bad(c, "Only the person who created this profile can change it. Open it with your manage link.", 403);
  return next();
});

app.patch("/api/participants/:id/profile", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();
  const sets: string[] = [];
  const binds: unknown[] = [id];
  if (typeof body.headline === "string") binds.push(body.headline.slice(0, 120)) && sets.push(`headline = ?${binds.length}`);
  if (typeof body.summary === "string") binds.push(body.summary.slice(0, 800)) && sets.push(`summary = ?${binds.length}`);
  if (Array.isArray(body.unknowns)) binds.push(JSON.stringify((body.unknowns as unknown[]).map((u) => String(u).slice(0, 200)).filter(Boolean).slice(0, 10))) && sets.push(`unknowns = ?${binds.length}`);
  if (typeof body.display_name === "string" && body.display_name.trim()) {
    await c.env.DB.prepare("UPDATE participants SET display_name = ?2 WHERE id = ?1").bind(id, body.display_name.trim().slice(0, 60)).run();
  }
  if (sets.length) {
    await c.env.DB.prepare(`INSERT INTO profiles (participant_id) VALUES (?1) ON CONFLICT(participant_id) DO NOTHING`).bind(id).run();
    await c.env.DB.prepare(`UPDATE profiles SET ${sets.join(", ")} WHERE participant_id = ?1`).bind(...binds).run();
  }
  return c.json(await getProfileDetail(c.env.DB, id, true));
});

app.put("/api/participants/:id/preferences", async (c) => {
  const id = c.req.param("id");
  const prefs = parsePreferences(await c.req.json<Record<string, unknown>>());
  if (prefs.age === null) return bad(c, "Age (18+) is required.");
  await savePreferences(c.env.DB, id, prefs);
  return c.json(await getProfileDetail(c.env.DB, id, true));
});

app.post("/api/participants/:id/observations", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();
  const category = String(body.category);
  const label = str(body.label, 80);
  if (!OBSERVATION_CATEGORIES.includes(category as never) || !label) return bad(c, "Choose a category and write a short label.");
  await c.env.DB.prepare("INSERT INTO observations (id, participant_id, category, label, detail, origin, ord) VALUES (?1, ?2, ?3, ?4, ?5, 'participant', 999)")
    .bind(newId("obs"), id, category, label, str(body.detail, 300) ?? "")
    .run();
  return c.json(await getProfileDetail(c.env.DB, id, true));
});

app.patch("/api/participants/:id/observations/:oid", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();
  const label = str(body.label, 80);
  if (!label) return bad(c, "A label is required.");
  const category = OBSERVATION_CATEGORIES.includes(body.category as never) ? String(body.category) : null;
  await c.env.DB.prepare("UPDATE observations SET label = ?3, detail = ?4, category = COALESCE(?5, category), edited = 1 WHERE id = ?2 AND participant_id = ?1")
    .bind(id, c.req.param("oid"), label, str(body.detail, 300) ?? "", category)
    .run();
  return c.json(await getProfileDetail(c.env.DB, id, true));
});

app.delete("/api/participants/:id/observations/:oid", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM observations WHERE id = ?2 AND participant_id = ?1").bind(id, c.req.param("oid")).run();
  return c.json(await getProfileDetail(c.env.DB, id, true));
});

app.post("/api/participants/:id/exports", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ platform?: string; files?: UploadedFile[] }>().catch(() => null);
  if (!body || (body.platform !== "linkedin" && body.platform !== "instagram") || !Array.isArray(body.files)) return bad(c, "Choose LinkedIn or Instagram and attach the export files.");
  const files = body.files.filter((f) => typeof f?.name === "string" && typeof f?.text === "string").slice(0, 40);
  if (files.reduce((n, f) => n + f.text.length, 0) > 4_000_000) return bad(c, "Those files are too large. Upload only the files listed in the instructions.", 413);
  const p = await c.env.DB.prepare("SELECT linkedin_url, instagram_url FROM participants WHERE id = ?1").bind(id).first<{ linkedin_url: string; instagram_url: string }>();
  if (!p) return bad(c, "Profile not found.", 404);
  const result = exportResult(body.platform, body.platform === "linkedin" ? p.linkedin_url : p.instagram_url, files);
  if (result.status === "ok") {
    await c.env.DB.prepare("DELETE FROM source_documents WHERE participant_id = ?1 AND platform = ?2 AND method = 'data_export'").bind(id, body.platform).run();
  }
  await storeResult(c.env.DB, id, result);
  await logEvent(c.env.DB, id, `export_${body.platform}`, result.status, result.detail);
  return c.json({ result: { status: result.status, detail: result.detail, items: result.items.length }, profile: await getProfileDetail(c.env.DB, id, true) });
});

app.post("/api/participants/:id/retrieve", async (c) => {
  const id = c.req.param("id");
  await setStatus(c.env.DB, id, "retrieving", "Retrying retrieval.");
  await c.env.INGEST.create({ id: `ingest-${id}-${Date.now()}`, params: { participantId: id, mode: "full" } });
  return c.json(await getProfileDetail(c.env.DB, id, true));
});

app.post("/api/participants/:id/analyze", async (c) => {
  const id = c.req.param("id");
  await setStatus(c.env.DB, id, "analyzing", "Re-running the analysis agent.");
  await c.env.INGEST.create({ id: `ingest-${id}-${Date.now()}`, params: { participantId: id, mode: "analyze" } });
  return c.json(await getProfileDetail(c.env.DB, id, true));
});

app.post("/api/participants/:id/approve", async (c) => {
  const id = c.req.param("id");
  const p = await c.env.DB.prepare("SELECT status FROM participants WHERE id = ?1").bind(id).first<{ status: string }>();
  if (!p || !["draft_ready", "approved", "paused"].includes(p.status)) return bad(c, "Your profile isn't ready to approve yet.", 409);
  const obs = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM observations WHERE participant_id = ?1").bind(id).first<{ n: number }>();
  if (!Number(obs?.n)) return bad(c, "Your profile has no observations. Add at least one, or upload an export and re-analyze.", 409);
  await c.env.DB.prepare("UPDATE participants SET status = 'approved', status_detail = NULL, dating_enabled = 1, approved_at = ?2, approved_by = 'participant' WHERE id = ?1").bind(id, now()).run();
  await logEvent(c.env.DB, id, "approve", "ok", "You approved your profile. Your agent can now date.");
  const scheduled = await scheduleDatesFor(c.env.DB, id, c.env.MAX_DATES_PER_PERSON);
  c.executionCtx.waitUntil(dispatch(c.env));
  return c.json({ scheduled, profile: await getProfileDetail(c.env.DB, id, true) });
});

app.post("/api/participants/:id/pause", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE participants SET status = 'paused', dating_enabled = 0, status_detail = 'Dating paused by you.' WHERE id = ?1").bind(id),
    c.env.DB.prepare("DELETE FROM dates WHERE (a_id = ?1 OR b_id = ?1) AND status = 'queued'").bind(id),
  ]);
  await logEvent(c.env.DB, id, "pause", "ok", "Dating paused. Queued dates were cancelled; finished dates are kept.");
  return c.json(await getProfileDetail(c.env.DB, id, true));
});

app.post("/api/participants/:id/practice", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ demo_id?: string }>().catch(() => ({}) as { demo_id?: string });
  try {
    const dateId = await createPracticeDate(c.env.DB, id, String(body.demo_id ?? ""));
    c.executionCtx.waitUntil(dispatch(c.env));
    return c.json({ date_id: dateId });
  } catch (err) {
    return bad(c, (err as Error).message, 409);
  }
});

app.delete("/api/participants/:id", async (c) => {
  const id = c.req.param("id");
  if (!(await requireOwner(c, id))) return bad(c, "Only the person who created this profile can delete it.", 403);
  // Cascades remove preferences, sources, items, observations, profile, events, dates, turns and assessments.
  await c.env.DB.prepare("DELETE FROM participants WHERE id = ?1 AND kind = 'real'").bind(id).run();
  const sessions = readSessions(c.req.header("cookie")).filter((s) => s.id !== id);
  c.header("set-cookie", sessionCookie(sessions, new URL(c.req.url).protocol === "https:"));
  return c.json({ deleted: true });
});

// ---------- operator ----------

app.post("/api/admin/demo/seed", async (c) => {
  if (!(await adminOk(c.req.header("authorization"), c.env.ADMIN_TOKEN))) return bad(c, "Admin token required.", 403);
  const reset = c.req.query("reset") === "1";
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : undefined;
  return c.json(await seedDemo(c.env, { reset, limit }));
});

// Operator-added real people: public links only, labelled on every page, no consent claimed on their behalf.
app.post("/api/admin/participants", async (c) => {
  if (!(await adminOk(c.req.header("authorization"), c.env.ADMIN_TOKEN))) return bad(c, "Admin token required.", 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  const name = str(body?.display_name, 60);
  if (!body || !name) return bad(c, "display_name is required.");
  let linkedin: string;
  let instagram: string;
  try {
    linkedin = normalizeLinkedIn(String(body.linkedin_url ?? ""));
    instagram = normalizeInstagram(String(body.instagram_url ?? ""));
  } catch (err) {
    return bad(c, err instanceof LinkError ? err.message : "Invalid link.");
  }
  const dupe = await c.env.DB.prepare("SELECT id FROM participants WHERE kind = 'real' AND (linkedin_url = ?1 OR instagram_url = ?2)").bind(linkedin, instagram).first<{ id: string }>();
  if (dupe) return c.json({ id: dupe.id, existing: true });
  const prefs = parsePreferences({ open_to: ["woman", "man", "nonbinary"], ...((body.preferences ?? {}) as Record<string, unknown>) });
  const id = `p_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await c.env.DB.prepare(
    `INSERT INTO participants (id, kind, display_name, linkedin_url, instagram_url, status, status_detail, consent_at, consent_version, token_hash, ip_hash)
     VALUES (?1, 'real', ?2, ?3, ?4, 'submitted', 'Queued for retrieval.', NULL, ?5, NULL, 'operator')`,
  )
    .bind(id, name, linkedin, instagram, OPERATOR_SOURCE)
    .run();
  await savePreferences(c.env.DB, id, prefs);
  await logEvent(c.env.DB, id, "added", "ok", `Added by the Duet operator from public links (${linkedin}, ${instagram}). Not self-submitted.`);
  await c.env.INGEST.create({ id: `ingest-${id}-${Date.now()}`, params: { participantId: id, mode: "full" } });
  return c.json({ id }, 201);
});

app.post("/api/admin/dispatch", async (c) => {
  if (!(await adminOk(c.req.header("authorization"), c.env.ADMIN_TOKEN))) return bad(c, "Admin token required.", 403);
  return c.json(await dispatch(c.env));
});

app.post("/api/admin/dates/:id/retry", async (c) => {
  if (!(await adminOk(c.req.header("authorization"), c.env.ADMIN_TOKEN))) return bad(c, "Admin token required.", 403);
  await c.env.DB.prepare("UPDATE dates SET status = 'queued', error = NULL, attempts = 0 WHERE id = ?1 AND status = 'failed'").bind(c.req.param("id")).run();
  return c.json(await dispatch(c.env));
});

app.all("/api/*", (c) => bad(c, "Not found.", 404));

export default {
  fetch: app.fetch,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      dispatch(env).then((r) => {
        if (r.started || r.revived) console.log(JSON.stringify({ msg: "dispatch", ...r }));
      }),
    );
  },
} satisfies ExportedHandler<Env>;
