import { newId } from "../db";
import type { RetrievalResult } from "./types";

export async function storeResult(db: D1Database, participantId: string, r: RetrievalResult): Promise<void> {
  const docId = newId("doc");
  const stmts = [
    db
      .prepare(
        `INSERT INTO source_documents (id, participant_id, platform, method, url, status, http_status, detail, item_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      )
      .bind(docId, participantId, r.platform, r.method, r.url, r.status, r.http_status, r.detail, r.items.length),
    ...r.items.map((it, i) =>
      db
        .prepare("INSERT INTO source_items (id, participant_id, document_id, platform, field, url, text, ord) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
        .bind(newId("item"), participantId, docId, r.platform, it.field, it.url, it.text, i),
    ),
  ];
  if (r.avatar) {
    stmts.push(
      r.platform === "instagram"
        ? db.prepare("UPDATE participants SET avatar_url = ?2 WHERE id = ?1").bind(participantId, r.avatar)
        : db.prepare("UPDATE participants SET avatar_url = COALESCE(avatar_url, ?2) WHERE id = ?1").bind(participantId, r.avatar),
    );
  }
  await db.batch(stmts);
}
