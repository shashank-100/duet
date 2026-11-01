// Logged-out fetch of the public profile page, with an honest User-Agent and no evasion.
// In practice LinkedIn answers 999/429/authwall and Instagram returns only page metadata,
// so this mostly documents *why* retrieval failed. It never pretends to have more than it got.

import { pushItem, type RetrievalResult, type RetrievedItem } from "./types";

const UA = "DuetProfileReader/1.0 (+https://github.com/; reads participant-submitted public profiles with consent)";

function meta(html: string, prop: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i");
  const m = html.match(re);
  return m ? decodeEntities(m[1]) : "";
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function get(url: string): Promise<{ status: number; html: string; finalUrl: string }> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow" });
  const reader = res.body?.getReader();
  let html = "";
  if (reader) {
    const dec = new TextDecoder();
    // Cap at 1.5 MB; we only need the document head.
    while (html.length < 1_500_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
    }
    await reader.cancel().catch(() => undefined);
  }
  return { status: res.status, html, finalUrl: res.url };
}

export function parseLinkedInHtml(html: string, url: string): RetrievedItem[] {
  const items: RetrievedItem[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]) as { "@graph"?: unknown[] } & Record<string, unknown>;
      const nodes = (data["@graph"] ?? [data]) as Record<string, unknown>[];
      for (const n of nodes) {
        if (n["@type"] !== "Person") continue;
        pushItem(items, "name", url, n.name);
        pushItem(items, "headline", url, n.jobTitle);
        pushItem(items, "about", url, n.description);
      }
    } catch {
      // ignore malformed blocks
    }
  }
  if (!items.length) {
    const title = meta(html, "og:title");
    const desc = meta(html, "og:description");
    if (title && !/sign ?(in|up)|log ?in|join linkedin/i.test(title)) pushItem(items, "headline", url, title);
    if (desc && !/sign ?(in|up)|join linkedin/i.test(desc)) pushItem(items, "about", url, desc);
  }
  return items;
}

export async function retrieveLinkedInDirect(url: string): Promise<RetrievalResult> {
  const base = { platform: "linkedin" as const, method: "public_fetch", url };
  let r: Awaited<ReturnType<typeof get>>;
  try {
    r = await get(url);
  } catch (err) {
    return { ...base, status: "error", http_status: null, detail: `Network error reaching LinkedIn: ${(err as Error).message}`, items: [] };
  }
  if (r.status === 999 || r.status === 429 || r.status === 403 || /authwall|\/login|checkpoint/i.test(r.finalUrl)) {
    return {
      ...base,
      status: "blocked",
      http_status: r.status,
      detail: `LinkedIn refused a logged-out request (HTTP ${r.status}${/authwall/i.test(r.finalUrl) ? ", sign-in wall" : ""}). This is LinkedIn's normal response to servers.`,
      items: [],
    };
  }
  if (r.status === 404) return { ...base, status: "not_found", http_status: 404, detail: "LinkedIn says this profile does not exist. Check the /in/ link.", items: [] };
  if (r.status >= 400) return { ...base, status: "error", http_status: r.status, detail: `LinkedIn returned HTTP ${r.status}.`, items: [] };
  const items = parseLinkedInHtml(r.html, url);
  return {
    ...base,
    status: items.length ? "ok" : "empty",
    http_status: r.status,
    detail: items.length ? `Read ${items.length} fields from the public profile page.` : "The page loaded but exposed no public profile text to a logged-out reader.",
    items,
  };
}

export function parseInstagramHtml(html: string, url: string): RetrievedItem[] {
  const items: RetrievedItem[] = [];
  const title = meta(html, "og:title");
  // og:title looks like: "Name (@handle) • Instagram photos and videos"
  const name = title.match(/^(.*?)\s*\(@[^)]+\)/)?.[1];
  if (name) pushItem(items, "name", url, name);
  // Some page variants include the bio in the description after the counts.
  const desc = meta(html, "description");
  const bio = desc.match(/on Instagram:\s*"([\s\S]+)"\s*$/)?.[1];
  if (bio) pushItem(items, "bio", url, bio);
  return items;
}

export async function retrieveInstagramDirect(url: string): Promise<RetrievalResult> {
  const base = { platform: "instagram" as const, method: "public_fetch", url };
  let r: Awaited<ReturnType<typeof get>>;
  try {
    r = await get(url);
  } catch (err) {
    return { ...base, status: "error", http_status: null, detail: `Network error reaching Instagram: ${(err as Error).message}`, items: [] };
  }
  if (r.status === 404) return { ...base, status: "not_found", http_status: 404, detail: "Instagram says this account does not exist. Check the username.", items: [] };
  if (r.status === 429 || r.status === 403 || /accounts\/login/i.test(r.finalUrl)) {
    return { ...base, status: "blocked", http_status: r.status, detail: `Instagram sent a logged-out request to its login wall (HTTP ${r.status}).`, items: [] };
  }
  if (r.status >= 400) return { ...base, status: "error", http_status: r.status, detail: `Instagram returned HTTP ${r.status}.`, items: [] };
  if (/This account is private/i.test(r.html)) {
    return { ...base, status: "private", http_status: r.status, detail: "This Instagram account is private. Duet only reads public accounts.", items: [] };
  }
  const items = parseInstagramHtml(r.html, url);
  const hasBio = items.some((i) => i.field === "bio");
  return {
    ...base,
    status: hasBio ? "ok" : items.length ? "empty" : "blocked",
    http_status: r.status,
    detail: hasBio
      ? "Read the display name and bio from the public page."
      : items.length
        ? "Instagram only exposed the display name to a logged-out reader — no bio or posts."
        : "Instagram returned a page without profile data (logged-out readers are usually shown a login prompt).",
    items,
  };
}
