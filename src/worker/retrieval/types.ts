import type { Platform, SourceDocument } from "../../shared/types";

export interface RetrievedItem {
  field: string;
  url: string;
  text: string;
}

export interface RetrievalResult {
  platform: Platform;
  method: string;
  url: string;
  status: SourceDocument["status"];
  http_status: number | null;
  /** Plain-language explanation, including what the participant can do about a failure. */
  detail: string;
  items: RetrievedItem[];
}

const MAX_ITEM_CHARS = 2500;

export function clean(text: unknown): string {
  if (typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_ITEM_CHARS);
}

export function pushItem(items: RetrievedItem[], field: string, url: string, text: unknown) {
  const t = clean(text);
  if (t.length >= 2) items.push({ field, url, text: t });
}
