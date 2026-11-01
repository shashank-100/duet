import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorBox, Loading } from "../components";
import { navigate } from "../router";

/** /manage/<id>#<token> — the private link. The token stays in the fragment, so it never hits server logs. */
export function Manage({ id }: { id: string }) {
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const token = location.hash.slice(1);
    if (!token) {
      setError(new Error("This manage link is incomplete — copy the whole link, including the part after #."));
      return;
    }
    api("/api/session", { method: "POST", json: { id, token } })
      .then(() => {
        try {
          localStorage.setItem(`duet-manage-${id}`, location.href);
        } catch {
          // ignore
        }
        navigate(`/people/${id}`, true);
      })
      .catch(setError);
  }, [id]);
  return <div className="narrow">{error ? <ErrorBox error={error} /> : <Loading label="Opening your profile…" />}</div>;
}
