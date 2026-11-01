import { Avatar, ErrorBox, KindBadge, Loading, useApi } from "../components";
import { Link } from "../router";
import type { ParticipantSummary } from "../../shared/types";

export function People() {
  const { data, error, loading } = useApi<ParticipantSummary[]>("/api/participants?kind=real", 15000);
  return (
    <div>
      <h1>{location.pathname === "/example" ? "Real-profile simulation" : "People"}</h1>
      {location.pathname === "/example" ? <div className="banner warn">Real public profiles; simulated agent conversations. No participant authorization or romantic preferences claimed. Open a profile first, then its date transcripts and ranking.</div> : null}
      <p className="muted">Approved profiles. Click anyone to see what their agent found, their dates, and their ranking.</p>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? <div className="card muted">No approved profiles yet.</div> : null}
      <div className="grid grid-3">
        {data?.map((p) => (
          <Link key={p.id} to={`/people/${p.id}`} className="card person-card">
            <div className="row" style={{ alignItems: "flex-start" }}>
              <Avatar name={p.display_name} src={p.avatar_url} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>{p.display_name}</h3>
                <KindBadge kind={p.kind} />
                <p className="small muted" style={{ margin: "6px 0 0" }}>{p.headline}</p>
                {p.kind === "real" ? <p className="src" style={{ margin: "8px 0 0" }}>in/{handle(p.linkedin_url)} · @{handle(p.instagram_url)}</p> : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function handle(url: string): string {
  return url.replace(/\/+$/, "").split("/").pop() ?? url;
}
