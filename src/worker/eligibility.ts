// Who may date whom. Uses ONLY what participants explicitly stated; unstated means "no constraint".

import type { Preferences } from "../shared/types";

export interface Candidate {
  id: string;
  kind: "demo" | "real";
  approved: boolean;
  dating_enabled: boolean;
  preferences: Preferences;
}

function accepts(p: Preferences, other: Preferences): boolean {
  if (p.open_to.length && other.gender && !p.open_to.includes(other.gender)) return false;
  // If someone set an open_to list and the other person did not state a gender, we can't confirm a match.
  if (p.open_to.length && !other.gender) return false;
  if (other.age !== null) {
    if (p.age_min !== null && other.age < p.age_min) return false;
    if (p.age_max !== null && other.age > p.age_max) return false;
  }
  return true;
}

export function mutuallyEligible(x: Candidate, y: Candidate): boolean {
  if (x.id === y.id) return false;
  if (!x.approved || !y.approved || !x.dating_enabled || !y.dating_enabled) return false;
  if (x.kind !== y.kind) return false;
  if (x.preferences.age !== null && x.preferences.age < 18) return false;
  if (y.preferences.age !== null && y.preferences.age < 18) return false;
  return accepts(x.preferences, y.preferences) && accepts(y.preferences, x.preferences);
}

/** Pairs (ordered by id for a stable a/b) that need a date and don't have one yet. */
export function pairsToSchedule(newcomer: Candidate, others: Candidate[], existing: Set<string>): [string, string][] {
  const out: [string, string][] = [];
  for (const o of others) {
    if (!mutuallyEligible(newcomer, o)) continue;
    const [a, b] = [newcomer.id, o.id].sort();
    if (existing.has(`${a}|${b}`)) continue;
    out.push([a, b]);
  }
  return out;
}
