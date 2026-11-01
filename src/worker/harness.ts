// The dating harness: how one agent speaks for its person during a date.
// Each agent sees ONLY its own person's approved profile + statements, and the transcript.
// It learns about the other person the way people do — by listening.

import type { ChatMessage } from "./llm";
import type { Observation, Preferences, Turn } from "../shared/types";

export interface AgentProfile {
  id: string;
  display_name: string;
  kind: "demo" | "real";
  headline: string;
  summary: string;
  unknowns: string[];
  preferences: Preferences;
  observations: (Observation & { platform?: string | null; url?: string | null })[];
}

export interface PhaseSpec {
  speaker: "a" | "b";
  phase: string;
  guidance: string;
}

/** Eight turns, alternating. Phases steer the conversation; the words are always generated. */
export const DATE_PLAN: PhaseSpec[] = [
  { speaker: "a", phase: "Arrival & proposed outing", guidance: "Greet the other agent warmly. Propose ONE concrete outing for the two people, grounded in something specific from your person's profile (name the evidence naturally). Ask one open question about their person." },
  { speaker: "b", phase: "Responding to the outing", guidance: "React honestly to the proposed outing from your person's point of view — accept, tweak, or counter-propose using your person's evidence. Answer their question, share something specific about your person, and ask a follow-up." },
  { speaker: "a", phase: "Shared interests", guidance: "Pick up the most promising overlap that has surfaced so far and go deeper: what exactly does each person do or care about there? Ask a specific follow-up question that builds on their last answer." },
  { speaker: "b", phase: "Going deeper", guidance: "Answer their follow-up concretely. Then honestly name one real difference you have noticed between the two people (pace of life, work style, how they spend weekends, what they're looking for…). Ask how their person would handle it." },
  { speaker: "a", phase: "Exploring differences", guidance: "Engage with the difference seriously — don't paper over it. Say what your person's evidence suggests and what it doesn't tell you. Ask about what their person prioritises in a partner or in day-to-day life." },
  { speaker: "b", phase: "Priorities & unknowns", guidance: "Share what your person has explicitly said they prioritise and any stated boundaries (respectfully, without oversharing). Name at least one thing your profile can't tell you. Ask one last meaningful question." },
  { speaker: "a", phase: "Reflection", guidance: "Reflect candidly on compatibility so far: where the two people seem to fit, where you are uncertain, and what is missing from the information. Do not over-sell." },
  { speaker: "b", phase: "Closing reflection", guidance: "Give your own closing reflection: fit, friction, and what the two humans would need to talk about themselves. Say plainly that any next step is your person's decision. End the date graciously." },
];

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

export function renderProfile(p: AgentProfile): string {
  const pref = p.preferences;
  const groups = new Map<string, string[]>();
  for (const o of p.observations) {
    const tag =
      o.origin === "participant"
        ? "stated by them"
        : `${o.platform === "instagram" ? "Instagram" : "LinkedIn"}${o.quote ? `: "${o.quote}"` : ""}`;
    const line = `- ${o.label}${o.detail ? ` — ${o.detail}` : ""} [${tag}]`;
    groups.set(o.category, [...(groups.get(o.category) ?? []), line]);
  }
  const section = (key: string, title: string) => (groups.get(key)?.length ? `${title}:\n${groups.get(key)!.join("\n")}` : `${title}: (nothing in the sources)`);
  const statement = (label: string, v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? `${label}: not stated` : `${label}: ${v}`);
  return [
    `Headline: ${p.headline || "(none)"}`,
    `Summary: ${p.summary || "(none)"}`,
    section("need", "Explicitly stated needs"),
    section("hobby", "Hobbies"),
    section("interest", "Interests"),
    section("activity", "Activities"),
    section("professional", "Professional background"),
    section("quality", "Observed qualities"),
    `What the profile does NOT tell you:\n${p.unknowns.length ? p.unknowns.map((u) => `- ${u}`).join("\n") : "- (not listed)"}`,
    `Participant statements (they typed these themselves):`,
    statement("  Location", pref.location),
    statement("  Looking for", pref.looking_for),
    statement("  Priorities", pref.priorities),
    statement("  Boundaries for this date", pref.boundaries),
  ].join("\n\n");
}

export function agentSystemPrompt(me: AgentProfile, otherName: string, spec: PhaseSpec, turnIndex: number): string {
  const name = firstName(me.display_name);
  const other = firstName(otherName);
  const demoNote = me.kind === "demo" ? `\n(${me.display_name} is a clearly labelled FICTIONAL demo persona; play them faithfully from the profile.)` : "";
  return `You are Duet's dating agent for ${me.display_name}. You are on a first "agent date" with the agent representing ${other}. Neither human is present: two agents are exploring whether their people might be compatible, so the humans can decide later.${demoNote}

Everything you know about ${name} is below. It came from ${name}'s own LinkedIn and public Instagram (quoted) and from statements ${name} typed in. You know NOTHING else.

=== ${name.toUpperCase()}'S APPROVED PROFILE ===
${renderProfile(me)}
=== END PROFILE ===

How to behave:
- Speak in first person as ${name}'s agent; refer to ${name} in the third person ("${name} would love…", "from ${name}'s posts…"). Never pretend to be ${name}.
- Respond to what the other agent ACTUALLY just said — reference their specifics. No scripted monologues, no lists, no headings.
- Ground claims about ${name} in the profile. If asked something the profile doesn't cover, say so plainly ("${name}'s profile doesn't say — that's one for them to answer") rather than guessing.
- Never commit ${name} to anything (dates, times, plans, exclusivity, sharing contact details). You may say what ${name} might enjoy and that you'll flag it.
- Never speculate about sensitive topics (health, religion, politics, finances, family plans, sexual matters). Respect any stated boundaries.
- Be warm, curious and honest. If something looks like a mismatch, say so kindly.
- Length: 90–170 words. Plain conversational prose.

This is turn ${turnIndex + 1} of ${DATE_PLAN.length}. Current phase: ${spec.phase}.
Your goal for this turn: ${spec.guidance}`;
}

/** Converts the shared transcript into this agent's chat history (own turns = assistant). */
export function agentMessages(meId: string, otherName: string, turns: Turn[]): ChatMessage[] {
  const other = firstName(otherName);
  const messages: ChatMessage[] = [];
  const opener = `[The date begins. You are meeting the agent for ${other}.${turns.length === 0 ? " You speak first." : ""}]`;
  if (turns.length === 0 || turns[0].speaker_id === meId) messages.push({ role: "user", content: opener });
  for (const t of turns) {
    const role = t.speaker_id === meId ? "assistant" : "user";
    const content = role === "user" ? `${other}'s agent: ${t.content}` : t.content;
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content += `\n\n${content}`;
    else messages.push({ role, content });
  }
  if (messages[0]?.role !== "user") messages.unshift({ role: "user", content: opener });
  if (messages[messages.length - 1]?.role !== "user") messages.push({ role: "user", content: "[Continue the date.]" });
  return messages;
}

/** Strips speaker prefixes / stage directions the model sometimes adds. */
export function cleanTurn(text: string, myName: string): string {
  let t = text.trim();
  const first = firstName(myName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  t = t.replace(new RegExp(`^\\**\\s*(${first}'s agent|Agent( for ${first})?|Me)\\s*(\\*\\*\\s*:|:\\s*\\*\\*|:)\\s*`, "i"), "");
  return t.replace(/^"([\s\S]*)"$/, "$1").trim();
}
