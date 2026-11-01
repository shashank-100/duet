// Durable ingestion pipeline (Cloudflare Workflow): retrieve LinkedIn → retrieve Instagram → analyze.
// Each step is retried by the platform on transient failure. Retrieval *refusals* are not
// failures — they are recorded honestly with the HTTP status and what the person can do.

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { analyzePerson } from "./analysis";
import { getItems, logEvent, newId, now, setStatus } from "./db";
import { createLLM } from "./llm";
import { dispatch, scheduleDatesFor } from "./matchmaking";
import { retrieveInstagramApify, retrieveLinkedInApify } from "./retrieval/apify";
import { retrieveInstagramDirect, retrieveLinkedInDirect } from "./retrieval/direct";
import { storeResult } from "./retrieval/store";
import type { SourceItem } from "../shared/types";

export interface IngestParams {
  participantId: string;
  /** "full" retrieves again; "analyze" only re-runs analysis on stored items. */
  mode: "full" | "analyze";
}

async function retrievePlatform(env: Env, participantId: string, platform: "linkedin" | "instagram", url: string): Promise<string> {
  const db = env.DB;
  // Replace earlier automatic retrievals; uploaded data exports are kept.
  await db.prepare("DELETE FROM source_documents WHERE participant_id = ?1 AND platform = ?2 AND method IN ('apify','public_fetch')").bind(participantId, platform).run();
  const label = platform === "linkedin" ? "LinkedIn" : "Instagram";
  const apify = platform === "linkedin" ? await retrieveLinkedInApify(env, url) : await retrieveInstagramApify(env, url);
  await storeResult(db, participantId, apify);
  if (apify.status !== "not_configured") await logEvent(db, participantId, `retrieve_${platform}`, apify.status, `${label} via Apify: ${apify.detail}`);
  if (apify.status === "ok" || apify.status === "private") return apify.status;
  const direct = platform === "linkedin" ? await retrieveLinkedInDirect(url) : await retrieveInstagramDirect(url);
  await storeResult(db, participantId, direct);
  await logEvent(db, participantId, `retrieve_${platform}`, direct.status, `${label} public page: ${direct.detail}`);
  return direct.status;
}

export async function runAnalysis(env: Env, participantId: string): Promise<{ status: string; observations: number }> {
  const db = env.DB;
  const person = await db.prepare("SELECT display_name, kind FROM participants WHERE id = ?1").bind(participantId).first<{ display_name: string; kind: string }>();
  if (!person) return { status: "deleted", observations: 0 };
  const items = await getItems(db, participantId);
  const hasLinkedIn = items.some((i) => i.platform === "linkedin" && i.field !== "name");
  const hasInstagram = items.some((i) => i.platform === "instagram" && i.field !== "name");
  if (!hasLinkedIn && !hasInstagram) {
    const msg =
      "Neither profile could be read, so there is nothing to analyze yet. Upload your LinkedIn and/or Instagram data export on this page (instructions below), then press Analyze.";
    await setStatus(db, participantId, "needs_sources", msg);
    await logEvent(db, participantId, "analyze", "skipped", msg);
    return { status: "needs_sources", observations: 0 };
  }
  await setStatus(db, participantId, "analyzing", "The analysis agent is reading the retrieved content.");
  // Short, stable ids are easier for the model to cite exactly.
  const shortToReal = new Map<string, string>();
  const counters = { linkedin: 0, instagram: 0 };
  const forModel: SourceItem[] = items.map((it) => {
    const short = `${it.platform === "linkedin" ? "LI" : "IG"}${++counters[it.platform]}`;
    shortToReal.set(short, it.id);
    return { ...it, id: short };
  });
  const llm = createLLM(env);
  const result = await analyzePerson(llm, person.display_name, forModel);
  await db.batch([
    db.prepare("DELETE FROM observations WHERE participant_id = ?1 AND origin = 'sourced'").bind(participantId),
    db
      .prepare(
        `INSERT INTO profiles (participant_id, headline, summary, unknowns, analysis_model, analyzed_at, dropped_claims)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(participant_id) DO UPDATE SET headline=?2, summary=?3, unknowns=?4, analysis_model=?5, analyzed_at=?6, dropped_claims=?7`,
      )
      .bind(participantId, result.headline, result.summary, JSON.stringify(result.unknowns), llm.model, now(), result.dropped),
    ...result.observations.map((o, i) =>
      db
        .prepare(
          `INSERT INTO observations (id, participant_id, category, label, detail, origin, source_item_id, quote, ord)
           VALUES (?1, ?2, ?3, ?4, ?5, 'sourced', ?6, ?7, ?8)`,
        )
        .bind(newId("obs"), participantId, o.category, o.label, o.detail, shortToReal.get(o.item_id) ?? null, o.quote, i),
    ),
  ]);
  const coverage = [!hasLinkedIn && "LinkedIn could not be read", !hasInstagram && "Instagram could not be read"].filter(Boolean).join("; ");
  await logEvent(
    db,
    participantId,
    "analyze",
    "ok",
    `Drafted ${result.observations.length} evidence-backed observations${result.dropped ? ` (${result.dropped} unsupported claims discarded)` : ""}${coverage ? `. ${coverage}.` : "."}`,
  );
  if (person.kind === "demo") {
    // Fictional personas cannot review themselves; the demo operator approves, and it is labelled as such.
    await db
      .prepare("UPDATE participants SET status = 'approved', status_detail = NULL, dating_enabled = 1, approved_at = ?2, approved_by = 'demo operator (fictional persona)' WHERE id = ?1")
      .bind(participantId, now())
      .run();
    await logEvent(db, participantId, "approve", "ok", "Approved by the demo operator (fictional persona).");
    await scheduleDatesFor(db, participantId);
    await dispatch(env);
  } else {
    await setStatus(db, participantId, "draft_ready", "Your draft profile is ready. Review it, edit anything, then approve it so your agent can start dating.");
  }
  return { status: "draft_ready", observations: result.observations.length };
}

export class IngestWorkflow extends WorkflowEntrypoint<Env, IngestParams> {
  async run(event: WorkflowEvent<IngestParams>, step: WorkflowStep) {
    const { participantId, mode } = event.payload;
    const person = await step.do("load participant", async () => {
      const p = await this.env.DB.prepare("SELECT id, kind, linkedin_url, instagram_url FROM participants WHERE id = ?1").bind(participantId).first<{ id: string; kind: string; linkedin_url: string; instagram_url: string }>();
      return p ?? null;
    });
    if (!person) return { status: "deleted" };

    if (mode === "full" && person.kind === "real") {
      await step.do("mark retrieving", async () => {
        await setStatus(this.env.DB, participantId, "retrieving", "Reading your public LinkedIn and Instagram profiles.");
        await logEvent(this.env.DB, participantId, "retrieve", "started", "Retrieval started.");
      });
      await step.do("retrieve linkedin", { retries: { limit: 2, delay: "10 seconds", backoff: "exponential" }, timeout: "4 minutes" }, () =>
        retrievePlatform(this.env, participantId, "linkedin", person.linkedin_url),
      );
      await step.do("retrieve instagram", { retries: { limit: 2, delay: "10 seconds", backoff: "exponential" }, timeout: "4 minutes" }, () =>
        retrievePlatform(this.env, participantId, "instagram", person.instagram_url),
      );
    }

    try {
      return await step.do("analyze", { retries: { limit: 3, delay: "15 seconds", backoff: "exponential" }, timeout: "5 minutes" }, () =>
        runAnalysis(this.env, participantId),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await step.do("record failure", async () => {
        await setStatus(this.env.DB, participantId, "error", `Analysis failed after retries: ${message.slice(0, 300)}. Press "Analyze again" to retry.`);
        await logEvent(this.env.DB, participantId, "analyze", "error", message.slice(0, 500));
      });
      return { status: "error" };
    }
  }
}
