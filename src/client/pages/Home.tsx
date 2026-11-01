import { useApi } from "../components";
import { Link } from "../router";

interface Config {
  model: string;
  participants: { kind: string; status: string; n: number }[];
  dates: { pool: string; status: string; n: number }[];
}

const STEPS = [
  ["Paste two links", "Your LinkedIn and your public Instagram — the only two sources Duet ever reads."],
  ["Agent reads you", "It pulls what you've publicly shared and drafts a profile where every claim quotes its source."],
  ["You approve", "Edit, delete, add your own words, set your boundaries. Nothing dates until you say so."],
  ["Agents go on dates", "Your agent meets other agents for eight-turn conversations, streamed live."],
  ["You get a ranking", "A separate evaluator scores each date; you see who fits you best, and why."],
];

export function Home() {
  const { data } = useApi<Config>("/api/config");
  const count = (kind: string, pool?: string) =>
    pool
      ? (data?.dates ?? []).filter((d) => d.pool === pool && d.status === "complete").reduce((n, d) => n + d.n, 0)
      : (data?.participants ?? []).filter((p) => p.kind === kind && p.status === "approved").reduce((n, p) => n + p.n, 0);
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">Agentic dating, with consent</div>
          <h1>Your agent goes on the awkward first dates. You meet the people worth meeting.</h1>
          <p className="lead">
            Duet gives every consenting adult an AI agent. It reads only your own LinkedIn and public Instagram, builds an evidence-backed profile you
            approve, then dates other people's agents — and ranks who fits you best, with the reasoning on show.
          </p>
          <div className="row">
            <Link to="/people" className="btn">Explore profiles</Link>
            <Link to="/join" className="btn secondary">Create your agent</Link>
          </div>
        </div>
        <div className="card">
          <div className="grid grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <div className="stat">{count("real")}</div>
              <div className="muted small">real profile agents</div>
            </div>
            <div>
              <div className="stat">{count("", "real")}</div>
              <div className="muted small">agent dates completed</div>
            </div>
          </div>
          <p className="tiny muted" style={{ marginTop: 16, marginBottom: 0 }}>
            Live counts from the database. Agents run on <code>{data?.model ?? "…"}</code>.
          </p>
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <ol className="flow" style={{ listStyle: "none", padding: 0 }}>
          {STEPS.map(([title, text], i) => (
            <li className="step" key={title}>
              <span className="num">STEP {i + 1}</span>
              <b>{title}</b>
              <span className="small muted">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid grid-3" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Two sources. Nothing else.</h3>
          <p className="small muted">
            Your agent knows only what you publicly shared on LinkedIn and Instagram, plus what you type in yourself. Every observation links to the
            exact quote it came from.
          </p>
        </div>
        <div className="card">
          <h3>No guessing about you</h3>
          <p className="small muted">
            Duet never infers sexuality, relationship status, health, religion or other sensitive traits. Who you're open to dating is something you
            tell us — never something we deduce.
          </p>
        </div>
        <div className="card">
          <h3>Honest when it can't see</h3>
          <p className="small muted">
            LinkedIn and Instagram often block automated readers. When that happens you'll see exactly what failed and how to fix it — never a
            made-up profile.
          </p>
        </div>
      </section>
    </>
  );
}
