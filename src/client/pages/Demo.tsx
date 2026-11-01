import { Avatar, Loading, StatusBadge, useApi } from "../components";
import { Link } from "../router";
import type { DateSummary, ParticipantSummary } from "../../shared/types";

export function Demo() {
  const { data: people } = useApi<ParticipantSummary[]>("/api/participants?kind=demo", 20000);
  const { data: dates } = useApi<DateSummary[]>("/api/dates?pool=demo", 5000);
  const complete = (dates ?? []).filter((d) => d.status === "complete");
  const live = (dates ?? []).filter((d) => d.status === "running" || d.status === "evaluating");
  const top = [...complete].sort((a, b) => (b.score_a ?? 0) + (b.score_b ?? 0) - ((a.score_a ?? 0) + (a.score_b ?? 0))).slice(0, 5);
  return (
    <div className="stack">
      <div>
        <div className="eyebrow">The finished example</div>
        <h1>25 agents, already dating</h1>
        <p className="muted" style={{ maxWidth: 760 }}>
          This demo uses 25 clearly labeled fictional people. Their "LinkedIn" and "Instagram" pages are fixtures hosted by Duet, but everything after
          that is the real pipeline: the analysis agent read their two sources, the agents held unscripted multi-turn conversations, and a separate
          evaluator scored every date. Real participants who join go through the same thing with their own profiles.
        </p>
      </div>
      <div className="banner demo"><strong>All people on this page are fictional.</strong> Any resemblance to real people is coincidental.</div>

      <section className="grid grid-3">
        <div className="card"><div className="stat">{people?.length ?? "…"}</div><div className="muted small">fictional agents with approved profiles</div></div>
        <div className="card"><div className="stat">{complete.length}</div><div className="muted small">dates completed & evaluated</div></div>
        <div className="card"><div className="stat">{live.length}</div><div className="muted small">dates streaming right now</div></div>
      </section>

      <section className="card">
        <h2>Walk through it</h2>
        <ol className="small" style={{ paddingLeft: 18 }}>
          <li><strong>Profile:</strong> open any person below — needs, hobbies, interests, qualities, each with the quote and source it came from.</li>
          <li><strong>Dates:</strong> open a date to read the full transcript (or watch one live) and the evaluator's assessment.</li>
          <li><strong>Ranking:</strong> every person has a ranked list of their eligible matches, with score breakdowns.</li>
        </ol>
        {top.length ? (
          <>
            <h3>Highest-scoring demo dates</h3>
            {top.map((d) => (
              <div key={d.id} className="row spread" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <span><strong>{d.a.display_name}</strong> & <strong>{d.b.display_name}</strong> <span className="muted small">· {d.score_a} / {d.score_b}</span></span>
                <Link to={`/dates/${d.id}`}>Read the date</Link>
              </div>
            ))}
          </>
        ) : null}
        {live.length ? (
          <>
            <h3 style={{ marginTop: 16 }}>Live now</h3>
            {live.slice(0, 6).map((d) => (
              <div key={d.id} className="row spread" style={{ padding: "6px 0" }}>
                <span>{d.a.display_name} & {d.b.display_name} <StatusBadge status={d.status} /> <span className="tiny muted">turn {d.turn_count}/8</span></span>
                <Link to={`/dates/${d.id}`}>Watch live</Link>
              </div>
            ))}
          </>
        ) : null}
      </section>

      <section>
        <h2>The 25 people</h2>
        {!people ? <Loading /> : null}
        <div className="grid grid-3">
          {people?.map((p) => {
            const n = complete.filter((d) => d.a.id === p.id || d.b.id === p.id).length;
            return (
              <div key={p.id} className="card">
                <div className="row" style={{ alignItems: "flex-start" }}>
                  <Avatar name={p.display_name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0 }}>{p.display_name}</h3>
                    <p className="small muted" style={{ margin: "4px 0 8px" }}>{p.headline}</p>
                    <div className="row small">
                      <Link to={`/people/${p.id}`}>Profile</Link>
                      <Link to={`/people/${p.id}/ranking`}>Ranking</Link>
                      <span className="muted">{n} dates</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
