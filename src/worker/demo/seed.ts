// Seeds the fictional demo. Personas enter the SAME pipeline as real people: their fixture
// "LinkedIn"/"Instagram" become source items, the analysis agent drafts their profile, and
// approved agents are scheduled for dates through the normal matchmaker.

import { savePreferences } from "../db";
import { storeResult } from "../retrieval/store";
import type { RetrievalResult } from "../retrieval/types";
import { PERSONAS, sourcePath, type Persona } from "./personas";

export function personaSources(p: Persona): RetrievalResult[] {
  const li = sourcePath(p.slug, "linkedin");
  const ig = sourcePath(p.slug, "instagram");
  const linkedin: RetrievalResult = {
    platform: "linkedin",
    method: "demo_fixture",
    url: li,
    status: "ok",
    http_status: null,
    detail: "Fictional LinkedIn fixture (demo persona — not a real person).",
    items: [
      { field: "name", url: li, text: p.name },
      { field: "headline", url: li, text: p.linkedin.headline },
      { field: "about", url: li, text: p.linkedin.about },
      { field: "location", url: li, text: p.location },
      ...p.linkedin.experience.map((text) => ({ field: "experience", url: li, text })),
      { field: "education", url: li, text: p.linkedin.education },
      { field: "skills", url: li, text: `Skills: ${p.linkedin.skills.join(", ")}` },
      ...(p.linkedin.volunteering ? [{ field: "volunteering", url: li, text: p.linkedin.volunteering }] : []),
    ],
  };
  const instagram: RetrievalResult = {
    platform: "instagram",
    method: "demo_fixture",
    url: ig,
    status: "ok",
    http_status: null,
    detail: "Fictional Instagram fixture (demo persona — not a real person).",
    items: [
      { field: "name", url: ig, text: p.name },
      { field: "bio", url: ig, text: p.instagram.bio },
      ...p.instagram.posts.map((text, i) => ({ field: "post", url: `${ig}#post-${i + 1}`, text })),
    ],
  };
  return [linkedin, instagram];
}

export async function resetDemo(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM dates WHERE pool IN ('demo','practice')"),
    db.prepare("DELETE FROM participants WHERE kind = 'demo'"),
  ]);
}

export async function seedDemo(env: Env, opts: { reset: boolean; limit?: number }): Promise<{ created: number; skipped: number }> {
  const db = env.DB;
  if (opts.reset) await resetDemo(db);
  let created = 0;
  let skipped = 0;
  for (const p of PERSONAS.slice(0, opts.limit ?? PERSONAS.length)) {
    const id = `demo_${p.slug.replace(/-/g, "_")}`;
    const exists = await db.prepare("SELECT 1 FROM participants WHERE id = ?1").bind(id).first();
    if (exists) {
      skipped++;
      continue;
    }
    await db
      .prepare(
        `INSERT INTO participants (id, kind, display_name, linkedin_url, instagram_url, status, status_detail, consent_at, consent_version)
         VALUES (?1, 'demo', ?2, ?3, ?4, 'analyzing', 'Fictional persona queued for analysis.', NULL, 'fictional')`,
      )
      .bind(id, p.name, sourcePath(p.slug, "linkedin"), sourcePath(p.slug, "instagram"))
      .run();
    await savePreferences(db, id, {
      age: p.age,
      gender: p.gender,
      open_to: p.open_to,
      age_min: p.age_min,
      age_max: p.age_max,
      location: p.location,
      looking_for: p.looking_for,
      priorities: p.priorities,
      boundaries: p.boundaries || null,
    });
    for (const r of personaSources(p)) await storeResult(db, id, r);
    await env.INGEST.create({ id: `ingest-${id}-${Date.now()}`, params: { participantId: id, mode: "analyze" } });
    created++;
  }
  return { created, skipped };
}
