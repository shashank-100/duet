// Retrieval through Apify actors (server-side token). Apify runs the actual page fetching;
// Duet only asks for profile fields and never requests email or contact enrichment.

import { instagramUsername } from "./urls";
import { clean, pushItem, type RetrievalResult, type RetrievedItem } from "./types";

export interface ApifyEnv {
  APIFY_TOKEN?: string;
  LINKEDIN_ACTOR?: string;
  INSTAGRAM_ACTOR?: string;
  LINKEDIN_INPUT?: string;
  INSTAGRAM_INPUT?: string;
}

type Json = Record<string, unknown>;

export function fillTemplate(template: string, vars: Record<string, string>): unknown {
  const value = JSON.parse(template) as unknown;
  const sub = (v: unknown): unknown =>
    typeof v === "string"
      ? v.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "")
      : Array.isArray(v)
        ? v.map(sub)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)]))
          : v;
  return sub(value);
}

async function runActor(env: ApifyEnv, actor: string, input: unknown): Promise<{ status: number; items: Json[]; body: string }> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?timeout=180&format=json&clean=true`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${env.APIFY_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  const body = await res.text();
  if (!res.ok) return { status: res.status, items: [], body };
  const parsed = JSON.parse(body) as unknown;
  return { status: res.status, items: Array.isArray(parsed) ? (parsed as Json[]) : [], body: "" };
}

function notConfigured(platform: "linkedin" | "instagram", url: string): RetrievalResult {
  return {
    platform,
    method: "apify",
    url,
    status: "not_configured",
    http_status: null,
    detail: "The Apify retriever is not configured on this deployment (no APIFY_TOKEN), so it was skipped.",
    items: [],
  };
}

function failure(platform: "linkedin" | "instagram", url: string, status: number, body: string): RetrievalResult {
  const hint =
    status === 402 || /credit|billing|payment/i.test(body)
      ? "The operator's Apify account is out of credit."
      : status === 401 || status === 403
        ? "The operator's Apify token was rejected."
        : status === 408 || /timed? ?out/i.test(body)
          ? "The scraper timed out; retry in a minute."
          : "The scraper failed.";
  return { platform, method: "apify", url, status: "error", http_status: status, detail: `${hint} (Apify HTTP ${status})`, items: [] };
}

const str = (o: Json, ...keys: string[]): string => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
};
const arr = (o: Json, ...keys: string[]): Json[] => {
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v.filter((x): x is Json => !!x && typeof x === "object");
  }
  return [];
};

/** Maps a LinkedIn profile record to source items. Contact details and birthdays are never kept. */
export function linkedInItems(record: Json, url: string): RetrievedItem[] {
  const items: RetrievedItem[] = [];
  const name = [str(record, "firstName"), str(record, "lastName")].filter(Boolean).join(" ") || str(record, "fullName", "name");
  pushItem(items, "name", url, name);
  pushItem(items, "headline", url, str(record, "headline", "occupation", "jobTitle"));
  pushItem(items, "about", url, str(record, "about", "summary", "description"));
  const loc = record.location;
  pushItem(items, "location", url, typeof loc === "string" ? loc : loc && typeof loc === "object" ? str(loc as Json, "linkedinText", "default", "text") : "");
  for (const e of arr(record, "experience", "experiences", "positions").slice(0, 12)) {
    const title = str(e, "position", "title", "jobTitle");
    const company = str(e, "companyName", "company", "subtitle");
    const when = str(e, "duration", "caption", "dateRange");
    const desc = str(e, "description");
    pushItem(items, "experience", url, `${title}${company ? ` at ${company}` : ""}${when ? ` (${when})` : ""}${desc ? `: ${desc}` : ""}`);
  }
  for (const e of arr(record, "education", "educations").slice(0, 6)) {
    const school = str(e, "schoolName", "school", "title");
    const degree = [str(e, "degree", "degreeName", "subtitle"), str(e, "fieldOfStudy")].filter(Boolean).join(", ");
    const extra = str(e, "activities", "description");
    pushItem(items, "education", url, `${school}${degree ? ` — ${degree}` : ""}${extra ? `. ${extra}` : ""}`);
  }
  const skills = arr(record, "skills").map((s) => str(s, "name", "title")).filter(Boolean);
  if (skills.length) pushItem(items, "skills", url, `Skills: ${skills.slice(0, 40).join(", ")}`);
  for (const key of ["projects", "volunteering", "volunteerExperience", "certifications", "honorsAndAwards", "courses", "publications"]) {
    for (const e of arr(record, key).slice(0, 6)) {
      const title = str(e, "title", "name", "role");
      const org = str(e, "organization", "issuedBy", "companyName", "subtitle");
      const desc = str(e, "description");
      pushItem(items, key === "volunteerExperience" ? "volunteering" : key, url, `${title}${org ? ` — ${org}` : ""}${desc ? `: ${desc}` : ""}`);
    }
  }
  const langs = arr(record, "languages").map((l) => str(l, "name", "title")).filter(Boolean);
  if (langs.length) pushItem(items, "languages", url, `Languages: ${langs.join(", ")}`);
  return items.slice(0, 60);
}

export function instagramItems(record: Json, url: string): RetrievedItem[] {
  const items: RetrievedItem[] = [];
  pushItem(items, "name", url, str(record, "fullName", "full_name"));
  pushItem(items, "bio", url, str(record, "biography", "bio"));
  pushItem(items, "category", url, str(record, "businessCategoryName", "category"));
  for (const p of arr(record, "latestPosts", "posts").slice(0, 12)) {
    const caption = str(p, "caption", "text");
    const postUrl = str(p, "url") || (str(p, "shortCode") ? `https://www.instagram.com/p/${str(p, "shortCode")}/` : url);
    const when = str(p, "timestamp").slice(0, 10);
    if (clean(caption)) pushItem(items, "post", postUrl, `${when ? `[${when}] ` : ""}${caption}`);
  }
  return items;
}

export async function retrieveLinkedInApify(env: ApifyEnv, url: string): Promise<RetrievalResult> {
  if (!env.APIFY_TOKEN || !env.LINKEDIN_ACTOR || !env.LINKEDIN_INPUT) return notConfigured("linkedin", url);
  const { status, items, body } = await runActor(env, env.LINKEDIN_ACTOR, fillTemplate(env.LINKEDIN_INPUT, { url }));
  if (status >= 400) return failure("linkedin", url, status, body);
  const record = items.find((i) => !i.error && !i.errorDescription);
  if (!record) {
    const err = items[0] ? str(items[0], "error", "errorDescription", "message") : "";
    return { platform: "linkedin", method: "apify", url, status: "not_found", http_status: status, detail: `The scraper returned no profile for this link${err ? ` (${err})` : ""}. Check the link is your public profile URL.`, items: [] };
  }
  const out = linkedInItems(record, url);
  const photo = str(record, "photo", "profilePicture", "profilePictureUrl", "pictureUrl", "profilePicHighQuality", "profilePic");
  return {
    avatar: /^https:\/\//.test(photo) ? photo : undefined,
    platform: "linkedin",
    method: "apify",
    url,
    status: out.length ? "ok" : "empty",
    http_status: status,
    detail: out.length ? `Retrieved ${out.length} public profile sections.` : "The profile was found but had no public text sections.",
    items: out,
  };
}

export async function retrieveInstagramApify(env: ApifyEnv, url: string): Promise<RetrievalResult> {
  if (!env.APIFY_TOKEN || !env.INSTAGRAM_ACTOR || !env.INSTAGRAM_INPUT) return notConfigured("instagram", url);
  const username = instagramUsername(url);
  const { status, items, body } = await runActor(env, env.INSTAGRAM_ACTOR, fillTemplate(env.INSTAGRAM_INPUT, { url, username }));
  if (status >= 400) return failure("instagram", url, status, body);
  const record = items.find((i) => !i.error && (str(i, "username") || "").toLowerCase() === username) ?? items.find((i) => !i.error);
  if (!record) return { platform: "instagram", method: "apify", url, status: "not_found", http_status: status, detail: "No Instagram account was found at this link. Check the username.", items: [] };
  if (record.private === true || record.isPrivate === true) {
    return { platform: "instagram", method: "apify", url, status: "private", http_status: status, detail: "This Instagram account is private. Duet only reads public accounts — switch it to public or upload your Instagram data export.", items: [] };
  }
  const out = instagramItems(record, url);
  const pic = str(record, "profilePicUrlHD", "profilePicUrl", "profile_pic_url_hd", "profile_pic_url");
  return {
    avatar: /^https:\/\//.test(pic) ? pic : undefined,
    platform: "instagram",
    method: "apify",
    url,
    status: out.length ? "ok" : "empty",
    http_status: status,
    detail: out.length ? `Retrieved bio and ${out.filter((i) => i.field === "post").length} recent post captions.` : "The account is public but has no bio or captions to read.",
    items: out,
  };
}
