import { useEffect, useState } from "react";
import { api } from "../api";
import { Avatar, ErrorBox, KindBadge, Loading, StatusBadge, timeAgo, useApi } from "../components";
import { Link, navigate } from "../router";
import { OBSERVATION_CATEGORIES, type DateSummary, type Observation, type ObservationCategory, type ParticipantSummary, type ProfileDetail } from "../../shared/types";
import { PreferenceFields, prefsToForm, type PrefForm } from "./PreferenceFields";
import { ExportUpload } from "./ExportUpload";

export const CATEGORY_LABEL: Record<ObservationCategory, string> = {
  need: "Needs",
  hobby: "Hobbies",
  interest: "Interests",
  activity: "Activities",
  quality: "Qualities",
  professional: "Professional background",
};
const CATEGORY_HELP: Record<ObservationCategory, string> = {
  need: "Only what they explicitly said they need, want or value.",
  hobby: "Things done for enjoyment.",
  interest: "Topics they explicitly care about.",
  activity: "Recurring things they do.",
  quality: "Concrete ways they act, shown directly in the sources.",
  professional: "Role, field, history and skills.",
};
const ORDER: ObservationCategory[] = ["need", "hobby", "interest", "activity", "quality", "professional"];
const BUSY = ["submitted", "retrieving", "analyzing"];

function sourceHref(url: string): string {
  return url;
}

export function Profile({ id }: { id: string }) {
  const { data: p, error, loading, reload, setData } = useApi<ProfileDetail>(`/api/participants/${id}`, (d) => (d && BUSY.includes(d.status) ? 2500 : undefined));
  const { data: dates } = useApi<DateSummary[]>(`/api/dates?participant=${id}`, 8000);
  const [actionError, setActionError] = useState<unknown>(null);
  const isNew = new URLSearchParams(location.search).get("new") === "1";

  if (loading && !p) return <Loading />;
  if (error && !p) return <ErrorBox error={error} />;
  if (!p) return null;

  const owner = p.is_owner;
  const act = async (fn: () => Promise<ProfileDetail | { profile: ProfileDetail }>) => {
    setActionError(null);
    try {
      const r = await fn();
      setData("profile" in r ? r.profile : r);
    } catch (err) {
      setActionError(err);
    }
  };
  const grouped = ORDER.map((c) => [c, p.observations.filter((o) => o.category === c)] as const);
  const sourcedCount = p.observations.filter((o) => o.origin === "sourced").length;
  const li = p.sources.find((s) => s.platform === "linkedin" && s.status === "ok");
  const ig = p.sources.find((s) => s.platform === "instagram" && s.status === "ok");

  return (
    <div className="stack">
      {p.kind === "demo" ? (
        <div className="banner demo">
          <strong>Fictional demo persona.</strong> {p.display_name} is not a real person. Their "LinkedIn" and "Instagram" are fixture pages hosted by
          Duet, and they ran through exactly the same analysis and dating pipeline as real participants.
        </div>
      ) : null}
      {owner && isNew ? (
        <div className="banner good">
          <strong>Your agent is being created.</strong> This page updates by itself. Save your private manage link (below) to come back from another
          device.
        </div>
      ) : null}
      <ErrorBox error={actionError} />

      <section className="card">
        <div className="row" style={{ alignItems: "flex-start" }}>
          <Avatar name={p.display_name} size="lg" src={p.avatar_url} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="row" style={{ gap: 8 }}>
              <KindBadge kind={p.kind} />
              <StatusBadge status={p.status} />
              {p.approved_by ? <span className="badge">Approved by {p.approved_by}</span> : null}
            </div>
            <h1 style={{ margin: "8px 0 4px" }}>{p.display_name}</h1>
            <p className="muted" style={{ margin: 0 }}>{p.headline || (BUSY.includes(p.status) ? "Analysis in progress…" : "")}</p>
            <div className="row small source-links" style={{ marginTop: 12 }}>
              <a className="btn secondary small" href={sourceHref(p.linkedin_url)} target={p.kind === "demo" ? undefined : "_blank"} rel="noreferrer">
                {p.kind === "demo" ? "Fictional LinkedIn" : `LinkedIn · ${p.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\//, "").replace(/\/$/, "")}`} ↗
              </a>
              <a className="btn secondary small" href={sourceHref(p.instagram_url)} target={p.kind === "demo" ? undefined : "_blank"} rel="noreferrer">
                {p.kind === "demo" ? "Fictional Instagram" : `Instagram · @${p.instagram_url.replace(/\/$/, "").split("/").pop()}`} ↗
              </a>
            </div>
          </div>
          <div className="row">
            <Link className="btn" to={`/people/${p.id}/ranking`}>Ranking</Link>
            <a className="btn secondary" href="#dates">Dates ({dates?.length ?? 0})</a>
          </div>
        </div>
        {p.status_detail ? (
          <p className={`banner ${p.status === "needs_sources" || p.status === "error" ? "bad" : p.status === "draft_ready" ? "warn" : ""}`} style={{ marginTop: 16, marginBottom: 0 }}>
            {BUSY.includes(p.status) ? <span className="spinner" aria-hidden="true" style={{ marginRight: 8, verticalAlign: "middle" }} /> : null}
            {p.status_detail}
          </p>
        ) : null}
      </section>

      {owner ? <OwnerPanel p={p} onChange={setData} act={act} reload={reload} /> : null}

      <div className="grid profile-grid">
        <div className="stack" style={{ minWidth: 0 }}>
          <section className="card" aria-labelledby="analysis">
            <div className="eyebrow">What the agent found</div>
            <h2 id="analysis">Analysis</h2>
            {p.summary ? <p>{p.summary}</p> : null}
            <p className="small muted">
              {sourcedCount} observations, each quoting {p.kind === "demo" ? "a fictional" : "a"} LinkedIn or Instagram source.
              {p.dropped_claims ? ` ${p.dropped_claims} model claims were discarded because they couldn't be matched to an exact quote.` : ""}
              {p.analysis_model ? ` Analyzed ${timeAgo(p.analyzed_at)} by ${p.analysis_model}.` : ""}
            </p>
            {grouped.map(([cat, list]) => (
              <div className="obs-group" key={cat}>
                <h3>
                  {CATEGORY_LABEL[cat]} <span className="badge">{list.length}</span>
                </h3>
                <p className="tiny muted" style={{ marginTop: -4 }}>{CATEGORY_HELP[cat]}</p>
                {list.length === 0 ? <p className="small muted">Nothing in the sources.</p> : list.map((o) => <ObservationRow key={o.id} o={o} owner={owner} pid={p.id} act={act} kind={p.kind} />)}
              </div>
            ))}
            {owner ? <AddObservation pid={p.id} act={act} /> : null}
          </section>
        </div>
        <aside className="stack" style={{ minWidth: 0 }}>
          <section className="card">
            <h3>Unknown — not in the sources</h3>
            {p.unknowns.length ? (
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
                {p.unknowns.map((u) => <li key={u}>{u}</li>)}
              </ul>
            ) : (
              <p className="small muted">None listed yet.</p>
            )}
          </section>
          <section className="card">
            <h3>In their own words</h3>
            <p className="tiny muted">Participant statements — typed by {p.kind === "demo" ? "the persona author" : "them"}, never inferred.</p>
            {[
              ["Location", p.preferences.location],
              ["Looking for", p.preferences.looking_for],
              ["Priorities", p.preferences.priorities],
              ["Boundaries", p.preferences.boundaries],
            ].map(([k, v]) => (
              <div key={k} className="small" style={{ marginBottom: 8 }}>
                <strong>{k}:</strong> {v || <span className="muted">not stated</span>}
              </div>
            ))}
          </section>
          <section className="card">
            <h3>Sources & retrieval</h3>
            <p className="tiny muted">LinkedIn {li ? "✓" : "✗"} · Instagram {ig ? "✓" : "✗"}</p>
            <ul className="timeline">
              {p.sources.map((s) => (
                <li key={s.id} className={s.status}>
                  <div className="row" style={{ gap: 6 }}>
                    <strong>{s.platform === "linkedin" ? "LinkedIn" : "Instagram"}</strong>
                    <span className="badge">{s.method.replace("_", " ")}</span>
                    <StatusBadge status={s.status} />
                    {s.http_status ? <span className="tiny muted">HTTP {s.http_status}</span> : null}
                  </div>
                  <div className="small muted">{s.detail}</div>
                </li>
              ))}
            </ul>
            <details style={{ marginTop: 10 }}>
              <summary className="small">What the agent read ({p.items.length} items)</summary>
              <ul className="small" style={{ paddingLeft: 18 }}>
                {p.items.map((i) => (
                  <li key={i.id}>
                    <span className="badge">{i.platform} · {i.field}</span> {i.text}
                  </li>
                ))}
              </ul>
            </details>
          </section>
          {p.events.length ? (
            <section className="card">
              <h3>Activity</h3>
              <ul className="timeline">
                {p.events.map((e, i) => (
                  <li key={i} className={e.status}>
                    <span className="small">{e.message}</span> <span className="tiny muted">{timeAgo(e.at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <section className="card" id="dates" aria-labelledby="dates-h">
        <h2 id="dates-h">Dates</h2>
        {!dates?.length ? (
          <p className="muted small">No dates yet. Dates are scheduled automatically once a profile is approved and there are eligible, consenting matches.</p>
        ) : (
          <DateList dates={dates} me={p.id} />
        )}
      </section>
    </div>
  );
}

export function DateList({ dates, me }: { dates: DateSummary[]; me?: string }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Status</th>
            <th>Turns</th>
            <th>Score</th>
            <th><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {dates.map((d) => {
            const mineA = d.a.id === me;
            const score = me ? (mineA ? d.score_a : d.score_b) : d.score_a !== null && d.score_b !== null ? Math.round(((d.score_a + d.score_b) / 2) * 10) / 10 : null;
            return (
              <tr key={d.id}>
                <td>
                  <strong>{d.a.display_name}</strong> & <strong>{d.b.display_name}</strong>
                  {d.pool === "practice" ? <span className="badge warn" style={{ marginLeft: 6 }}>Practice</span> : null}
                </td>
                <td><StatusBadge status={d.status} /></td>
                <td>{d.turn_count}/8</td>
                <td>{score ?? "—"}</td>
                <td><Link to={`/dates/${d.id}`}>{d.status === "running" || d.status === "evaluating" ? "Watch live" : "Transcript"}</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ObservationRow({ o, owner, pid, act, kind }: { o: Observation; owner: boolean; pid: string; act: (fn: () => Promise<ProfileDetail>) => Promise<void>; kind: string }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(o.label);
  const [detail, setDetail] = useState(o.detail);
  return (
    <div className="obs">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => api(`/api/participants/${pid}/observations/${o.id}`, { method: "PATCH", json: { label, detail } })).then(() => setEditing(false));
          }}
        >
          <label htmlFor={`l-${o.id}`} className="sr-only">Label</label>
          <input id={`l-${o.id}`} type="text" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
          <label htmlFor={`d-${o.id}`} className="sr-only">Detail</label>
          <textarea id={`d-${o.id}`} value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={300} style={{ marginTop: 6 }} />
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn small" type="submit">Save</button>
            <button className="btn small secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <div className="row spread">
            <span className="label">{o.label}</span>
            <span className="row" style={{ gap: 6 }}>
              {o.origin === "participant" ? <span className="badge real">Your statement</span> : <span className="badge">{o.source?.platform === "instagram" ? "Instagram" : "LinkedIn"}</span>}
              {o.edited ? <span className="badge warn">Edited by participant</span> : null}
            </span>
          </div>
          {o.detail ? <div className="small">{o.detail}</div> : null}
          {o.quote ? <div className="quote small">“{o.quote}”</div> : null}
          {o.source ? (
            <div className="src">
              Source: <a href={o.source.url} target={kind === "demo" ? undefined : "_blank"} rel="noreferrer">{o.source.platform === "instagram" ? "Instagram" : "LinkedIn"} · {o.source.field}</a>
            </div>
          ) : o.origin === "sourced" ? (
            <div className="src">Source no longer available (re-retrieved).</div>
          ) : null}
          {owner ? (
            <div className="row" style={{ marginTop: 6, gap: 4 }}>
              <button className="btn small ghost" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn small ghost" onClick={() => void act(() => api(`/api/participants/${pid}/observations/${o.id}`, { method: "DELETE" }))}>
                Remove
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function AddObservation({ pid, act }: { pid: string; act: (fn: () => Promise<ProfileDetail>) => Promise<void> }) {
  const [category, setCategory] = useState<ObservationCategory>("hobby");
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");
  return (
    <details className="card" style={{ boxShadow: "none", background: "var(--surface-2)" }}>
      <summary>Add something in your own words</summary>
      <form
        style={{ marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          void act(() => api(`/api/participants/${pid}/observations`, { method: "POST", json: { category, label, detail } })).then(() => {
            setLabel("");
            setDetail("");
          });
        }}
      >
        <p className="small muted">This is labeled as your statement, not as something found in your profiles.</p>
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="add-cat">Category</label>
            <select id="add-cat" value={category} onChange={(e) => setCategory(e.target.value as ObservationCategory)}>
              {OBSERVATION_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="add-label">Short label</label>
            <input id="add-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="add-detail">Detail (optional)</label>
          <input id="add-detail" type="text" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={300} />
        </div>
        <button className="btn small" type="submit" disabled={!label.trim()}>Add</button>
      </form>
    </details>
  );
}

function OwnerPanel({
  p,
  onChange,
  act,
  reload,
}: {
  p: ProfileDetail;
  onChange: (p: ProfileDetail) => void;
  act: (fn: () => Promise<ProfileDetail | { profile: ProfileDetail }>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [manage, setManage] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<PrefForm>(prefsToForm(p.preferences));
  const [headline, setHeadline] = useState(p.headline);
  const [summary, setSummary] = useState(p.summary);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    try {
      setManage(localStorage.getItem(`duet-manage-${p.id}`));
    } catch {
      setManage(null);
    }
  }, [p.id]);
  useEffect(() => {
    setHeadline(p.headline);
    setSummary(p.summary);
  }, [p.headline, p.summary]);
  const canApprove = ["draft_ready", "paused"].includes(p.status);

  return (
    <section className="card" aria-labelledby="owner-h" style={{ borderColor: "var(--accent)" }}>
      <div className="eyebrow">Only you can see this panel</div>
      <h2 id="owner-h">Review & control your agent</h2>
      {notice ? <div className="banner good" role="status">{notice}</div> : null}
      {manage ? (
        <p className="small">
          Private manage link (keep it secret — it lets anyone edit or delete this profile): <code style={{ wordBreak: "break-all" }}>{manage}</code>{" "}
          <button className="btn small secondary" onClick={() => void navigator.clipboard?.writeText(manage).then(() => setNotice("Manage link copied."))}>Copy</button>
        </p>
      ) : null}
      <div className="row" style={{ margin: "12px 0" }}>
        {canApprove ? (
          <button
            className="btn"
            onClick={() =>
              void act(async () => {
                const r = await api<{ scheduled: number; profile: ProfileDetail }>(`/api/participants/${p.id}/approve`, { method: "POST" });
                setNotice(r.scheduled ? `Approved. ${r.scheduled} date(s) scheduled with eligible, consenting participants.` : "Approved. No eligible real participants yet — try a practice date with a demo agent below.");
                return r;
              })
            }
          >
            Approve profile & start dating
          </button>
        ) : null}
        {p.status === "approved" ? (
          <button className="btn secondary" onClick={() => void act(() => api(`/api/participants/${p.id}/pause`, { method: "POST" }))}>Pause dating</button>
        ) : null}
        <button className="btn secondary" disabled={["retrieving", "analyzing"].includes(p.status)} onClick={() => void act(() => api(`/api/participants/${p.id}/retrieve`, { method: "POST" }))}>
          Retrieve profiles again
        </button>
        <button className="btn secondary" disabled={["retrieving", "analyzing"].includes(p.status) || p.items.length === 0} onClick={() => void act(() => api(`/api/participants/${p.id}/analyze`, { method: "POST" }))}>
          Analyze again
        </button>
      </div>

      <details open={p.status === "needs_sources"}>
        <summary>Upload your LinkedIn or Instagram data export</summary>
        <ExportUpload pid={p.id} onDone={(prof) => { onChange(prof); void reload(); }} />
      </details>

      <details style={{ marginTop: 12 }}>
        <summary>Edit headline & summary</summary>
        <form
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => api(`/api/participants/${p.id}/profile`, { method: "PATCH", json: { headline, summary } })).then(() => setNotice("Saved."));
          }}
        >
          <div className="field">
            <label htmlFor="hl">Headline</label>
            <input id="hl" type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="sm">Summary</label>
            <textarea id="sm" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={800} />
          </div>
          <button className="btn small" type="submit">Save</button>
        </form>
      </details>

      <details style={{ marginTop: 12 }}>
        <summary>Edit what you told your agent</summary>
        <form
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => api(`/api/participants/${p.id}/preferences`, { method: "PUT", json: prefs })).then(() => setNotice("Preferences saved."));
          }}
        >
          <PreferenceFields value={prefs} onChange={setPrefs} />
          <button className="btn small" type="submit">Save preferences</button>
        </form>
      </details>

      {p.status === "approved" ? <PracticeDate pid={p.id} /> : null}

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        {!confirmDelete ? (
          <button className="btn danger small" onClick={() => setConfirmDelete(true)}>Delete my profile and all data</button>
        ) : (
          <div className="banner bad">
            <p>This permanently deletes your profile, retrieved content, analysis, every date transcript involving you, and your rankings.</p>
            <div className="row">
              <button
                className="btn danger small"
                onClick={async () => {
                  await api(`/api/participants/${p.id}`, { method: "DELETE" });
                  try {
                    localStorage.removeItem(`duet-manage-${p.id}`);
                  } catch {
                    // ignore
                  }
                  navigate("/mine?deleted=1");
                }}
              >
                Yes, delete everything
              </button>
              <button className="btn secondary small" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PracticeDate({ pid }: { pid: string }) {
  const { data: demos } = useApi<ParticipantSummary[]>("/api/participants?kind=demo");
  const [choice, setChoice] = useState("");
  const [error, setError] = useState<unknown>(null);
  return (
    <details style={{ marginTop: 12 }} open>
      <summary>Practice date with a fictional demo agent</summary>
      <p className="small muted" style={{ marginTop: 8 }}>
        Want to see your agent in action right away? Pick a fictional persona. Practice dates are labeled, ranked separately, and never mixed into real
        rankings.
      </p>
      <ErrorBox error={error} />
      <div className="row">
        <label htmlFor="practice" className="sr-only">Demo persona</label>
        <select id="practice" value={choice} onChange={(e) => setChoice(e.target.value)} style={{ maxWidth: 360 }}>
          <option value="">Choose a demo persona…</option>
          {(demos ?? []).map((d) => <option key={d.id} value={d.id}>{d.display_name} — {d.headline.slice(0, 50)}</option>)}
        </select>
        <button
          className="btn small"
          disabled={!choice}
          onClick={async () => {
            setError(null);
            try {
              const r = await api<{ date_id: string }>(`/api/participants/${pid}/practice`, { method: "POST", json: { demo_id: choice } });
              navigate(`/dates/${r.date_id}`);
            } catch (err) {
              setError(err);
            }
          }}
        >
          Start practice date
        </button>
      </div>
    </details>
  );
}
