import { useEffect, useRef, useState } from "react";
import { liveSocket } from "../api";
import { Avatar, ErrorBox, KindBadge, Loading, ScoreMeter, StatusBadge, useApi } from "../components";
import { Link } from "../router";
import { DIMENSIONS, type Assessment, type DateDetail, type Turn } from "../../shared/types";

type Partial = { idx: number; speaker_id: string; phase: string; text: string } | null;

export function DateRoomPage({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi<DateDetail>(`/api/dates/${id}`, (d) => (d && d.status !== "complete" && d.status !== "failed" ? 15000 : undefined));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [partial, setPartial] = useState<Partial>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [connected, setConnected] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const follow = useRef(true);

  useEffect(() => {
    if (!data) return;
    setTurns((t) => (data.turns.length >= t.length ? data.turns : t));
    setAssessment((a) => a ?? data.assessment);
    setStatus((s) => s ?? data.status);
  }, [data]);

  const finished = status === "complete" || status === "failed";
  useEffect(() => {
    if (!data || data.status === "complete") return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: number | undefined;
    const open = () => {
      ws = liveSocket(id);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = window.setTimeout(open, 3000);
      };
      ws.onmessage = (ev) => {
        const m = JSON.parse(String(ev.data));
        switch (m.type) {
          case "snapshot":
            setTurns(m.turns);
            setPartial(m.partial);
            if (m.status && m.status !== "unknown") setStatus(m.status);
            break;
          case "turn_start":
            setPartial({ idx: m.idx, speaker_id: m.speaker_id, phase: m.phase, text: "" });
            setNotice(null);
            break;
          case "delta":
            setPartial((p) => (p && p.idx === m.idx ? { ...p, text: p.text + m.text } : p));
            break;
          case "turn_complete":
            setTurns((t) => [...t.filter((x) => x.idx !== m.turn.idx), m.turn].sort((a, b) => a.idx - b.idx));
            setPartial(null);
            break;
          case "turn_reset":
            setPartial(null);
            setNotice(m.reason);
            break;
          case "status":
            if (m.status === "retrying") setNotice(m.error);
            else setStatus(m.status);
            if (m.status === "complete" || m.status === "failed") void reload();
            break;
          case "assessment":
            setAssessment(m.assessment);
            break;
        }
      };
    };
    open();
    return () => {
      closed = true;
      window.clearTimeout(retry);
      ws?.close();
    };
  }, [id, data?.status === "complete"]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onScroll = () => {
      follow.current = window.innerHeight + window.scrollY > document.body.scrollHeight - 220;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (follow.current && !finished && (partial || turns.length)) endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [partial?.text.length, turns.length, finished]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;
  if (!data) return null;

  const nameOf = (sid: string) => (sid === data.a.id ? data.a.display_name : data.b.display_name);
  const side = (sid: string) => (sid === data.a.id ? "a" : "b");
  const live = status === "running" || status === "starting" || status === "evaluating";
  const anyDemo = data.a.kind === "demo" || data.b.kind === "demo";

  return (
    <div className="stack">
      {anyDemo ? (
        <div className="banner demo">
          {data.pool === "practice" ? (
            <><strong>Practice date.</strong> {data.a.kind === "demo" ? data.a.display_name : data.b.display_name} is a fictional demo persona. Practice results are ranked separately.</>
          ) : (
            <><strong>Fictional demo date.</strong> Both people are invented personas; the conversation is a real, unscripted model conversation between their agents.</>
          )}
        </div>
      ) : null}
      <section className="card">
        <div className="row spread">
          <div className="row">
            <Link to={`/people/${data.a.id}`} className="person"><Avatar name={data.a.display_name} /> <strong>{data.a.display_name}'s agent</strong></Link>
            <span className="muted" aria-hidden="true">&</span>
            <Link to={`/people/${data.b.id}`} className="person"><Avatar name={data.b.display_name} /> <strong>{data.b.display_name}'s agent</strong></Link>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <KindBadge kind={data.a.kind === "real" && data.b.kind === "real" ? "real" : "demo"} />
            <StatusBadge status={status ?? data.status} />
            {live ? <span className="tiny muted">{connected ? "streaming" : "connecting…"}</span> : null}
          </div>
        </div>
        <div className="phase-rail" aria-label={`Turn ${turns.length} of ${data.plan.length}`}>
          {data.plan.map((p, i) => (
            <span key={i} title={p.phase} className={i < turns.length ? "done" : partial?.idx === i ? "now" : ""} />
          ))}
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          Eight turns: outing → shared interests → differences → priorities → reflection. Each agent knows only its own person's approved profile and
          what it hears. Model: {data.model ?? "pending"}.
        </p>
      </section>

      {status === "queued" || status === "starting" ? (
        <div className="banner" role="status">This date is queued. It will start automatically when a slot frees up — this page will begin streaming on its own.</div>
      ) : null}
      {notice ? <div className="banner warn" role="status">{notice}</div> : null}
      {status === "failed" ? <div className="banner bad" role="alert">This date failed after several retries: {data.error}. It has been excluded from rankings.</div> : null}

      <div className="transcript" aria-live="polite" aria-busy={!!partial}>
        {turns.map((t) => (
          <article key={t.idx} className={`bubble ${side(t.speaker_id)}`}>
            <div className="who">
              <span>{nameOf(t.speaker_id)}'s agent</span>
              <span className="badge">{t.idx + 1}. {t.phase}</span>
            </div>
            <p>{t.content}</p>
          </article>
        ))}
        {partial ? (
          <article className={`bubble ${side(partial.speaker_id)}`} aria-label="Agent is speaking">
            <div className="who">
              <span>{nameOf(partial.speaker_id)}'s agent</span>
              <span className="badge live">{partial.idx + 1}. {partial.phase}</span>
            </div>
            <p>
              {partial.text}
              <span className="cursor" aria-hidden="true" />
            </p>
          </article>
        ) : null}
        <div ref={endRef} />
      </div>

      {status === "evaluating" ? <Loading label="The separate evaluator is reading the full transcript…" /> : null}
      {assessment ? <AssessmentView a={assessment} data={data} /> : null}
    </div>
  );
}

function AssessmentView({ a, data }: { a: Assessment; data: DateDetail }) {
  return (
    <section className="card" aria-labelledby="assess-h">
      <div className="eyebrow">Separate evaluator · exploratory, not a prediction</div>
      <h2 id="assess-h">Compatibility assessment</h2>
      <p>{a.summary}</p>
      <div className="row" style={{ gap: 24, marginBottom: 12 }}>
        <div>
          <div className="score">{data.score_a ?? "—"}</div>
          <div className="small muted">for {data.a.display_name} (incl. their priorities)</div>
        </div>
        <div>
          <div className="score">{data.score_b ?? "—"}</div>
          <div className="small muted">for {data.b.display_name} (incl. their priorities)</div>
        </div>
        <span className={`badge ${a.confidence === "high" ? "good" : a.confidence === "medium" ? "warn" : "bad"}`}>Confidence: {a.confidence}</span>
      </div>
      <div className="grid grid-2">
        <div>
          <h3>Score breakdown</h3>
          {DIMENSIONS.map((d) => (
            <div key={d.key} style={{ marginBottom: 10 }}>
              <div className="row spread small">
                <span>{d.label} <span className="muted">· weight {Math.round(d.weight * 100)}%</span></span>
                <strong>{a.dimensions[d.key].score}/10</strong>
              </div>
              <ScoreMeter value={a.dimensions[d.key].score} max={10} label={d.label} />
              <div className="tiny muted" style={{ marginTop: 3 }}>{a.dimensions[d.key].rationale}</div>
            </div>
          ))}
          {(["a", "b"] as const).map((s) => (
            <div key={s} style={{ marginBottom: 10 }}>
              <div className="row spread small">
                <span>Fit with {s === "a" ? data.a.display_name : data.b.display_name}'s priorities <span className="muted">· weight 15%</span></span>
                <strong>{a.priority_fit[s].score}/10</strong>
              </div>
              <ScoreMeter value={a.priority_fit[s].score} max={10} label="Priority fit" />
              <div className="tiny muted" style={{ marginTop: 3 }}>{a.priority_fit[s].rationale}</div>
            </div>
          ))}
        </div>
        <div className="stack">
          <List title="Shared interests" items={a.shared_interests} />
          <List title="Possible friction" items={a.possible_friction} />
          <List title="Uncertainties" items={a.uncertainties} />
          <List title="Suggested next steps for the humans" items={a.next_steps} />
        </div>
      </div>
      <h3 style={{ marginTop: 16 }}>Supporting excerpts</h3>
      <p className="tiny muted">Each excerpt is checked server-side to appear verbatim in the transcript{a.dropped_excerpts ? ` (${a.dropped_excerpts} unverifiable excerpts were discarded)` : ""}.</p>
      {a.excerpts.map((e, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div className="quote small">“{e.quote}” <span className="muted">— turn {e.turn}</span></div>
          <div className="tiny muted">{e.why}</div>
        </div>
      ))}
    </section>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      {items.length ? (
        <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
          {items.map((x) => <li key={x}>{x}</li>)}
        </ul>
      ) : (
        <p className="small muted">None noted.</p>
      )}
    </div>
  );
}
