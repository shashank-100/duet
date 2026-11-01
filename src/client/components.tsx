import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { Link } from "./router";
import type { ParticipantKind } from "../shared/types";

const PALETTE = ["#b8466a", "#c0703a", "#7b4fa8", "#3f7d86", "#a8456f", "#8a5a2b", "#5a5fb0", "#9b3f52"];

export function Avatar({ name, size, src }: { name: string; size?: "lg"; src?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img className={`avatar photo ${size ?? ""}`} src={src} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} />;
  }
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className={`avatar ${size ?? ""}`} style={{ background: PALETTE[h % PALETTE.length] }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function KindBadge({ kind }: { kind: ParticipantKind }) {
  return kind === "demo" ? (
    <span className="badge demo" title="Fictional persona created for the demo. Not a real person.">Fictional demo</span>
  ) : (
    <span className="badge real" title="A real, consenting participant who submitted their own links.">Real participant</span>
  );
}

const STATUS: Record<string, [string, string]> = {
  submitted: ["Queued", "warn"],
  retrieving: ["Reading profiles", "live"],
  analyzing: ["Analyzing", "live"],
  needs_sources: ["Needs sources", "bad"],
  draft_ready: ["Draft ready for review", "warn"],
  approved: ["Approved · dating", "good"],
  paused: ["Paused", ""],
  error: ["Error", "bad"],
  queued: ["Queued", ""],
  starting: ["Starting", "live"],
  running: ["Live now", "live"],
  evaluating: ["Evaluating", "live"],
  complete: ["Complete", "good"],
  failed: ["Failed", "bad"],
  ok: ["Retrieved", "good"],
  empty: ["Nothing readable", "warn"],
  blocked: ["Blocked", "bad"],
  private: ["Private account", "bad"],
  not_found: ["Not found", "bad"],
  not_configured: ["Not configured", ""],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, tone] = STATUS[status] ?? [status, ""];
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="row muted" role="status">
      <span className="spinner" aria-hidden="true" /> {label}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="banner bad" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

/** Fetches JSON and optionally re-polls while `pollMs` is set. */
export function useApi<T>(path: string | null, pollMs?: number | ((data: T | null) => number | undefined)) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const dataRef = useRef<T | null>(null);
  const load = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api<T>(path);
      dataRef.current = d;
      setData(d);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setLoading(true);
    setData(null);
    dataRef.current = null;
    void load();
  }, [load]);
  useEffect(() => {
    if (!path || !pollMs) return;
    let timer: number;
    const tick = () => {
      const ms = typeof pollMs === "function" ? pollMs(dataRef.current) : pollMs;
      if (!ms) {
        timer = window.setTimeout(tick, 3000);
        return;
      }
      timer = window.setTimeout(async () => {
        if (document.visibilityState === "visible") await load();
        tick();
      }, ms);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [path, pollMs, load]);
  return { data, error, loading, reload: load, setData };
}

export function PersonLink({ id, name, kind, children, avatar }: { id: string; name: string; kind?: ParticipantKind; children?: ReactNode; avatar?: string | null }) {
  return (
    <Link to={`/people/${id}`} className="person">
      <Avatar name={name} src={avatar} />
      <span>
        <strong>{name}</strong>
        {kind ? (
          <>
            {" "}
            <KindBadge kind={kind} />
          </>
        ) : null}
        {children}
      </span>
    </Link>
  );
}

export function ScoreMeter({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  return (
    <div className="meter" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <span style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}
