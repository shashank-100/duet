// Types shared by the Worker API and the React client.

export type ParticipantKind = "demo" | "real";
export type Platform = "linkedin" | "instagram";

export type ParticipantStatus =
  | "submitted"
  | "retrieving"
  | "analyzing"
  | "needs_sources"
  | "draft_ready"
  | "approved"
  | "paused"
  | "error";

export const OBSERVATION_CATEGORIES = [
  "need",
  "hobby",
  "interest",
  "activity",
  "professional",
  "quality",
] as const;
export type ObservationCategory = (typeof OBSERVATION_CATEGORIES)[number];

export const GENDERS = ["woman", "man", "nonbinary"] as const;
export type Gender = (typeof GENDERS)[number];

export interface Preferences {
  age: number | null;
  gender: Gender | null;
  open_to: Gender[];
  age_min: number | null;
  age_max: number | null;
  location: string | null;
  looking_for: string | null;
  priorities: string | null;
  boundaries: string | null;
}

export interface SourceItem {
  id: string;
  platform: Platform;
  field: string;
  url: string;
  text: string;
}

export interface SourceDocument {
  id: string;
  platform: Platform;
  method: string;
  url: string;
  status: "ok" | "empty" | "blocked" | "private" | "not_found" | "not_configured" | "error";
  http_status: number | null;
  detail: string | null;
  item_count: number;
  created_at: string;
}

export interface Observation {
  id: string;
  category: ObservationCategory;
  label: string;
  detail: string;
  origin: "sourced" | "participant";
  source_item_id: string | null;
  quote: string | null;
  edited: boolean;
  source?: { platform: Platform; url: string; field: string } | null;
}

export interface ParticipantSummary {
  id: string;
  kind: ParticipantKind;
  display_name: string;
  linkedin_url: string;
  instagram_url: string;
  status: ParticipantStatus;
  status_detail: string | null;
  dating_enabled: boolean;
  headline: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface ProfileDetail extends ParticipantSummary {
  summary: string;
  unknowns: string[];
  analysis_model: string | null;
  analyzed_at: string | null;
  dropped_claims: number;
  preferences: Preferences;
  observations: Observation[];
  sources: SourceDocument[];
  items: SourceItem[];
  events: { step: string; status: string; message: string; at: string }[];
  is_owner: boolean;
}

export interface Turn {
  idx: number;
  speaker_id: string;
  phase: string;
  content: string;
  created_at: string;
}

export interface DimensionScore {
  score: number;
  rationale: string;
}

export interface Assessment {
  summary: string;
  dimensions: Record<DimensionKey, DimensionScore>;
  priority_fit: { a: DimensionScore; b: DimensionScore };
  shared_interests: string[];
  possible_friction: string[];
  uncertainties: string[];
  excerpts: { turn: number; quote: string; why: string }[];
  next_steps: string[];
  confidence: "low" | "medium" | "high";
  dropped_excerpts: number;
}

export const DIMENSIONS = [
  { key: "shared_interests", label: "Shared interests", weight: 0.25, help: "Overlap in hobbies, interests and activities that surfaced in the conversation." },
  { key: "values_alignment", label: "Values & priorities", weight: 0.2, help: "How well what each person says matters to them lines up." },
  { key: "conversation_rapport", label: "Conversational rapport", weight: 0.15, help: "Whether the agents built on each other's points, curiosity and warmth." },
  { key: "lifestyle_logistics", label: "Lifestyle & logistics", weight: 0.15, help: "Location, schedules, pace of life and the proposed outing." },
  { key: "difference_manageability", label: "Manageable differences", weight: 0.1, help: "Whether the differences that came up look workable or like friction." },
] as const;
export type DimensionKey = (typeof DIMENSIONS)[number]["key"];
/** Weight of "fit with this person's own stated priorities" in their personal ranking. */
export const PRIORITY_FIT_WEIGHT = 0.15;

export interface DateSummary {
  id: string;
  pool: "demo" | "real" | "practice";
  status: "queued" | "starting" | "running" | "evaluating" | "complete" | "failed";
  error: string | null;
  a: { id: string; display_name: string; kind: ParticipantKind };
  b: { id: string; display_name: string; kind: ParticipantKind };
  turn_count: number;
  created_at: string;
  completed_at: string | null;
  score_a: number | null;
  score_b: number | null;
}

export interface DateDetail extends DateSummary {
  turns: Turn[];
  assessment: Assessment | null;
  model: string | null;
  plan: { phase: string; speaker: "a" | "b" }[];
}

export interface RankingEntry {
  partner: { id: string; display_name: string; kind: ParticipantKind; headline: string };
  date_id: string | null;
  status: "ranked" | "pending" | "failed";
  score: number | null;
  breakdown: { key: string; label: string; weight: number; score: number; rationale: string }[];
  confidence: Assessment["confidence"] | null;
  summary: string | null;
  shared_interests: string[];
  possible_friction: string[];
}

export interface Ranking {
  participant: ParticipantSummary;
  entries: RankingEntry[];
  practice: RankingEntry[];
  weights: { key: string; label: string; weight: number; help: string }[];
}
