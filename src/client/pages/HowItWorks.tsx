import { useApi } from "../components";
import { DIMENSIONS, PRIORITY_FIT_WEIGHT } from "../../shared/types";

export function HowItWorks() {
  const { data } = useApi<{ model: string; retrievers: { apify: boolean } }>("/api/config");
  return (
    <div className="narrow prose">
      <div className="eyebrow">Under the hood</div>
      <h1>How Duet works</h1>
      <p className="lead muted">
        Each consenting adult gets an agent. The agent reads only two sources — their LinkedIn and their public Instagram — drafts a profile they
        approve, dates other agents, and a separate evaluator ranks the results.
      </p>

      <h2>1. Retrieval: exactly two sources</h2>
      <p>For each participant Duet tries these methods, in order, and records every attempt with its HTTP status on the profile page:</p>
      <ol>
        <li>
          <strong>Apify actors</strong> {data ? <span className={`badge ${data.retrievers.apify ? "good" : ""}`}>{data.retrievers.apify ? "enabled here" : "not configured here"}</span> : null}{" "}
          — <code>harvestapi~linkedin-profile-scraper</code> (profile details, no email) and <code>apify~instagram-profile-scraper</code> (bio and
          latest post captions), called server-side with the operator's token. Private Instagram accounts are rejected.
        </li>
        <li>
          <strong>Direct public fetch</strong> — a logged-out request with an honest User-Agent. LinkedIn normally answers HTTP 999/429 or a sign-in
          wall; Instagram returns only the display name. Duet reports this as "blocked" and never pretends otherwise.
        </li>
        <li>
          <strong>Your own data export</strong> — LinkedIn's "Get a copy of your data" (Profile, Positions, Skills, Education CSVs) or Instagram's
          "Download your information" (JSON). Files are filtered in your browser; only profile text and captions are uploaded.
        </li>
      </ol>
      <p>
        Never kept: email, phone, address, birthday, messages, connections, follower lists. Links outside the two profiles are not followed.
      </p>

      <h2>2. Analysis agent</h2>
      <p>
        A model reads the numbered source items and drafts <em>needs</em> (only when explicitly stated), <em>hobbies</em>, <em>interests</em>,{" "}
        <em>activities</em>, <em>qualities</em> (concrete behaviours shown in the text) and <em>professional background</em>. Every observation must
        quote its source verbatim; the server checks the quote against the retrieved text and discards anything that doesn't match. Sensitive traits
        (sexuality, relationship status, health, religion, politics, finances…) are prohibited in the prompt and filtered again server-side. The agent
        also lists what the sources <em>don't</em> say.
      </p>
      <p>
        Three kinds of information stay visibly separate: <strong>sourced observations</strong> (with quote + link), <strong>participant
        statements</strong> (what you typed: preferences, priorities, boundaries, additions), and <strong>unknowns</strong>.
      </p>

      <h2>3. Review & approval</h2>
      <p>
        Your draft is private. You can edit or remove any observation (edits are labeled), add your own statements, change preferences, re-run
        retrieval or analysis, pause, or delete everything. Your agent cannot date until you approve.
      </p>

      <h2>4. The dating harness</h2>
      <p>
        Each date is eight turns — two agents alternating — run by a Durable Object that streams tokens to the date room over WebSockets and saves each
        finished turn. Phases steer the conversation without scripting it: proposing an outing, responding to it, shared interests, going deeper,
        exploring a real difference, priorities and unknowns, reflection, and a closing reflection. Each agent sees only its own person's approved
        profile and the transcript; it learns about the other person by listening. Agents must acknowledge missing information and may not commit
        their person to anything.
      </p>

      <h2>5. Evaluation & ranking</h2>
      <p>A separate evaluator model reads the finished transcript and both profiles and returns a structured assessment. Criteria and weights:</p>
      <ul>
        {DIMENSIONS.map((d) => (
          <li key={d.key}>
            <strong>{d.label}</strong> — {Math.round(d.weight * 100)}%: {d.help}
          </li>
        ))}
        <li>
          <strong>Fit with this person's own stated priorities</strong> — {Math.round(PRIORITY_FIT_WEIGHT * 100)}%: computed separately for each side.
        </li>
      </ul>
      <p>
        Scores run 0–100. Supporting excerpts must appear verbatim in the transcript. Scores are exploratory rubric judgements about one conversation —
        not validated predictions. Eligibility uses only stated preferences (who you're open to, age range); demo and real participants are never
        mixed except in clearly labeled practice dates.
      </p>

      <h2>Stack</h2>
      <ul>
        <li>Cloudflare Workers (Hono API + React SPA on Workers static assets)</li>
        <li>D1 (SQLite) for all persistent data; Durable Objects (one per date) for live streaming and alarm-driven, retrying turns</li>
        <li>Cloudflare Workflows for durable retrieval + analysis jobs; a cron trigger dispatches queued dates and revives stalled ones</li>
        <li>LLM: {data?.model ?? "…"} (pluggable: Workers AI, Anthropic or OpenAI — keys held as Worker secrets, never sent to the browser)</li>
      </ul>

      <h2>Limitations</h2>
      <ul>
        <li>LinkedIn and Instagram restrict automated access. Without the Apify retriever, most profiles need the participant's data export.</li>
        <li>Public profiles are a narrow, curated view of a person. The agent can only be as good as what was shared.</li>
        <li>Authorization is self-attested; Duet cannot verify that the person submitting links owns them.</li>
        <li>The 25-person demo uses fictional personas; it demonstrates the pipeline, not real-world matching quality.</li>
      </ul>
    </div>
  );
}
