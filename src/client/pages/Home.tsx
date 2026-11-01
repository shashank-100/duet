import { useState, type FormEvent } from "react";
import { api } from "../api";
import { ErrorBox, useApi } from "../components";
import { Link, navigate } from "../router";

interface Config {
  participants: { kind: string; status: string; n: number }[];
  dates: { pool: string; status: string; n: number }[];
}

type Person = { display_name: string; linkedin_url: string; instagram_url: string };
const empty = (): Person => ({ display_name: "", linkedin_url: "", instagram_url: "" });

function PersonFields({ label, tone, value, onChange }: { label: string; tone: "a" | "b"; value: Person; onChange: (p: Person) => void }) {
  const example = tone === "a" ? "Marques Brownlee" : "Cleo Abram";
  const set = (k: keyof Person) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  return (
    <fieldset className={`card try-person ${tone}`}>
      <legend className="eyebrow">{label}</legend>
      <div className="field">
        <label htmlFor={`${tone}-name`}>Name</label>
        <input id={`${tone}-name`} type="text" required value={value.display_name} onChange={set("display_name")} placeholder={example} />
      </div>
      <div className="field">
        <label htmlFor={`${tone}-li`}>LinkedIn</label>
        <input id={`${tone}-li`} type="url" required value={value.linkedin_url} onChange={set("linkedin_url")} placeholder="https://www.linkedin.com/in/…" />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor={`${tone}-ig`}>Public Instagram</label>
        <input id={`${tone}-ig`} type="url" required value={value.instagram_url} onChange={set("instagram_url")} placeholder="https://www.instagram.com/…" />
      </div>
    </fieldset>
  );
}

export function Home() {
  const { data: config } = useApi<Config>("/api/config", 30000);
  const [a, setA] = useState<Person>(empty());
  const [b, setB] = useState<Person>(empty());
  const [permission, setPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const people = config?.participants.filter((p) => p.kind === "real" && p.status === "approved").reduce((n, p) => n + p.n, 0) ?? 0;
  const dates = config?.dates.filter((d) => d.pool === "real" && d.status === "complete").reduce((n, d) => n + d.n, 0) ?? 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ a: string; b: string }>("/api/try", { method: "POST", json: { a, b, permission } });
      navigate(`/try/${res.a}/${res.b}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <>
      <section className="try-hero">
        <p className="eyebrow">Agentic dating</p>
        <h1>
          Two people in. <em>Two agents</em> go on a date.
        </h1>
        <p className="lead muted">
          Paste a LinkedIn and a public Instagram for each person. Each agent reads only those two profiles, builds a cited profile — needs, hobbies,
          interests — then dates the other agent live. You get the transcript and a ranking of who fits each of them best.
        </p>
      </section>

      <form onSubmit={submit}>
        <div className="try-grid">
          <PersonFields label="Person A" tone="a" value={a} onChange={setA} />
          <div className="try-heart" aria-hidden="true">
            <span />
            <span />
          </div>
          <PersonFields label="Person B" tone="b" value={b} onChange={setB} />
        </div>
        <label className="check" style={{ justifyContent: "center", marginTop: 18 }}>
          <input type="checkbox" checked={permission} onChange={(e) => setPermission(e.target.checked)} />
          <span>Both profiles are public and I'm allowed to use them for this demo.</span>
        </label>
        <ErrorBox error={error} />
        <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
          <button className="btn" disabled={busy || !permission}>
            {busy ? "Sending the agents…" : "Send them on a date"}
          </button>
        </div>
      </form>

      <section className="row try-stats">
        <Link to="/people" className="card person-card">
          <div className="stat">{people}</div>
          <div className="muted small">real people with agents · see profiles</div>
        </Link>
        <Link to="/dates" className="card person-card">
          <div className="stat">{dates}</div>
          <div className="muted small">agent dates completed · read transcripts</div>
        </Link>
      </section>
    </>
  );
}
