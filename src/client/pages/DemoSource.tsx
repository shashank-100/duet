import { ErrorBox, Loading, useApi } from "../components";
import { Link } from "../router";

interface Fixture {
  name: string;
  location: string;
  linkedin: { headline: string; about: string; experience: string[]; education: string; skills: string[]; volunteering?: string };
  instagram: { handle: string; bio: string; posts: string[] };
}

export function DemoSource({ slug, platform }: { slug: string; platform: string }) {
  const { data, error, loading } = useApi<Fixture>(`/api/demo/sources/${slug}`);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "Unknown persona"} />;
  const id = `demo_${slug.replace(/-/g, "_")}`;
  return (
    <div className="narrow stack">
      <div className="banner demo">
        <strong>Fictional source fixture.</strong> This page stands in for a {platform === "instagram" ? "public Instagram" : "LinkedIn"} profile of an
        invented demo persona. It is not a real person or a real account. <Link to={`/people/${id}`}>See what the agent extracted →</Link>
      </div>
      {platform === "instagram" ? (
        <section className="card">
          <h1 style={{ marginBottom: 4 }}>@{data.instagram.handle}</h1>
          <p className="muted">{data.name}</p>
          <p>{data.instagram.bio}</p>
          <h2>Posts</h2>
          {data.instagram.posts.map((p, i) => (
            <div id={`post-${i + 1}`} key={i} className="obs">{p}</div>
          ))}
        </section>
      ) : (
        <section className="card">
          <h1 style={{ marginBottom: 4 }}>{data.name}</h1>
          <p className="muted">{data.linkedin.headline} · {data.location}</p>
          <h2>About</h2>
          <p>{data.linkedin.about}</p>
          <h2>Experience</h2>
          <ul>{data.linkedin.experience.map((e) => <li key={e}>{e}</li>)}</ul>
          <h2>Education</h2>
          <p>{data.linkedin.education}</p>
          <h2>Skills</h2>
          <p>{data.linkedin.skills.join(" · ")}</p>
          {data.linkedin.volunteering ? (<><h2>Volunteering</h2><p>{data.linkedin.volunteering}</p></>) : null}
        </section>
      )}
    </div>
  );
}
