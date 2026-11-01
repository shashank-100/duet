import { Avatar, useApi } from "../components";
import { Link } from "../router";
import type { ProfileDetail } from "../../shared/types";

interface DateRow {
  id: string;
  status: string;
  turn_count: number;
  a: { id: string };
  b: { id: string };
}

type StepState = "todo" | "now" | "done" | "fail";
type Ev = ProfileDetail["events"][number];

const FAIL = ["error", "blocked", "private", "not_found", "empty"];

/** Turns the person's ingest events into four plain-language steps. */
function personSteps(p: ProfileDetail | null): { label: string; state: StepState; note?: string }[] {
  const ev: Ev[] = p?.events ?? [];
  const last = (step: string) => [...ev].reverse().find((e) => e.step === step);
  const platform = (name: "linkedin" | "instagram", label: string) => {
    const all = ev.filter((e) => e.step === `retrieve_${name}`);
    const ok = all.find((e) => e.status === "ok");
    if (ok) return { label, state: "done" as StepState, note: ok.message };
    const started = ev.some((e) => e.step === "retrieve");
    if (all.length && p && !["submitted", "retrieving"].includes(p.status)) return { label, state: "fail" as StepState, note: all[all.length - 1].message };
    return { label, state: (started ? "now" : "todo") as StepState, note: all.length ? all[all.length - 1].message : started ? "Scraping the public profile…" : undefined };
  };
  const analyze = last("analyze");
  const approved = p?.status === "approved";
  return [
    platform("linkedin", "Reading LinkedIn"),
    platform("instagram", "Reading Instagram"),
    {
      label: "Agent analysing the person",
      state: analyze?.status === "ok" ? "done" : analyze && FAIL.includes(analyze.status) ? "fail" : p?.status === "analyzing" ? "now" : "todo",
      note: analyze?.message ?? (p?.status === "analyzing" ? "Finding needs, hobbies, interests and qualities — every claim must quote a source…" : undefined),
    },
    { label: "Profile ready, agent can date", state: approved ? "done" : p?.status === "error" || p?.status === "needs_sources" ? "fail" : "todo", note: approved ? p?.headline || undefined : p?.status_detail ?? undefined },
  ];
}

function Steps({ steps }: { steps: { label: string; state: StepState; note?: string }[] }) {
  return (
    <ol className="pipe">
      {steps.map((s) => (
        <li key={s.label} className={s.state}>
          <span className="pipe-dot">{s.state === "done" ? "✓" : s.state === "fail" ? "!" : s.state === "now" ? <span className="spinner" /> : ""}</span>
          <div>
            <div className="pipe-label">{s.label}</div>
            {s.note ? <div className="pipe-note">{s.note}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function PersonCard({ p, tone }: { p: ProfileDetail | null; tone: "a" | "b" }) {
  return (
    <div className={`card try-person ${tone}`}>
      <div className="row" style={{ alignItems: "center", marginBottom: 14 }}>
        <Avatar name={p?.display_name ?? "?"} src={p?.avatar_url} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>{tone === "a" ? "Person A" : "Person B"}</div>
          <h2 style={{ margin: 0 }}>{p?.display_name ?? "…"}</h2>
        </div>
      </div>
      <Steps steps={personSteps(p)} />
      {p?.status === "approved" ? (
        <p className="small" style={{ margin: "12px 0 0" }}>
          <Link to={`/people/${p.id}`}>Profile &amp; analysis</Link> · <Link to={`/people/${p.id}/ranking`}>Ranking</Link>
        </p>
      ) : null}
    </div>
  );
}

export function TryPage({ a, b }: { a: string; b: string }) {
  const pa = useApi<ProfileDetail>(`/api/participants/${a}`, 3000);
  const pb = useApi<ProfileDetail>(`/api/participants/${b}`, 3000);
  const dates = useApi<DateRow[]>(`/api/dates?participant=${a}`, 3000);
  const date = dates.data?.find((d) => (d.a.id === a && d.b.id === b) || (d.a.id === b && d.b.id === a));
  const both = pa.data?.status === "approved" && pb.data?.status === "approved";
  const dateSteps: { label: string; state: StepState; note?: string }[] = [
    {
      label: "Agents go on a date",
      state: date ? (date.status === "complete" || date.status === "evaluating" ? "done" : "now") : both ? "now" : "todo",
      note: date ? `${date.turn_count}/8 turns — outing → shared interests → going deeper → differences → priorities → reflection → closing` : both ? "Starting the date…" : "Starts as soon as both agents have read their person.",
    },
    {
      label: "Scoring the date & ranking",
      state: date?.status === "complete" ? "done" : date?.status === "evaluating" ? "now" : "todo",
      note: date?.status === "complete" ? "A separate evaluator scored the date on six criteria; both rankings are updated." : date?.status === "evaluating" ? "The evaluator is reading the transcript…" : undefined,
    },
  ];

  return (
    <div className="narrow" style={{ maxWidth: 1040 }}>
      <p className="eyebrow">Your pair · live</p>
      <h1>
        {pa.data?.display_name ?? "…"} <em>&amp;</em> {pb.data?.display_name ?? "…"}
      </h1>
      <div className="try-grid" style={{ alignItems: "stretch" }}>
        <PersonCard p={pa.data} tone="a" />
        <div className="try-heart" aria-hidden="true" style={{ alignSelf: "center" }}>
          <span />
          <span />
        </div>
        <PersonCard p={pb.data} tone="b" />
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <Steps steps={dateSteps} />
        {date ? (
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="btn" to={`/dates/${date.id}`}>{date.status === "complete" ? "Read the date" : "Watch it live"}</Link>
            {date.status === "complete" ? (
              <>
                <Link className="btn secondary" to={`/people/${a}/ranking`}>{pa.data?.display_name}'s ranking</Link>
                <Link className="btn secondary" to={`/people/${b}/ranking`}>{pb.data?.display_name}'s ranking</Link>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
