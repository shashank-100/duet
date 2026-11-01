import { StrictMode, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Link, match, usePath } from "./router";
import { Home } from "./pages/Home";
import { Join } from "./pages/Join";
import { Manage } from "./pages/Manage";
import { Profile } from "./pages/Profile";
import { People } from "./pages/People";
import { Dates } from "./pages/Dates";
import { DateRoomPage } from "./pages/DateRoom";
import { RankingPage } from "./pages/Ranking";
import { HowItWorks } from "./pages/HowItWorks";
import { DemoSource } from "./pages/DemoSource";
import { Mine } from "./pages/Mine";

const ROUTES: [string, (p: Record<string, string>) => ReactElement][] = [
  ["/", () => <Home />],
  ["/join", () => <Join />],
  ["/mine", () => <Mine />],
  ["/manage/:id", (p) => <Manage id={p.id} />],
  ["/people", () => <People />],
  ["/example", () => <People />],
  ["/people/:id", (p) => <Profile id={p.id} />],
  ["/people/:id/ranking", (p) => <RankingPage id={p.id} />],
  ["/dates", () => <Dates />],
  ["/dates/:id", (p) => <DateRoomPage id={p.id} />],
  ["/how-it-works", () => <HowItWorks />],
  ["/demo/sources/:slug/:platform", (p) => <DemoSource slug={p.slug} platform={p.platform} />],
];

const NAV = [
  ["/people", "People"],
  ["/dates", "Dates"],
  ["/how-it-works", "How it works"],
  ["/mine", "My profile"],
] as const;

function App() {
  const path = usePath();
  let page: ReactElement | null = null;
  for (const [pattern, render] of ROUTES) {
    const params = match(pattern, path);
    if (params) {
      page = render(params);
      break;
    }
  }
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="nav">
        <nav className="nav-inner" aria-label="Main">
          <Link to="/" className="brand" aria-label="Duet home">
            <span className="brand-mark" aria-hidden="true"><span /><span /></span>
            Duet
          </Link>
          <div className="nav-links">
            {NAV.map(([to, label]) => (
              <Link key={to} to={to} aria-current={path === to || path.startsWith(`${to}/`) ? "page" : undefined}>
                {label}
              </Link>
            ))}
            <Link to="/join" className="btn small" style={{ color: "#fff" }}>Join</Link>
          </div>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {page ?? (
          <div className="narrow card">
            <h1>Page not found</h1>
            <p>
              <Link to="/">Back to Duet</Link>
            </p>
          </div>
        )}
      </main>
      <footer>
        <div className="inner">
          <span>Duet · agents explore compatibility so people can decide. Scores are exploratory, not predictions.</span>
          <span>
            <Link to="/how-it-works">Sources, privacy & limitations</Link>
          </span>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
