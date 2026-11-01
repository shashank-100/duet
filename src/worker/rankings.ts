// Per-person ranking. Each person's score for a partner = the evaluator's weighted dimensions
// plus how well that partner fits the person's OWN stated priorities (so A's and B's views differ).

import { DIMENSIONS, PRIORITY_FIT_WEIGHT, type Assessment, type Ranking, type RankingEntry } from "../shared/types";
import { getSummary } from "./db";

type Row = Record<string, unknown>;

export const WEIGHTS = [
  ...DIMENSIONS.map((d) => ({ key: d.key as string, label: d.label, weight: d.weight, help: d.help })),
  { key: "priority_fit", label: "Fit with their own stated priorities", weight: PRIORITY_FIT_WEIGHT, help: "How well the partner matches what this person said they prioritise. Differs for each side of the same date." },
];

export function entryFrom(row: Row, side: "a" | "b"): RankingEntry {
  const partnerPrefix = side === "a" ? "b" : "a";
  const partner = {
    id: String(row[`${partnerPrefix}_id`]),
    display_name: String(row[`${partnerPrefix}_name`]),
    kind: row[`${partnerPrefix}_kind`] as "demo" | "real",
    headline: String(row[`${partnerPrefix}_headline`] ?? ""),
  };
  const status = row.status === "complete" && row.data ? "ranked" : row.status === "failed" ? "failed" : "pending";
  if (status !== "ranked") {
    return { partner, date_id: String(row.id), status, score: null, breakdown: [], confidence: null, summary: null, shared_interests: [], possible_friction: [] };
  }
  const a = JSON.parse(String(row.data)) as Assessment;
  const breakdown = [
    ...DIMENSIONS.map((d) => ({ key: d.key as string, label: d.label, weight: d.weight, score: a.dimensions[d.key].score, rationale: a.dimensions[d.key].rationale })),
    { key: "priority_fit", label: "Fit with their own stated priorities", weight: PRIORITY_FIT_WEIGHT, score: a.priority_fit[side].score, rationale: a.priority_fit[side].rationale },
  ];
  return {
    partner,
    date_id: String(row.id),
    status,
    score: Number(side === "a" ? row.score_a : row.score_b),
    breakdown,
    confidence: a.confidence,
    summary: a.summary,
    shared_interests: a.shared_interests,
    possible_friction: a.possible_friction,
  };
}

export function sortEntries(entries: RankingEntry[]): RankingEntry[] {
  const order = { ranked: 0, pending: 1, failed: 2 } as const;
  return [...entries].sort((x, y) => order[x.status] - order[y.status] || (y.score ?? 0) - (x.score ?? 0) || x.partner.display_name.localeCompare(y.partner.display_name));
}

export async function rankingFor(db: D1Database, participantId: string): Promise<Ranking | null> {
  const participant = await getSummary(db, participantId);
  if (!participant) return null;
  const { results } = await db
    .prepare(
      `SELECT d.id, d.pool, d.status, d.a_id, d.b_id, pa.display_name AS a_name, pa.kind AS a_kind, pb.display_name AS b_name, pb.kind AS b_kind,
         COALESCE(fa.headline,'') AS a_headline, COALESCE(fb.headline,'') AS b_headline, s.data, s.score_a, s.score_b
       FROM dates d JOIN participants pa ON pa.id = d.a_id JOIN participants pb ON pb.id = d.b_id
       LEFT JOIN profiles fa ON fa.participant_id = d.a_id LEFT JOIN profiles fb ON fb.participant_id = d.b_id
       LEFT JOIN assessments s ON s.date_id = d.id
       WHERE d.a_id = ?1 OR d.b_id = ?1`,
    )
    .bind(participantId)
    .all<Row>();
  const main: RankingEntry[] = [];
  const practice: RankingEntry[] = [];
  for (const r of results) {
    const e = entryFrom(r, r.a_id === participantId ? "a" : "b");
    (r.pool === "practice" ? practice : main).push(e);
  }
  return { participant, entries: sortEntries(main), practice: sortEntries(practice), weights: WEIGHTS };
}
