import { Avatar, ErrorBox, KindBadge, Loading, ScoreMeter, StatusBadge, useApi } from "../components";
import { Link } from "../router";
import type { Ranking, RankingEntry } from "../../shared/types";

export function RankingPage({ id }: { id: string }) {
  const { data, error, loading } = useApi<Ranking>(`/api/rankings/${id}`, (d) => (d?.entries.some((e) => e.status === "pending") ? 10000 : undefined));
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;
  if (!data) return null;
  const ranked = data.entries.filter((e) => e.status === "ranked");
  const pending = data.entries.filter((e) => e.status === "pending");
  const failed = data.entries.filter((e) => e.status === "failed");
  return (
    <div className="stack">
      {data.participant.kind === "demo" ? <div className="banner demo"><strong>Fictional demo.</strong> {data.participant.display_name} and everyone ranked here are invented personas.</div> : null}
      <section className="card">
        <div className="row">
          <Avatar name={data.participant.display_name} size="lg" />
          <div>
            <div className="eyebrow">Who fits them best</div>
            <h1 style={{ margin: 0 }}>{data.participant.display_name}'s ranking</h1>
            <div className="row small" style={{ marginTop: 6 }}>
              <KindBadge kind={data.participant.kind} />
              <span className="muted">{ranked.length} ranked · {pending.length} in progress · eligible, consenting matches only</span>
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <Link className="btn secondary" to={`/people/${data.participant.id}`}>Profile</Link>
          </div>
        </div>
      </section>

      <details className="card">
        <summary>How this ranking is calculated</summary>
        <p className="small" style={{ marginTop: 12 }}>
          After each date, a separate evaluator model (not either dating agent) reads the full transcript and both approved profiles and scores six
          criteria from 0–10, each with a written rationale and verbatim excerpts. Your score for a partner is the weighted sum × 10, so it runs 0–100.
          The last criterion is personal: it measures fit with <em>your</em> stated priorities, so you and your date can rank each other differently.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Criterion</th><th>Weight</th><th>What it measures</th></tr></thead>
            <tbody>
              {data.weights.map((w) => (
                <tr key={w.key}><td>{w.label}</td><td>{Math.round(w.weight * 100)}%</td><td className="small muted">{w.help}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Scores are exploratory rubric judgements about one AI conversation and two profiles — not validated predictions of attraction or relationship
          success. Eligibility uses only what each person stated (who they're open to, age range); nothing is inferred.
        </p>
      </details>

      {ranked.length === 0 && pending.length === 0 ? (
        <div className="card muted">No eligible, consenting matches have dated yet.</div>
      ) : null}
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }} className="stack">
        {ranked.map((e, i) => <Entry key={e.partner.id} e={e} rank={i + 1} />)}
      </ol>
      {pending.length ? (
        <section className="card">
          <h3>Dates still in progress</h3>
          {pending.map((e) => (
            <div key={e.partner.id} className="row spread" style={{ padding: "6px 0" }}>
              <Link to={`/people/${e.partner.id}`}>{e.partner.display_name}</Link>
              {e.date_id ? <Link to={`/dates/${e.date_id}`}>Watch</Link> : null}
            </div>
          ))}
        </section>
      ) : null}
      {failed.length ? <p className="small muted">{failed.length} date(s) failed and are excluded.</p> : null}
      {data.practice.length ? (
        <section>
          <h2>Practice dates (fictional partners — not part of the real ranking)</h2>
          <ol style={{ listStyle: "none", padding: 0 }} className="stack">
            {data.practice.filter((e) => e.status === "ranked").map((e, i) => <Entry key={e.partner.id} e={e} rank={i + 1} />)}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function Entry({ e, rank }: { e: RankingEntry; rank: number }) {
  return (
    <li className="card">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <span className="rank-num">{rank}</span>
        <Avatar name={e.partner.display_name} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="row spread">
            <div>
              <Link to={`/people/${e.partner.id}`}><strong>{e.partner.display_name}</strong></Link>{" "}
              <KindBadge kind={e.partner.kind} />
              <div className="small muted">{e.partner.headline}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="score">{e.score}</div>
              <span className={`badge ${e.confidence === "high" ? "good" : e.confidence === "medium" ? "warn" : "bad"}`}>{e.confidence} confidence</span>
            </div>
          </div>
          <ScoreMeter value={e.score ?? 0} label={`Score for ${e.partner.display_name}`} />
          <p className="small" style={{ marginTop: 10 }}>{e.summary}</p>
          <div className="grid grid-2 small">
            <div><strong>Shared:</strong> {e.shared_interests.join(" · ") || "—"}</div>
            <div><strong>Possible friction:</strong> {e.possible_friction.join(" · ") || "—"}</div>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="small">Score breakdown</summary>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Criterion</th><th>Weight</th><th>Score</th><th>Why</th></tr></thead>
                <tbody>
                  {e.breakdown.map((b) => (
                    <tr key={b.key}><td>{b.label}</td><td>{Math.round(b.weight * 100)}%</td><td>{b.score}/10</td><td className="small muted">{b.rationale}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {e.date_id ? (
            <div className="row" style={{ marginTop: 10 }}>
              <Link className="btn small secondary" to={`/dates/${e.date_id}`}>Read the full date</Link>
              <StatusBadge status="complete" />
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
