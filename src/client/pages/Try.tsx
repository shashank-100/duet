import { Avatar, ErrorBox, StatusBadge, useApi } from "../components";
import { Link } from "../router";
import type { ParticipantSummary } from "../../shared/types";

interface DateRow {
  id: string;
  status: string;
  turn_count: number;
  a: { id: string };
  b: { id: string };
}

const READY = ["approved"];

function PersonStatus({ p, tone }: { p: ParticipantSummary | null; tone: "a" | "b" }) {
  if (!p) return <div className={`card try-person ${tone}`}><span className="spinner" /> Loading…</div>;
  const busy = !READY.includes(p.status) && !["error", "needs_sources"].includes(p.status);
  return (
    <div className={`card try-person ${tone}`}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <Avatar name={p.display_name} src={p.avatar_url} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatusBadge status={p.status} />
          <h2 style={{ margin: "8px 0 4px" }}>{p.display_name}</h2>
          <p className="small muted" style={{ margin: 0 }}>{p.headline || p.status_detail}</p>
        </div>
      </div>
      <p className="small" style={{ margin: "14px 0 0" }}>
        {busy ? <span className="spinner" style={{ marginRight: 8, verticalAlign: "middle" }} /> : null}
        {READY.includes(p.status) ? (
          <>
            <Link to={`/people/${p.id}`}>Profile &amp; analysis</Link> · <Link to={`/people/${p.id}/ranking`}>Ranking</Link>
          </>
        ) : (
          <Link to={`/people/${p.id}`}>Watch the agent read this person</Link>
        )}
      </p>
    </div>
  );
}

export function TryPage({ a, b }: { a: string; b: string }) {
  const pa = useApi<ParticipantSummary>(`/api/participants/${a}`, 4000);
  const pb = useApi<ParticipantSummary>(`/api/participants/${b}`, 4000);
  const dates = useApi<DateRow[]>(`/api/dates?participant=${a}`, 4000);
  const date = dates.data?.find((d) => (d.a.id === a && d.b.id === b) || (d.a.id === b && d.b.id === a));
  const failed = [pa.data, pb.data].find((p) => p && ["error", "needs_sources"].includes(p.status));

  return (
    <div className="narrow" style={{ maxWidth: 980 }}>
      <p className="eyebrow">Your pair</p>
      <h1>
        {pa.data?.display_name ?? "…"} <em>&amp;</em> {pb.data?.display_name ?? "…"}
      </h1>
      <ol className="try-steps small muted">
        <li className={pa.data && pb.data ? "done" : ""}>Reading LinkedIn + Instagram</li>
        <li className={READY.includes(pa.data?.status ?? "") && READY.includes(pb.data?.status ?? "") ? "done" : ""}>Profiles analysed</li>
        <li className={date ? "done" : ""}>Date started</li>
        <li className={date?.status === "complete" ? "done" : ""}>Date scored &amp; ranked</li>
      </ol>
      <ErrorBox error={pa.error || pb.error} />
      {failed ? (
        <div className="banner bad">
          We couldn't read {failed.display_name}'s profiles: {failed.status_detail} <Link to={`/people/${failed.id}`}>Details</Link>
        </div>
      ) : null}
      <div className="try-grid">
        <PersonStatus p={pa.data} tone="a" />
        <div className="try-heart" aria-hidden="true">
          <span />
          <span />
        </div>
        <PersonStatus p={pb.data} tone="b" />
      </div>
      <div className="card" style={{ marginTop: 18, textAlign: "center" }}>
        {date ? (
          <>
            <p style={{ margin: "0 0 12px" }}>
              {date.status === "complete" ? "The date is over and scored." : `Their agents are on a date right now — ${date.turn_count}/8 turns.`}
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              <Link className="btn" to={`/dates/${date.id}`}>{date.status === "complete" ? "Read the date" : "Watch it live"}</Link>
              {date.status === "complete" ? (
                <>
                  <Link className="btn secondary" to={`/people/${a}/ranking`}>{pa.data?.display_name}'s ranking</Link>
                  <Link className="btn secondary" to={`/people/${b}/ranking`}>{pb.data?.display_name}'s ranking</Link>
                </>
              ) : null}
            </div>
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            <span className="spinner" style={{ marginRight: 8, verticalAlign: "middle" }} />
            The date starts as soon as both agents have read their person (usually 1–3 minutes). This page updates by itself.
          </p>
        )}
      </div>
    </div>
  );
}
