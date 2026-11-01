// Separate evaluator: reads the finished transcript + both profiles and produces a structured,
// evidence-backed compatibility assessment. Excerpts must be verbatim from the transcript.

import { DIMENSIONS, PRIORITY_FIT_WEIGHT, type Assessment, type DimensionScore, type Turn } from "../shared/types";
import { quoteIsVerbatim } from "./analysis";
import { renderProfile, type AgentProfile } from "./harness";
import { completeJson, type LLM } from "./llm";

const SYSTEM = `You are Duet's compatibility evaluator. You did not take part in the date. You read a transcript between two dating agents (each representing one consenting adult) plus both approved profiles, and you write a careful, exploratory assessment. Scores are rubric judgements about this conversation and these profiles — not predictions of real-world romance — so be calibrated: use the full 0–10 range, reserve 8+ for clear, evidenced fit, and score low when evidence is thin or friction is real.

Dimensions (0–10 each, with a one–two sentence rationale citing what was said):
${DIMENSIONS.map((d) => `- ${d.key}: ${d.help}`).join("\n")}
priority_fit.a / priority_fit.b: how well the OTHER person fits what A (resp. B) explicitly stated as priorities/looking for. If a person stated no priorities, score 5 and say so.

Also return:
- shared_interests: specific overlaps that were evidenced (short phrases).
- possible_friction: specific differences or tensions that came up.
- uncertainties: what remains unknown or was only assumed (be concrete).
- excerpts: 3–6 items {"turn": turn number as shown, "quote": text copied VERBATIM from that turn (8–40 words), "why": what it shows}.
- next_steps: 2–4 suggestions for the two HUMANS (e.g. topics to ask each other, a low-stakes first meeting idea). Never decide for them.
- summary: 2–3 sentences.
- confidence: "low" | "medium" | "high" — how much evidence the assessment rests on.

Return ONLY JSON with keys: summary, dimensions {${DIMENSIONS.map((d) => `"${d.key}": {"score", "rationale"}`).join(", ")}}, priority_fit {"a": {"score","rationale"}, "b": {"score","rationale"}}, shared_interests, possible_friction, uncertainties, excerpts, next_steps, confidence.`;

function dim(v: unknown, path: string): DimensionScore {
  const o = v as { score?: unknown; rationale?: unknown } | undefined;
  const score = Number(o?.score);
  if (!Number.isFinite(score) || score < 0 || score > 10) throw new Error(`${path}.score must be a number 0–10`);
  return { score: Math.round(score * 10) / 10, rationale: String(o?.rationale ?? "").slice(0, 500) };
}

const strings = (v: unknown, max = 8) => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 300)).filter(Boolean).slice(0, max) : []);

export function validateAssessment(raw: unknown, turns: Turn[]): Assessment {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== "object") throw new Error("expected a JSON object");
  const dims = r.dimensions as Record<string, unknown> | undefined;
  if (!dims) throw new Error('"dimensions" is missing');
  const dimensions = Object.fromEntries(DIMENSIONS.map((d) => [d.key, dim(dims[d.key], `dimensions.${d.key}`)])) as Assessment["dimensions"];
  const pf = r.priority_fit as Record<string, unknown> | undefined;
  const priority_fit = { a: dim(pf?.a, "priority_fit.a"), b: dim(pf?.b, "priority_fit.b") };
  let dropped = 0;
  const excerpts: Assessment["excerpts"] = [];
  for (const e of Array.isArray(r.excerpts) ? (r.excerpts as Record<string, unknown>[]) : []) {
    const turnNo = Number(e?.turn);
    const quote = String(e?.quote ?? "").trim();
    // Accept the stated turn number, or find the turn that actually contains the quote.
    const turn = turns.find((t) => t.idx + 1 === turnNo && quoteIsVerbatim(quote, t.content)) ?? turns.find((t) => quoteIsVerbatim(quote, t.content));
    if (!turn || quote.length < 8) {
      dropped++;
      continue;
    }
    excerpts.push({ turn: turn.idx + 1, quote: quote.replace(/^["“]|["”]$/g, ""), why: String(e?.why ?? "").slice(0, 300) });
  }
  if (excerpts.length === 0) throw new Error("no excerpt was copied verbatim from the transcript; quote the exact words of a turn");
  const confidence = ["low", "medium", "high"].includes(String(r.confidence)) ? (r.confidence as Assessment["confidence"]) : "low";
  return {
    summary: String(r.summary ?? "").slice(0, 800),
    dimensions,
    priority_fit,
    shared_interests: strings(r.shared_interests),
    possible_friction: strings(r.possible_friction),
    uncertainties: strings(r.uncertainties),
    excerpts: excerpts.slice(0, 6),
    next_steps: strings(r.next_steps, 4),
    confidence,
    dropped_excerpts: dropped,
  };
}

/** Score (0–100) for one side: weighted dimensions plus that person's own priority fit. */
export function personalScore(a: Assessment, side: "a" | "b"): number {
  const base = DIMENSIONS.reduce((sum, d) => sum + d.weight * a.dimensions[d.key].score, 0);
  const total = base + PRIORITY_FIT_WEIGHT * a.priority_fit[side].score;
  return Math.round(total * 10 * 10) / 10;
}

export async function evaluateDate(llm: LLM, a: AgentProfile, b: AgentProfile, turns: Turn[]): Promise<Assessment> {
  const transcript = turns
    .map((t) => `Turn ${t.idx + 1} — ${t.speaker_id === a.id ? `A (${a.display_name}'s agent)` : `B (${b.display_name}'s agent)`}: ${t.content}`)
    .join("\n\n");
  const user = `PERSON A: ${a.display_name}\n${renderProfile(a)}\n\nPERSON B: ${b.display_name}\n${renderProfile(b)}\n\nTRANSCRIPT:\n${transcript}`;
  return completeJson(llm, { system: SYSTEM, messages: [{ role: "user", content: user }], maxTokens: 2500, temperature: 0.2 }, (v) =>
    validateAssessment(v, turns),
  );
}
