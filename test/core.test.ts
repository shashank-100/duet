import { describe, expect, it } from "vitest";
import { normalizeInstagram, normalizeLinkedIn } from "../src/worker/retrieval/urls";
import { quoteIsVerbatim, validateAnalysis } from "../src/worker/analysis";
import { personalScore, validateAssessment } from "../src/worker/evaluator";
import { mutuallyEligible, pairsToSchedule, type Candidate } from "../src/worker/eligibility";
import { fixInstagramText, parseCsv, parseInstagramExport, parseLinkedInExport } from "../src/worker/retrieval/exports";
import { parseInstagramHtml, parseLinkedInHtml } from "../src/worker/retrieval/direct";
import { instagramItems, linkedInItems } from "../src/worker/retrieval/apify";
import { DATE_PLAN, agentMessages, agentSystemPrompt, cleanTurn, type AgentProfile } from "../src/worker/harness";
import { extractJson, sseData } from "../src/worker/llm";
import { PERSONAS } from "../src/worker/demo/personas";
import { personaSources } from "../src/worker/demo/seed";
import type { Preferences, SourceItem, Turn } from "../src/shared/types";

const prefs = (p: Partial<Preferences>): Preferences => ({
  age: 30, gender: null, open_to: [], age_min: null, age_max: null, location: null, looking_for: null, priorities: null, boundaries: null, ...p,
});
const cand = (id: string, p: Partial<Preferences>, extra: Partial<Candidate> = {}): Candidate => ({ id, kind: "real", approved: true, dating_enabled: true, preferences: prefs(p), ...extra });

describe("link normalization", () => {
  it("accepts and canonicalizes profile links, including stray whitespace", () => {
    expect(normalizeInstagram("  https://www.instagram.com/Souza.Yumii/ ")).toBe("https://www.instagram.com/souza.yumii/");
    expect(normalizeInstagram("instagram.com/jobs_with.ai")).toBe("https://www.instagram.com/jobs_with.ai/");
    expect(normalizeLinkedIn("https://in.linkedin.com/in/some-person-123")).toBe("https://www.linkedin.com/in/some-person-123/");
  });
  it("rejects posts, other sites and malformed input with actionable messages", () => {
    expect(() => normalizeInstagram("https://www.instagram.com/p/abc123/")).toThrow(/profile link/);
    expect(() => normalizeInstagram("https://evil.com/user")).toThrow(/instagram\.com/);
    expect(() => normalizeLinkedIn("https://www.linkedin.com/company/acme")).toThrow(/\/in\//);
    expect(() => normalizeLinkedIn("")).toThrow(/required/);
  });
});

const items: SourceItem[] = [
  { id: "LI1", platform: "linkedin", field: "about", url: "u", text: "I lead community workshops across Brooklyn and love transit design." },
  { id: "IG1", platform: "instagram", field: "post", url: "u", text: "Sunday ritual: 7am run through Prospect Park, then sourdough." },
];

describe("analysis evidence validation", () => {
  it("matches quotes verbatim modulo case, whitespace and curly quotes", () => {
    expect(quoteIsVerbatim("7AM run through  Prospect Park", items[1].text)).toBe(true);
    expect(quoteIsVerbatim("runs marathons", items[1].text)).toBe(false);
  });
  it("keeps quoted claims and drops invented, mis-cited and sensitive ones", () => {
    const r = validateAnalysis(
      {
        headline: "Planner",
        summary: "s",
        observations: [
          { category: "activity", label: "Community workshops", detail: "d", item_id: "LI1", quote: "I lead community workshops across Brooklyn" },
          { category: "hobby", label: "Running", detail: "d", item_id: "IG1", quote: "run through Prospect Park" },
          { category: "hobby", label: "Marathons", detail: "d", item_id: "IG1", quote: "training for a marathon" },
          { category: "hobby", label: "Baking", detail: "d", item_id: "LI1", quote: "sourdough" },
          { category: "need", label: "Looking for a girlfriend", detail: "d", item_id: "IG1", quote: "Sunday ritual" },
          { category: "astrology", label: "x", detail: "d", item_id: "IG1", quote: "Sunday ritual" },
        ],
        unknowns: ["What they do on weekday evenings"],
      },
      items,
    );
    expect(r.observations.map((o) => o.label)).toEqual(["Community workshops", "Running"]);
    expect(r.dropped).toBe(4);
    expect(r.unknowns).toHaveLength(1);
  });
  it("asks the model to retry when nothing is quotable", () => {
    expect(() => validateAnalysis({ observations: [{ category: "hobby", label: "x", item_id: "IG1", quote: "not there at all" }] }, items)).toThrow(/verbatim/);
  });
});

const turns: Turn[] = DATE_PLAN.map((p, i) => ({
  idx: i,
  speaker_id: p.speaker === "a" ? "A" : "B",
  phase: p.phase,
  content: `Turn ${i} content: Maya would love a picnic at the community garden, and I'd flag that she hasn't said anything about weekday evenings.`,
  created_at: "",
}));
const dims = (s: number) => ({
  shared_interests: { score: s, rationale: "r" },
  values_alignment: { score: s, rationale: "r" },
  conversation_rapport: { score: s, rationale: "r" },
  lifestyle_logistics: { score: s, rationale: "r" },
  difference_manageability: { score: s, rationale: "r" },
});

describe("evaluator", () => {
  it("validates scores, keeps only verbatim excerpts and reassigns wrong turn numbers", () => {
    const a = validateAssessment(
      {
        summary: "s",
        dimensions: dims(7),
        priority_fit: { a: { score: 8, rationale: "r" }, b: { score: 4, rationale: "r" } },
        excerpts: [
          { turn: 99, quote: "Maya would love a picnic at the community garden", why: "w" },
          { turn: 2, quote: "they kissed under the stars", why: "invented" },
        ],
        confidence: "medium",
      },
      turns,
    );
    expect(a.excerpts).toHaveLength(1);
    expect(a.excerpts[0].turn).toBe(1);
    expect(a.dropped_excerpts).toBe(1);
  });
  it("rejects out-of-range scores", () => {
    expect(() => validateAssessment({ dimensions: dims(11), priority_fit: { a: { score: 1 }, b: { score: 1 } }, excerpts: [] }, turns)).toThrow(/0–10/);
  });
  it("computes per-person scores that differ by each side's priority fit and sum weights to 1", () => {
    const a = validateAssessment(
      { dimensions: dims(6), priority_fit: { a: { score: 10, rationale: "" }, b: { score: 0, rationale: "" } }, excerpts: [{ turn: 1, quote: "Maya would love a picnic", why: "" }] },
      turns,
    );
    expect(personalScore(a, "a")).toBe(66);
    expect(personalScore(a, "b")).toBe(51);
    const all10 = validateAssessment({ dimensions: dims(10), priority_fit: { a: { score: 10 }, b: { score: 10 } }, excerpts: [{ turn: 1, quote: "Maya would love a picnic", why: "" }] }, turns);
    expect(personalScore(all10, "a")).toBe(100);
  });
});

describe("eligibility", () => {
  it("requires mutual, stated compatibility and approval", () => {
    const w = cand("w", { gender: "woman", open_to: ["man"], age: 30, age_min: 28, age_max: 36 });
    const m = cand("m", { gender: "man", open_to: ["woman"], age: 33 });
    const m2 = cand("m2", { gender: "man", open_to: ["man"], age: 33 });
    const old = cand("old", { gender: "man", open_to: ["woman"], age: 45 });
    expect(mutuallyEligible(w, m)).toBe(true);
    expect(mutuallyEligible(w, m2)).toBe(false);
    expect(mutuallyEligible(w, old)).toBe(false);
    expect(mutuallyEligible(w, { ...m, approved: false })).toBe(false);
    expect(mutuallyEligible(w, { ...m, kind: "demo" })).toBe(false);
  });
  it("does not match someone with an open_to list against an unstated gender", () => {
    expect(mutuallyEligible(cand("a", { open_to: ["woman"] }), cand("b", {}))).toBe(false);
    expect(mutuallyEligible(cand("a", {}), cand("b", {}))).toBe(true);
  });
  it("schedules each pair once with a stable order", () => {
    const a = cand("b-id", {});
    const others = [cand("a-id", {}), cand("c-id", {})];
    expect(pairsToSchedule(a, others, new Set(["a-id|b-id"]))).toEqual([["b-id", "c-id"]]);
  });
});

describe("data exports", () => {
  it("parses LinkedIn CSVs with notes headers and quoted commas, ignoring private fields", () => {
    const profile = 'First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location\nAva,Lee,,"1 Main St, Apt 2",Jan 1,"Designer, maker","Builds furniture",Design,10001,"Brooklyn, NY"';
    const positions = 'Notes:\n"This file has notes"\n\nCompany Name,Title,Description,Location,Started On,Finished On\nAcme,Designer,"Leads, ships",NYC,Jan 2020,';
    const out = parseLinkedInExport([{ name: "Basic_LinkedInDataExport/Profile.csv", text: profile }, { name: "Positions.csv", text: positions }], "https://www.linkedin.com/in/ava/");
    const text = out.map((i) => i.text).join(" | ");
    expect(text).toContain("Designer, maker");
    expect(text).toContain("Designer at Acme (Jan 2020 – present): Leads, ships");
    expect(text).not.toContain("Main St");
    expect(text).not.toContain("Jan 1");
  });
  it("parses Instagram JSON exports and repairs their UTF-8 mojibake", () => {
    expect(fixInstagramText("cafÃ©")).toBe("café");
    const out = parseInstagramExport(
      [
        { name: "personal_information/personal_information/personal_information.json", text: JSON.stringify({ profile_user: [{ string_map_data: { Bio: { value: "pottery ð\u009f\u008fº" }, Email: { value: "x@y.z" } } }] }) },
        { name: "your_instagram_activity/content/posts_1.json", text: JSON.stringify([{ media: [{ title: "Old post", creation_timestamp: 1 }] }, { title: "New post", creation_timestamp: 1700000000 }]) },
      ],
      "https://www.instagram.com/ava/",
    );
    expect(out[0]).toMatchObject({ field: "bio", text: "pottery 🏺" });
    expect(out[1].text).toContain("New post");
    expect(JSON.stringify(out)).not.toContain("x@y.z");
  });
  it("handles a CSV without a trailing newline", () => {
    expect(parseCsv("Name\nFigma\nSQL")).toEqual([{ Name: "Figma" }, { Name: "SQL" }]);
  });
});

describe("retrieval parsers", () => {
  it("reads only the display name from logged-out Instagram HTML", () => {
    const html = `<meta property="og:title" content="Ava Lee (&#064;ava) &#x2022; Instagram photos and videos" /><meta property="og:description" content="12 Followers" />`;
    expect(parseInstagramHtml(html, "u")).toEqual([{ field: "name", url: "u", text: "Ava Lee" }]);
  });
  it("reads LinkedIn JSON-LD when present and ignores sign-in walls", () => {
    const ld = `<script type="application/ld+json">{"@graph":[{"@type":"Person","name":"Ava Lee","jobTitle":"Designer","description":"I make chairs."}]}</script>`;
    expect(parseLinkedInHtml(ld, "u").map((i) => i.field)).toEqual(["name", "headline", "about"]);
    expect(parseLinkedInHtml(`<meta property="og:title" content="Sign Up | LinkedIn">`, "u")).toEqual([]);
  });
  it("maps Apify records without contact fields", () => {
    const li = linkedInItems({ firstName: "Ava", lastName: "Lee", headline: "Designer", email: "a@b.c", experience: [{ position: "Lead", companyName: "Acme", description: "Chairs" }], skills: [{ name: "CAD" }] }, "u");
    expect(li.map((i) => i.text)).toEqual(["Ava Lee", "Designer", "Lead at Acme: Chairs", "Skills: CAD"]);
    const ig = instagramItems({ fullName: "Ava", biography: "maker", latestPosts: [{ caption: "New chair!", url: "https://www.instagram.com/p/x/", timestamp: "2026-01-02T00:00:00Z" }] }, "u");
    expect(ig[2]).toEqual({ field: "post", url: "https://www.instagram.com/p/x/", text: "[2026-01-02] New chair!" });
  });
});

const profile = (id: string, name: string): AgentProfile => ({
  id, display_name: name, kind: "real", headline: "h", summary: "s", unknowns: ["weekday plans"], preferences: prefs({ priorities: "kindness", boundaries: "no talk about exes" }),
  observations: [{ id: "o", category: "hobby", label: "Running", detail: "", origin: "sourced", source_item_id: "x", quote: "run through Prospect Park", edited: false, platform: "instagram" }],
});

describe("dating harness", () => {
  it("has at least six alternating substantive phases", () => {
    expect(DATE_PLAN.length).toBeGreaterThanOrEqual(6);
    DATE_PLAN.forEach((p, i) => expect(p.speaker).toBe(i % 2 === 0 ? "a" : "b"));
  });
  it("gives each agent only its own profile, with rules about unknowns and commitments", () => {
    const sys = agentSystemPrompt(profile("A", "Maya Okafor"), "Daniel Reyes", DATE_PLAN[0], 0);
    expect(sys).toContain('Instagram: "run through Prospect Park"');
    expect(sys).toContain("no talk about exes");
    expect(sys).toMatch(/Never commit Maya/);
    expect(sys).toMatch(/profile doesn't say/);
    expect(sys).not.toContain("Daniel's profile");
  });
  it("builds alternating chat history from the agent's own perspective", () => {
    const t: Turn[] = [
      { idx: 0, speaker_id: "A", phase: "", content: "hello from A", created_at: "" },
      { idx: 1, speaker_id: "B", phase: "", content: "hello from B", created_at: "" },
    ];
    const forA = agentMessages("A", "Daniel", t);
    expect(forA.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(forA[2].content).toContain("Daniel's agent: hello from B");
    const forB = agentMessages("B", "Maya", t);
    expect(forB.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(forB[0].content).toContain("Maya's agent: hello from A");
  });
  it("strips speaker prefixes", () => {
    expect(cleanTurn("**Maya's agent:** Hi there", "Maya Okafor")).toBe("Hi there");
  });
});

describe("llm helpers", () => {
  it("extracts JSON from fenced, chatty output", () => {
    expect(extractJson('Sure!\n```json\n{"a": "x}", "b": {"c": 1}}\n```')).toEqual({ a: "x}", b: { c: 1 } });
  });
  it("parses SSE streams split across chunks", async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode('data: {"response":"Hel'));
        c.enqueue(enc.encode('lo"}\n\ndata: {"response":" world"}\n\ndata: [DONE]\n\n'));
        c.close();
      },
    });
    const out: string[] = [];
    for await (const d of sseData(body)) out.push(JSON.parse(d).response);
    expect(out.join("")).toBe("Hello world");
  });
});

describe("demo personas", () => {
  it("has 25 fictional people with fixture (non-real) source links", () => {
    expect(PERSONAS).toHaveLength(25);
    for (const p of PERSONAS) {
      const [li, ig] = personaSources(p);
      expect(li.url.startsWith("/demo/sources/")).toBe(true);
      expect(ig.items.filter((i) => i.field === "post").length).toBeGreaterThanOrEqual(4);
    }
  });
  it("gives every persona at least three mutually eligible matches", () => {
    const cs = PERSONAS.map((p) => cand(p.slug, { age: p.age, gender: p.gender, open_to: p.open_to, age_min: p.age_min, age_max: p.age_max }, { kind: "demo" }));
    for (const c of cs) expect(cs.filter((o) => mutuallyEligible(c, o)).length, c.id).toBeGreaterThanOrEqual(3);
  });
});
