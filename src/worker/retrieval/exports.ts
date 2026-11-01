// Parses a participant's own LinkedIn / Instagram data export ("Download your data").
// Only profile text and post captions are kept. Addresses, birthdays, phone numbers,
// messages, connections, ads data and logins are ignored even when present.

import { pushItem, type RetrievalResult, type RetrievedItem } from "./types";

export interface UploadedFile {
  name: string;
  text: string;
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  // LinkedIn sometimes prefixes CSVs with a "Notes:" block that ends at a blank line.
  const blank = (r: string[]) => r.every((c) => !c.trim());
  let headerIdx = 0;
  if (rows[0]?.[0]?.trim().startsWith("Notes")) {
    const end = rows.findIndex(blank);
    headerIdx = end < 0 ? rows.length : end;
  }
  while (headerIdx < rows.length && blank(rows[headerIdx])) headerIdx++;
  if (headerIdx >= rows.length) return [];
  const header = rows[headerIdx].map((h) => h.trim());
  return rows
    .slice(headerIdx + 1)
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const base = (name: string) => name.split("/").pop()?.toLowerCase() ?? "";

export function parseLinkedInExport(files: UploadedFile[], url: string): RetrievedItem[] {
  const items: RetrievedItem[] = [];
  const find = (n: string) => files.find((f) => base(f.name) === n.toLowerCase());
  const profile = find("Profile.csv");
  if (profile) {
    const p = parseCsv(profile.text)[0];
    if (p) {
      pushItem(items, "name", url, [p["First Name"], p["Last Name"]].filter(Boolean).join(" "));
      pushItem(items, "headline", url, p["Headline"]);
      pushItem(items, "about", url, p["Summary"]);
      pushItem(items, "industry", url, p["Industry"]);
      pushItem(items, "location", url, p["Geo Location"]);
    }
  }
  const positions = find("Positions.csv");
  if (positions) {
    for (const r of parseCsv(positions.text).slice(0, 12)) {
      const when = [r["Started On"], r["Finished On"] || "present"].filter(Boolean).join(" – ");
      pushItem(items, "experience", url, `${r["Title"]} at ${r["Company Name"]}${when ? ` (${when})` : ""}${r["Description"] ? `: ${r["Description"]}` : ""}`);
    }
  }
  const education = find("Education.csv");
  if (education) {
    for (const r of parseCsv(education.text).slice(0, 6)) {
      pushItem(items, "education", url, `${r["School Name"]}${r["Degree Name"] ? ` — ${r["Degree Name"]}` : ""}${r["Activities"] ? `. Activities: ${r["Activities"]}` : ""}${r["Notes"] ? `. ${r["Notes"]}` : ""}`);
    }
  }
  const skills = find("Skills.csv");
  if (skills) {
    const names = parseCsv(skills.text).map((r) => r["Name"]).filter(Boolean);
    if (names.length) pushItem(items, "skills", url, `Skills: ${names.slice(0, 40).join(", ")}`);
  }
  for (const [file, field, title, extra] of [
    ["Projects.csv", "projects", "Title", "Description"],
    ["Volunteering.csv", "volunteering", "Role", "Description"],
    ["Certifications.csv", "certifications", "Name", "Authority"],
    ["Honors.csv", "honorsAndAwards", "Title", "Description"],
    ["Languages.csv", "languages", "Name", "Proficiency"],
  ] as const) {
    const f = find(file);
    if (!f) continue;
    for (const r of parseCsv(f.text).slice(0, 6)) {
      const org = field === "volunteering" && r["Company Name"] ? ` — ${r["Company Name"]}` : "";
      pushItem(items, field, url, `${r[title] ?? ""}${org}${r[extra] ? `: ${r[extra]}` : ""}`);
    }
  }
  return items.slice(0, 60);
}

/** Instagram exports encode UTF-8 bytes as \u00XX escapes; this undoes that mojibake. */
export function fixInstagramText(s: string): string {
  if (!/[\u0080-ÿ]/.test(s)) return s;
  try {
    const bytes = Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff));
    if ([...s].some((c) => c.charCodeAt(0) > 0xff)) return s;
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return s;
  }
}

type IgPost = { title?: string; creation_timestamp?: number; media?: { title?: string; creation_timestamp?: number }[] };

export function parseInstagramExport(files: UploadedFile[], url: string): RetrievedItem[] {
  const items: RetrievedItem[] = [];
  const info = files.find((f) => base(f.name) === "personal_information.json");
  if (info) {
    try {
      const data = JSON.parse(info.text) as { profile_user?: { string_map_data?: Record<string, { value?: string }> }[] };
      const map = data.profile_user?.[0]?.string_map_data ?? {};
      pushItem(items, "name", url, fixInstagramText(map["Name"]?.value ?? ""));
      pushItem(items, "bio", url, fixInstagramText(map["Bio"]?.value ?? ""));
    } catch {
      // ignore malformed file
    }
  }
  const posts: { text: string; ts: number }[] = [];
  for (const f of files.filter((f) => /^posts_\d+\.json$/.test(base(f.name)))) {
    try {
      const data = JSON.parse(f.text) as IgPost[] | { ig_posts?: IgPost[] };
      const list = Array.isArray(data) ? data : (data.ig_posts ?? []);
      for (const p of list) {
        const text = fixInstagramText(p.title || p.media?.[0]?.title || "");
        const ts = p.creation_timestamp ?? p.media?.[0]?.creation_timestamp ?? 0;
        if (text.trim()) posts.push({ text, ts });
      }
    } catch {
      // ignore malformed file
    }
  }
  posts.sort((a, b) => b.ts - a.ts);
  for (const p of posts.slice(0, 20)) {
    const when = p.ts ? new Date(p.ts * 1000).toISOString().slice(0, 10) : "";
    pushItem(items, "post", url, `${when ? `[${when}] ` : ""}${p.text}`);
  }
  return items;
}

export function exportResult(platform: "linkedin" | "instagram", url: string, files: UploadedFile[]): RetrievalResult {
  const items = platform === "linkedin" ? parseLinkedInExport(files, url) : parseInstagramExport(files, url);
  const expected =
    platform === "linkedin"
      ? "Profile.csv, Positions.csv, Skills.csv or Education.csv"
      : "personal_information.json or posts_1.json";
  return {
    platform,
    method: "data_export",
    url,
    status: items.length ? "ok" : "empty",
    http_status: null,
    detail: items.length
      ? `Read ${items.length} items from your ${platform === "linkedin" ? "LinkedIn" : "Instagram"} data export (${files.length} files).`
      : `No usable profile text found. The export should contain ${expected}.`,
    items,
  };
}
