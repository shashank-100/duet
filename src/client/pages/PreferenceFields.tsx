import { GENDERS, type Gender, type Preferences } from "../../shared/types";

export interface PrefForm {
  age: string;
  gender: Gender | "";
  open_to: Gender[];
  age_min: string;
  age_max: string;
  location: string;
  looking_for: string;
  priorities: string;
  boundaries: string;
}

export const emptyPrefs = (): PrefForm => ({ age: "", gender: "", open_to: [], age_min: "", age_max: "", location: "", looking_for: "", priorities: "", boundaries: "" });

export function prefsToForm(p: Preferences): PrefForm {
  const s = (v: number | string | null) => (v === null ? "" : String(v));
  return {
    age: s(p.age),
    gender: p.gender ?? "",
    open_to: p.open_to,
    age_min: s(p.age_min),
    age_max: s(p.age_max),
    location: s(p.location),
    looking_for: s(p.looking_for),
    priorities: s(p.priorities),
    boundaries: s(p.boundaries),
  };
}

const LABEL: Record<Gender, string> = { woman: "Women", man: "Men", nonbinary: "Nonbinary people" };
const SELF: Record<Gender, string> = { woman: "Woman", man: "Man", nonbinary: "Nonbinary" };

export function PreferenceFields({ value, onChange }: { value: PrefForm; onChange: (v: PrefForm) => void }) {
  const set = <K extends keyof PrefForm>(k: K, v: PrefForm[K]) => onChange({ ...value, [k]: v });
  return (
    <>
      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="age">Your age</label>
          <input id="age" type="number" min={18} max={99} value={value.age} onChange={(e) => set("age", e.target.value)} required />
          <p className="hint">Private. Used only to respect age ranges.</p>
        </div>
        <div className="field">
          <label htmlFor="gender">You are</label>
          <select id="gender" value={value.gender} onChange={(e) => set("gender", e.target.value as Gender | "")}>
            <option value="">Prefer not to say</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{SELF[g]}</option>
            ))}
          </select>
          <p className="hint">Private. If you don't say, you'll only match people who are open to everyone.</p>
        </div>
      </div>
      <fieldset className="field" style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
        <legend style={{ fontWeight: 600, fontSize: "0.92rem", marginBottom: 6 }}>Open to dating</legend>
        <div className="chips">
          {GENDERS.map((g) => (
            <button
              type="button"
              key={g}
              className="chip"
              aria-pressed={value.open_to.includes(g)}
              onClick={() => set("open_to", value.open_to.includes(g) ? value.open_to.filter((x) => x !== g) : [...value.open_to, g])}
            >
              {LABEL[g]}
            </button>
          ))}
        </div>
        <p className="hint">Private. Leave all unselected to be open to everyone.</p>
      </fieldset>
      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="amin">Partner age from</label>
          <input id="amin" type="number" min={18} max={99} value={value.age_min} onChange={(e) => set("age_min", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="amax">to</label>
          <input id="amax" type="number" min={18} max={99} value={value.age_max} onChange={(e) => set("age_max", e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="loc">Where you are (optional)</label>
        <input id="loc" type="text" placeholder="e.g. Brooklyn, NY" value={value.location} onChange={(e) => set("location", e.target.value)} maxLength={80} />
      </div>
      <div className="field">
        <label htmlFor="lf">What you're looking for (optional)</label>
        <textarea id="lf" value={value.looking_for} onChange={(e) => set("looking_for", e.target.value)} maxLength={400} placeholder="e.g. Something long-term with someone curious." />
      </div>
      <div className="field">
        <label htmlFor="pr">Your priorities in a partner (optional)</label>
        <textarea id="pr" value={value.priorities} onChange={(e) => set("priorities", e.target.value)} maxLength={600} placeholder="e.g. Kindness, shared weekend adventures, someone who reads." />
        <p className="hint">Your agent uses these, and each date is scored partly on how well the other person fits them.</p>
      </div>
      <div className="field">
        <label htmlFor="bd">Boundaries for your agent (optional)</label>
        <textarea id="bd" value={value.boundaries} onChange={(e) => set("boundaries", e.target.value)} maxLength={400} placeholder="e.g. Don't discuss my family or my job details." />
      </div>
    </>
  );
}
