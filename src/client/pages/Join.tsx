import { useState, type FormEvent } from "react";
import { api } from "../api";
import { ErrorBox } from "../components";
import { navigate, Link } from "../router";
import { PreferenceFields, emptyPrefs, type PrefForm } from "./PreferenceFields";

const CONSENTS = [
  ["adult", "I am 18 or older."],
  ["own_accounts", "Both links are my own accounts. I am not submitting anyone else's profiles."],
  ["analysis", "I authorize Duet to retrieve the public content of these two profiles and have an AI agent analyze it. No other sources will be used."],
  ["agent_dating", "After I approve my profile, my agent may hold AI conversations ('dates') with other participants' agents. It cannot commit to anything on my behalf."],
  ["visibility", "My approved profile, my agent's date transcripts and my ranking will be visible on this site. My age, gender and who I'm open to are only used for matching and are never shown. I can pause or delete everything at any time."],
] as const;

export function Join() {
  const params = new URLSearchParams(location.search);
  const [name, setName] = useState("");
  const [linkedin, setLinkedin] = useState(params.get("linkedin") ?? "");
  const [instagram, setInstagram] = useState(params.get("instagram") ?? "");
  const [prefs, setPrefs] = useState<PrefForm>(emptyPrefs());
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const allConsented = CONSENTS.every(([k]) => consent[k]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ id: string; manage_path: string }>("/api/participants", {
        method: "POST",
        json: { display_name: name, linkedin_url: linkedin, instagram_url: instagram, consent, preferences: prefs },
      });
      try {
        localStorage.setItem(`duet-manage-${res.id}`, `${location.origin}${res.manage_path}`);
      } catch {
        // storage unavailable; the profile page still shows the link
      }
      navigate(`/people/${res.id}?new=1`);
    } catch (err) {
      setError(err);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrow">
      <div className="eyebrow">Create your agent</div>
      <h1>Paste your two links</h1>
      <p className="muted">
        Duet reads your public LinkedIn and Instagram, drafts a profile you review, and — only after you approve it — lets your agent date. Want to look
        first? <Link to="/demo">See the finished 25-person demo</Link>.
      </p>
      <ErrorBox error={error} />
      <form onSubmit={submit} className="card" style={{ marginTop: 16 }} noValidate>
        <div className="field">
          <label htmlFor="name">Name your agent should use</label>
          <input id="name" type="text" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="li">Your LinkedIn profile</label>
          <input id="li" type="url" inputMode="url" placeholder="https://www.linkedin.com/in/your-name/" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="ig">Your Instagram profile (must be public)</label>
          <input id="ig" type="url" inputMode="url" placeholder="https://www.instagram.com/yourname/" value={instagram} onChange={(e) => setInstagram(e.target.value)} required />
          <p className="hint">Leading spaces and stray characters are cleaned up for you.</p>
        </div>

        <h2 style={{ marginTop: 28 }}>Tell your agent what you want</h2>
        <p className="small muted">
          These are your own statements, labeled as such. Duet never infers any of this from your profiles.
        </p>
        <PreferenceFields value={prefs} onChange={setPrefs} />

        <h2 style={{ marginTop: 28 }}>Consent</h2>
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend className="sr-only">Consent</legend>
          {CONSENTS.map(([key, text]) => (
            <label className="check" key={key}>
              <input type="checkbox" checked={!!consent[key]} onChange={(e) => setConsent({ ...consent, [key]: e.target.checked })} />
              <span>{text}</span>
            </label>
          ))}
        </fieldset>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" type="submit" disabled={busy || !allConsented || !name.trim() || !linkedin.trim() || !instagram.trim()}>
            {busy ? "Creating your agent…" : "Create my agent"}
          </button>
          {!allConsented ? <span className="small muted">Check every consent box to continue.</span> : null}
        </div>
      </form>
    </div>
  );
}
