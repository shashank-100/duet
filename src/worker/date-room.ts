// One Durable Object per date. It runs the conversation turn by turn on alarms (so work survives
// restarts and retries with backoff), streams tokens to connected browsers over hibernatable
// WebSockets, persists every finished turn to D1, then runs the separate evaluator.

import { DurableObject } from "cloudflare:workers";
import { getAgentProfile, getDateRow, getTurns, now } from "./db";
import { evaluateDate, personalScore } from "./evaluator";
import { DATE_PLAN, agentMessages, agentSystemPrompt, cleanTurn } from "./harness";
import { createLLM, LLMError } from "./llm";
import { dispatch } from "./matchmaking";

const TURN_PAUSE_MS = 900;
const MAX_STEP_FAILURES = 5;

export class DateRoom extends DurableObject<Env> {
  private partial: { idx: number; speaker_id: string; phase: string; text: string } | null = null;

  /** Idempotent: records which date this room runs and makes sure an alarm is pending. */
  async start(dateId: string): Promise<void> {
    await this.ctx.storage.put("dateId", dateId);
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + 50);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("Expected WebSocket", { status: 426 });
    const dateId = new URL(request.url).searchParams.get("date");
    if (dateId && !(await this.ctx.storage.get("dateId"))) await this.ctx.storage.put("dateId", dateId);
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].send(JSON.stringify(await this.snapshot()));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message === "ping") ws.send(JSON.stringify({ type: "pong" }));
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    ws.close(code === 1005 ? 1000 : code, "closing");
  }

  private broadcast(event: unknown): void {
    const data = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // socket already gone
      }
    }
  }

  private async snapshot() {
    const dateId = await this.ctx.storage.get<string>("dateId");
    if (!dateId) return { type: "snapshot", status: "unknown", turns: [], partial: null };
    const [date, turns] = await Promise.all([getDateRow(this.env.DB, dateId), getTurns(this.env.DB, dateId)]);
    return { type: "snapshot", status: date?.status ?? "unknown", error: date?.error ?? null, turns, partial: this.partial };
  }

  async alarm(): Promise<void> {
    const dateId = await this.ctx.storage.get<string>("dateId");
    if (!dateId) return;
    const date = await getDateRow(this.env.DB, dateId);
    if (!date || date.status === "complete" || date.status === "failed") return;
    try {
      const more = await this.step(dateId);
      await this.ctx.storage.put("failures", 0);
      if (more) await this.ctx.storage.setAlarm(Date.now() + TURN_PAUSE_MS);
    } catch (err) {
      const failures = ((await this.ctx.storage.get<number>("failures")) ?? 0) + 1;
      await this.ctx.storage.put("failures", failures);
      const message = err instanceof Error ? err.message : String(err);
      const retryable = !(err instanceof LLMError) || err.retryable;
      console.error(JSON.stringify({ msg: "date step failed", dateId, failures, retryable, error: message }));
      if (this.partial) this.broadcast({ type: "turn_reset", idx: this.partial.idx, reason: "The model call failed; retrying this turn." });
      this.partial = null;
      await this.env.DB.prepare("UPDATE dates SET attempts = attempts + 1, error = ?2, heartbeat_at = ?3 WHERE id = ?1").bind(dateId, message.slice(0, 500), now()).run();
      if (!retryable || failures >= MAX_STEP_FAILURES) {
        await this.env.DB.prepare("UPDATE dates SET status = 'failed', error = ?2 WHERE id = ?1").bind(dateId, message.slice(0, 500)).run();
        this.broadcast({ type: "status", status: "failed", error: message });
        await dispatch(this.env);
        return;
      }
      this.broadcast({ type: "status", status: "retrying", error: `Retrying after an error (attempt ${failures + 1}): ${message.slice(0, 200)}` });
      await this.ctx.storage.setAlarm(Date.now() + Math.min(60_000, 4000 * 2 ** failures));
    }
  }

  /** Runs one unit of work. Returns true when more work remains. */
  private async step(dateId: string): Promise<boolean> {
    const db = this.env.DB;
    const date = await getDateRow(db, dateId);
    if (!date) return false;
    const llm = createLLM(this.env);
    if (date.status === "queued" || date.status === "starting") {
      await db.prepare("UPDATE dates SET status = 'running', started_at = COALESCE(started_at, ?2), heartbeat_at = ?2, model = ?3 WHERE id = ?1").bind(dateId, now(), llm.model).run();
      this.broadcast({ type: "status", status: "running" });
    }
    const [a, b] = await Promise.all([getAgentProfile(db, date.a.id), getAgentProfile(db, date.b.id)]);
    const turns = await getTurns(db, dateId);

    if (turns.length < DATE_PLAN.length) {
      const idx = turns.length;
      const spec = DATE_PLAN[idx];
      const me = spec.speaker === "a" ? a : b;
      const other = spec.speaker === "a" ? b : a;
      this.partial = { idx, speaker_id: me.id, phase: spec.phase, text: "" };
      this.broadcast({ type: "turn_start", idx, speaker_id: me.id, phase: spec.phase });
      let lastBeat = Date.now();
      const raw = await llm.stream(
        { system: agentSystemPrompt(me, other.display_name, spec, idx), messages: agentMessages(me.id, other.display_name, turns), maxTokens: 450, temperature: 0.8 },
        (delta) => {
          if (this.partial) this.partial.text += delta;
          this.broadcast({ type: "delta", idx, text: delta });
          if (Date.now() - lastBeat > 20_000) {
            lastBeat = Date.now();
            void db.prepare("UPDATE dates SET heartbeat_at = ?2 WHERE id = ?1").bind(dateId, now()).run().catch(() => undefined);
          }
        },
      );
      const content = cleanTurn(raw, me.display_name);
      if (content.length < 40) throw new LLMError("The agent produced an empty or truncated turn.", true);
      await db
        .prepare("INSERT OR IGNORE INTO turns (date_id, idx, speaker_id, phase, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
        .bind(dateId, idx, me.id, spec.phase, content, now())
        .run();
      await db.prepare("UPDATE dates SET heartbeat_at = ?2, error = NULL WHERE id = ?1").bind(dateId, now()).run();
      this.partial = null;
      this.broadcast({ type: "turn_complete", turn: { idx, speaker_id: me.id, phase: spec.phase, content, created_at: now() } });
      return true;
    }

    await db.prepare("UPDATE dates SET status = 'evaluating', heartbeat_at = ?2 WHERE id = ?1").bind(dateId, now()).run();
    this.broadcast({ type: "status", status: "evaluating" });
    const assessment = await evaluateDate(llm, a, b, turns);
    const scoreA = personalScore(assessment, "a");
    const scoreB = personalScore(assessment, "b");
    await db.batch([
      db
        .prepare("INSERT OR REPLACE INTO assessments (date_id, data, score_a, score_b, model) VALUES (?1, ?2, ?3, ?4, ?5)")
        .bind(dateId, JSON.stringify(assessment), scoreA, scoreB, llm.model),
      db.prepare("UPDATE dates SET status = 'complete', completed_at = ?2, heartbeat_at = ?2, error = NULL WHERE id = ?1").bind(dateId, now()),
    ]);
    this.broadcast({ type: "assessment", assessment, score_a: scoreA, score_b: scoreB });
    this.broadcast({ type: "status", status: "complete" });
    await dispatch(this.env);
    return false;
  }
}
