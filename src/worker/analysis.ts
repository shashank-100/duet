// The analysis agent: reads a person's LinkedIn + Instagram items and drafts a profile.
// Every claim must quote a retrieved item verbatim; anything unquotable is dropped server-side.

import { OBSERVATION_CATEGORIES, type ObservationCategory, type SourceItem } from "../shared/types";
import { completeJson, type LLM } from "./llm";

export interface DraftObservation {
  category: ObservationCategory;
  label: string;
  detail: string;
  item_id: string;
  quote: string;
}

export interface AnalysisResult {
  headline: string;
  summary: string;
  observations: DraftObservation[];
  unknowns: string[];
  dropped: number;
}

const SYSTEM = `You are Duet's profile analyst. You read ONLY the numbered source items below, which come from one consenting adult's own LinkedIn and public Instagram, and you draft an evidence-backed profile that the person will review and edit before anything else happens.

Extract, as observations:
- "need": something the person EXPLICITLY says they need, want, are looking for, or value (e.g. "I need mornings outdoors", "looking for people to build with"). Never derive needs from tone or circumstance.
- "hobby": things they do for enjoyment.
- "interest": topics they explicitly care about or follow.
- "activity": recurring things they do (events, volunteering, sports, travel, teaching, creating).
- "professional": role, field, career history, skills, education.
- "quality": a concrete, observable way they act that the text directly shows (e.g. "mentors newcomers" backed by a post about mentoring). Not personality guesses.

Hard rules:
1. Every observation must cite exactly one item_id and a "quote" copied VERBATIM (character for character, 3–25 words) from that item's text. If you cannot quote it, do not claim it.
2. Never infer or mention sexuality, gender identity, relationship status, romantic needs, religion, ethnicity, health, politics, finances, age, or family plans — even if hinted at. Skip those items.
3. Never invent facts, employers, places, or links. Do not use outside knowledge about the person or brands beyond what the quote says.
4. Prefer specific over generic ("trail running in the Marin Headlands" beats "fitness"). The quote must contain the words that justify the label (for a hiking hobby, quote the hike itself, not just a distance).
5. Be thorough: go through EVERY item and capture each distinct hobby, interest, activity, need and quality it evidences — Instagram captions usually reveal the personal side (food, sports, books, music, travel, rituals, causes). Do not stop at the professional profile.
6. "unknowns": list 3–6 things a dating agent would want to know that the sources do NOT answer (e.g. "What they enjoy on weekends — sources are all professional", "Whether the hiking posts are recent or occasional").
7. Write "label", "detail", "headline", "summary" and "unknowns" in English even when the source is in another language; the "quote" stays in the original language, copied exactly.
8. Keep "professional" to at most 8 observations (the most telling roles, not every listed skill); spend the rest on hobbies, interests, activities, needs and qualities — read every Instagram caption for these.
9. headline: one line (≤ 90 chars) in neutral third person from the evidence. summary: 2–3 sentences, neutral, only from the evidence, mention when sources are thin.

Return ONLY JSON:
{"headline": string, "summary": string, "observations": [{"category": one of ${OBSERVATION_CATEGORIES.join("|")}, "label": short noun phrase, "detail": one sentence explaining what the evidence shows, "item_id": string, "quote": string}], "unknowns": [string]}
Aim for 12–24 observations when the evidence supports it; fewer is fine when sources are thin. Output the JSON only — no commentary.`;

export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `quote` appears verbatim (modulo whitespace, case and typographic punctuation) in `text`. */
export function quoteIsVerbatim(quote: string, text: string): boolean {
  const q = normalizeForMatch(quote).replace(/^["'.…\s]+|["'.…\s]+$/g, "");
  return q.length >= 3 && normalizeForMatch(text).includes(q);
}

const SENSITIVE = /\b(gay|lesbian|bisexual|queer|straight|heterosexual|homosexual|sexual|sexuality|single|married|divorced|widow|girlfriend|boyfriend|husband|wife|partner'?s?|dating|religio\w*|church|mosque|temple|christian|muslim|hindu|jewish|atheist|pregnan\w*|disab\w*|diagnos\w*|therapy|depress\w*|anxiety|ethnic\w*|race|racial|politic\w*|democrat|republican|salary|income|debt)\b/i;

export function validateAnalysis(raw: unknown, items: SourceItem[]): AnalysisResult {
  if (!raw || typeof raw !== "object") throw new Error("expected a JSON object");
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.observations)) throw new Error('"observations" must be an array');
  const byId = new Map(items.map((i) => [i.id, i]));
  const kept: DraftObservation[] = [];
  let dropped = 0;
  const seen = new Set<string>();
  for (const o of r.observations as Record<string, unknown>[]) {
    const category = String(o?.category ?? "") as ObservationCategory;
    const label = String(o?.label ?? "").trim().slice(0, 80);
    const detail = String(o?.detail ?? "").trim().slice(0, 300);
    const itemId = String(o?.item_id ?? "").trim();
    const quote = String(o?.quote ?? "").trim().slice(0, 400);
    const item = byId.get(itemId);
    const ok =
      OBSERVATION_CATEGORIES.includes(category) &&
      label &&
      item &&
      quoteIsVerbatim(quote, item.text) &&
      !SENSITIVE.test(`${label} ${detail}`);
    const key = `${category}:${label.toLowerCase()}`;
    if (!ok || seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);
    kept.push({ category, label, detail, item_id: itemId, quote });
  }
  if (items.length > 0 && kept.length === 0 && (r.observations as unknown[]).length > 0) {
    throw new Error("none of the observations quoted an item verbatim; copy quotes exactly from the item text and use the exact item_id");
  }
  const unknowns = Array.isArray(r.unknowns) ? (r.unknowns as unknown[]).map((u) => String(u).slice(0, 200)).filter(Boolean).slice(0, 8) : [];
  return {
    headline: String(r.headline ?? "").slice(0, 120),
    summary: String(r.summary ?? "").slice(0, 800),
    observations: kept.slice(0, 30),
    unknowns,
    dropped,
  };
}

export function renderItems(items: SourceItem[]): string {
  return items.map((i) => `[${i.id}] (${i.platform} · ${i.field}) ${i.text}`).join("\n");
}

export async function analyzePerson(llm: LLM, displayName: string, items: SourceItem[]): Promise<AnalysisResult> {
  const linkedin = items.filter((i) => i.platform === "linkedin").length;
  const instagram = items.filter((i) => i.platform === "instagram").length;
  const user = `Person: ${displayName}
Source coverage: ${linkedin} LinkedIn items, ${instagram} Instagram items.${linkedin === 0 ? " LinkedIn could not be read — say so in unknowns." : ""}${instagram === 0 ? " Instagram could not be read — say so in unknowns." : ""}

SOURCE ITEMS:
${renderItems(items)}`;
  return completeJson(llm, { system: SYSTEM, messages: [{ role: "user", content: user }], maxTokens: 6000, temperature: 0.2 }, (v) =>
    validateAnalysis(v, items),
  );
}
