// Canonicalizes the only two kinds of links Duet accepts.

export class LinkError extends Error {}

export function normalizeLinkedIn(raw: string): string {
  const u = parse(raw);
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) throw new LinkError("That is not a linkedin.com link. Paste your profile link, like https://www.linkedin.com/in/your-name/.");
  const m = u.pathname.match(/^\/in\/([^/]+)\/?$/);
  if (!m) throw new LinkError("Paste your LinkedIn profile link (it contains /in/your-name), not a post, company or search page.");
  const slug = decodeURIComponent(m[1]);
  if (!/^[\p{L}\p{N}_-]{3,100}$/u.test(slug)) throw new LinkError("That LinkedIn profile name looks malformed.");
  return `https://www.linkedin.com/in/${encodeURIComponent(slug)}/`;
}

export function normalizeInstagram(raw: string): string {
  const u = parse(raw);
  if (!/^(www\.)?instagram\.com$/i.test(u.hostname)) throw new LinkError("That is not an instagram.com link. Paste your profile link, like https://www.instagram.com/yourname/.");
  const m = u.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/);
  const reserved = ["p", "reel", "reels", "explore", "accounts", "stories", "direct", "tv"];
  if (!m || reserved.includes(m[1].toLowerCase())) throw new LinkError("Paste your Instagram profile link, not a post, reel or explore page.");
  return `https://www.instagram.com/${m[1].toLowerCase()}/`;
}

export function instagramUsername(url: string): string {
  return new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
}

function parse(raw: string): URL {
  const trimmed = raw.trim().replace(/[​-‍﻿]/g, "");
  if (!trimmed) throw new LinkError("A link is required.");
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (u.username || u.password) throw new LinkError("Links with embedded credentials are not accepted.");
    return u;
  } catch (err) {
    if (err instanceof LinkError) throw err;
    throw new LinkError("That does not look like a web link.");
  }
}
