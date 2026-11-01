// LinkedIn retrieval through Context.dev's web scrape (server-side key). It returns the public,
// logged-out profile page as Markdown; we keep only the person's own sections (top card, About,
// Experience, Education, …) and drop LinkedIn chrome, posts by other people and "similar profiles".

import { pushItem, type RetrievalResult, type RetrievedItem } from "./types";

export interface ContextDevEnv {
  CONTEXT_DEV_API_KEY?: string;
}

const KEEP = /^(about|experience|education|licenses|certifications|volunteer|languages|projects|honors|awards|publications|courses|skills|organizations|recommendations received)/i;
const BOILERPLATE =
  /sign in|join now|join to view|password|forgot|email or phone|skip to|cookie|user agreement|privacy policy|^show$|^or$|^message$|report this|mutual connections|can introduce you|contact info$|see more$|see less$|new to linkedin|welcome back|^-?\s*copy$|^-?\s*(linkedin|facebook|x)$/i;

/** Pulls the person's own profile sections out of LinkedIn's public-page Markdown. */
export function linkedInFromMarkdown(markdown: string, url: string): RetrievedItem[] {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\\\*)+/g, "")
    .replace(/\\_/g, "_")
    .replace(/\*\*/g, "");
  const items: RetrievedItem[] = [];
  // pre: LinkedIn nav, before the "# Name" heading. top: the profile card. Then named sections.
  let state: "pre" | "top" | "keep" | "skip" = "pre";
  let section = "";
  const top: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (state === "keep" && buf.length) {
      const field = section.toLowerCase().replace(/&/g, "and").split(/\s+/)[0];
      const body = buf.join(" ").replace(/\s+/g, " ").trim();
      for (const part of body.match(/.{1,600}(\s|$)/g) ?? []) pushItem(items, field, url, part.trim());
    }
    buf = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^[\s>*-]+/, "").trim();
    if (!line || /^[\s*.…]+$/.test(line)) continue;
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h?.[1] === "#") {
      if (state === "pre") state = "top";
      continue;
    }
    if (state === "pre") continue;
    if (h?.[1] === "##") {
      const name = h[2].trim();
      if (KEEP.test(name)) {
        flush();
        state = "keep";
        section = name;
      } else if (/^activity$|similar profiles|people also viewed|explore|others named|add new skills|more profiles/i.test(name)) {
        flush();
        state = "skip";
      } else if (state === "keep") {
        flush();
        state = "skip";
      }
      // Other headings ("Sign in to view…", "View mutual connections…") are LinkedIn prompts: ignore them.
      continue;
    }
    const loc = line.match(/^#+\s*(.+?)\s+Contact Info$/i);
    if (state === "skip" || (!loc && BOILERPLATE.test(line))) continue;
    if (state === "top") {
      if (loc) top.push(`Location: ${loc[1]}`);
      else if (!/followers|connections/i.test(line)) top.push(line.replace(/^#+\s*/, ""));
    } else if (state === "keep" && !/^(view|see) .*(full|their)/i.test(line.replace(/^#+\s*/, ""))) {
      buf.push(line.replace(/^#+\s*/, ""));
    }
  }
  flush();
  const seen = new Set<string>();
  for (const l of top) {
    if (l.length < 2 || l.length > 220 || seen.has(l)) continue;
    seen.add(l);
    pushItem(items, l.startsWith("Location:") ? "location" : "headline", url, l.replace(/^Location:\s*/, ""));
    if (seen.size >= 6) break;
  }
  return items;
}

export async function retrieveLinkedInContextDev(env: ContextDevEnv, url: string): Promise<RetrievalResult> {
  const base = { platform: "linkedin" as const, method: "context_dev", url };
  if (!env.CONTEXT_DEV_API_KEY) return { ...base, status: "not_configured", http_status: null, detail: "Context.dev is not configured.", items: [] };
  let res: Response;
  try {
    res = await fetch("https://api.context.dev/v1/web/scrape", {
      method: "POST",
      headers: { authorization: `Bearer ${env.CONTEXT_DEV_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ url, formats: { markdown: true }, maxAgeMs: 86_400_000 }),
    });
  } catch (err) {
    return { ...base, status: "error", http_status: null, detail: `Context.dev request failed: ${(err as Error).message}`, items: [] };
  }
  if (!res.ok) return { ...base, status: "error", http_status: res.status, detail: `Context.dev returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`, items: [] };
  const data = (await res.json()) as { markdown?: { success?: boolean; data?: string | null; message?: string } };
  const md = data.markdown?.data ?? "";
  if (!data.markdown?.success || !md) return { ...base, status: "empty", http_status: res.status, detail: `Context.dev could not read the page${data.markdown?.message ? `: ${data.markdown.message}` : "."}`, items: [] };
  const items = linkedInFromMarkdown(md, url);
  return {
    ...base,
    status: items.length ? "ok" : "empty",
    http_status: res.status,
    detail: items.length ? `Read ${items.length} public profile sections.` : "The public page had no profile sections to read.",
    items,
  };
}
