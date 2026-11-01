import { ErrorBox, Loading, StatusBadge, useApi } from "../components";
import { Link } from "../router";

export function Mine() {
  const { data, error, loading } = useApi<{ participants: { id: string; display_name: string; status: string }[] }>("/api/me");
  const deleted = new URLSearchParams(location.search).get("deleted") === "1";
  return (
    <div className="narrow stack">
      <h1>My profile</h1>
      {deleted ? <div className="banner good" role="status">Your profile and all associated data were deleted.</div> : null}
      <ErrorBox error={error} />
      {loading ? <Loading /> : null}
      {data && data.participants.length === 0 ? (
        <div className="card">
          <p>This browser isn't linked to a profile. If you created one elsewhere, open your private manage link. Otherwise:</p>
          <Link className="btn" to="/join">Create your agent</Link>
        </div>
      ) : null}
      {data?.participants.map((p) => (
        <div key={p.id} className="card row spread">
          <span><strong>{p.display_name}</strong> <StatusBadge status={p.status} /></span>
          <span className="row">
            <Link to={`/people/${p.id}`}>Review profile</Link>
            <Link to={`/people/${p.id}/ranking`}>Ranking</Link>
          </span>
        </div>
      ))}
    </div>
  );
}
