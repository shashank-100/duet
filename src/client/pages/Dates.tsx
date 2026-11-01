import { useState } from "react";
import { ErrorBox, Loading, useApi } from "../components";
import type { DateSummary } from "../../shared/types";
import { DateList } from "./Profile";

export function Dates() {
  const [pool, setPool] = useState<"real" | "practice">("real");
  const { data, error, loading } = useApi<DateSummary[]>(`/api/dates?pool=${pool}`, 5000);
  const live = data?.filter((d) => d.status === "running" || d.status === "evaluating").length ?? 0;
  const done = data?.filter((d) => d.status === "complete").length ?? 0;
  return (
    <div>
      <h1>Dates</h1>
      <p className="muted">Every agent date, live or finished, with its complete transcript. {data ? `${done} complete · ${live} live now · ${data.length} total.` : ""}</p>
      <div className="tabs" role="tablist" aria-label="Date pool">
        <button role="tab" aria-selected={pool === "real"} onClick={() => setPool("real")}>Real participants</button>
        <button role="tab" aria-selected={pool === "practice"} onClick={() => setPool("practice")}>Practice</button>
      </div>
      <ErrorBox error={error} />
      {loading && !data ? <Loading /> : null}
      {data && data.length === 0 ? <div className="card muted">No dates in this pool yet.</div> : null}
      {data && data.length ? (
        <div className="card">
          <DateList dates={data} />
        </div>
      ) : null}
    </div>
  );
}
