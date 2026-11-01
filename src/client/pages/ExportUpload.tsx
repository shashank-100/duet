import { useState } from "react";
import { unzipSync, strFromU8 } from "fflate";
import { api } from "../api";
import { ErrorBox } from "../components";
import type { ProfileDetail } from "../../shared/types";

// Only these files are ever sent to the server; everything else in the archive stays on your device.
const WANTED = {
  linkedin: /(^|\/)(Profile|Positions|Education|Skills|Projects|Volunteering|Certifications|Honors|Languages)\.csv$/i,
  instagram: /(^|\/)(personal_information|posts_\d+)\.json$/i,
};

async function collect(platform: "linkedin" | "instagram", files: FileList): Promise<{ name: string; text: string }[]> {
  const out: { name: string; text: string }[] = [];
  for (const f of Array.from(files)) {
    if (/\.zip$/i.test(f.name)) {
      const entries = unzipSync(new Uint8Array(await f.arrayBuffer()), { filter: (e) => WANTED[platform].test(e.name) });
      for (const [name, bytes] of Object.entries(entries)) out.push({ name, text: strFromU8(bytes) });
    } else if (WANTED[platform].test(f.name)) {
      out.push({ name: f.name, text: await f.text() });
    }
  }
  return out;
}

export function ExportUpload({ pid, onDone }: { pid: string; onDone: (p: ProfileDetail) => void }) {
  const [platform, setPlatform] = useState<"linkedin" | "instagram">("linkedin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<string | null>(null);
  return (
    <div style={{ marginTop: 12 }}>
      <p className="small">
        If Duet couldn't read a profile (LinkedIn and Instagram often block automated readers), you can supply the same profile yourself via the
        platform's official data download. Only profile text and post captions are read; the file filter runs in your browser, so messages,
        contacts and everything else in the archive never leave your device.
      </p>
      <ul className="small muted">
        <li>
          <strong>LinkedIn:</strong> Settings → Data privacy → Get a copy of your data → choose “Profile”, “Positions”, “Skills”, “Education” → upload the .zip
          (or the CSV files).
        </li>
        <li>
          <strong>Instagram:</strong> Accounts Center → Your information and permissions → Download your information → format <em>JSON</em>, include
          “Personal information” and “Content” → upload the .zip (or <code>personal_information.json</code> and <code>posts_1.json</code>).
        </li>
      </ul>
      <ErrorBox error={error} />
      {result ? <div className="banner good" role="status">{result}</div> : null}
      <div className="row">
        <label htmlFor="exp-platform" className="sr-only">Platform</label>
        <select id="exp-platform" value={platform} onChange={(e) => setPlatform(e.target.value as "linkedin" | "instagram")} style={{ maxWidth: 200 }}>
          <option value="linkedin">LinkedIn export</option>
          <option value="instagram">Instagram export</option>
        </select>
        <label className="btn secondary small" style={{ marginBottom: 0 }}>
          {busy ? "Reading…" : "Choose file(s)"}
          <input
            type="file"
            className="sr-only"
            multiple
            accept=".zip,.csv,.json"
            disabled={busy}
            onChange={async (e) => {
              const files = e.target.files;
              if (!files?.length) return;
              setBusy(true);
              setError(null);
              setResult(null);
              try {
                const picked = await collect(platform, files);
                if (!picked.length) throw new Error("None of the expected files were found. Check you picked the right platform and export format (JSON for Instagram).");
                const r = await api<{ result: { status: string; detail: string }; profile: ProfileDetail }>(`/api/participants/${pid}/exports`, {
                  method: "POST",
                  json: { platform, files: picked },
                });
                setResult(`${r.result.detail}${r.result.status === "ok" ? " Now press “Analyze again”." : ""}`);
                onDone(r.profile);
              } catch (err) {
                setError(err);
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}
