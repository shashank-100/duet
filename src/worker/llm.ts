// Provider-neutral LLM access. Credentials stay server-side (Worker secrets / AI binding).
// Provider is picked by LLM_PROVIDER, or automatically: Anthropic key > OpenAI key > Workers AI.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
}

export interface LLM {
  model: string;
  complete(req: CompletionRequest): Promise<string>;
  stream(req: CompletionRequest, onDelta: (text: string) => void): Promise<string>;
}

export interface LLMEnv {
  AI: Ai;
  LLM_PROVIDER?: string;
  WORKERS_AI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

export class LLMError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

export function createLLM(env: LLMEnv): LLM {
  const provider =
    env.LLM_PROVIDER && env.LLM_PROVIDER !== "auto"
      ? env.LLM_PROVIDER
      : env.ANTHROPIC_API_KEY
        ? "anthropic"
        : env.OPENAI_API_KEY
          ? "openai"
          : "workers-ai";
  if (provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new LLMError("ANTHROPIC_API_KEY is not configured.", false);
    return anthropic(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || "claude-sonnet-5-5");
  }
  if (provider === "openai") {
    if (!env.OPENAI_API_KEY) throw new LLMError("OPENAI_API_KEY is not configured.", false);
    return openai(env.OPENAI_API_KEY, env.OPENAI_MODEL || "gpt-5-mini");
  }
  return workersAI(env.AI, env.WORKERS_AI_MODEL || "@cf/deepseek-ai/deepseek-v4-pro-0813");
}

/** Reads a server-sent-events body and yields each `data:` payload. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data && data !== "[DONE]") yield data;
      }
    }
    if (done) break;
  }
  const rest = buffer.trim();
  if (rest.startsWith("data:")) {
    const data = rest.slice(5).trim();
    if (data && data !== "[DONE]") yield data;
  }
}

function httpError(provider: string, status: number, body: string): LLMError {
  const retryable = status === 429 || status >= 500;
  return new LLMError(`${provider} request failed (HTTP ${status}): ${body.slice(0, 300)}`, retryable);
}

function workersAI(ai: Ai, model: string): LLM {
  const input = (req: CompletionRequest, stream: boolean) => ({
    messages: [{ role: "system", content: req.system }, ...req.messages],
    max_tokens: req.maxTokens,
    temperature: req.temperature ?? 0.7,
    stream,
    // Reasoning models (DeepSeek v4) otherwise spend the whole token budget thinking and return no text.
    chat_template_kwargs: { thinking: false },
  });
  const run = async (req: CompletionRequest, stream: boolean): Promise<unknown> => {
    // Capacity (3040) and internal (8005) errors are usually gone within seconds, so retry here
    // before failing the whole workflow step or date turn.
    const delays = [2000, 5000, 12000];
    for (let attempt = 0; ; attempt++) {
      try {
        // The AI binding's input type is a union over every model; this call shape is the chat form.
        return await (ai.run as (m: string, i: unknown) => Promise<unknown>)(model, input(req, stream));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const transient = /capacity|3040|8005|internal server error|overload|timeout/i.test(message);
        if (transient && attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
          continue;
        }
        const retryable = transient || !/not found|invalid|unauthorized|neurons|quota/i.test(message);
        throw new LLMError(`Workers AI (${model}) failed: ${message}`, retryable);
      }
    }
  };
  const textOf = (out: unknown): string => {
    if (typeof out === "string") return out;
    const o = out as { response?: unknown; choices?: { message?: { content?: string } }[] };
    if (typeof o?.response === "string") return o.response;
    if (o?.response && typeof o.response === "object") return JSON.stringify(o.response);
    const c = o?.choices?.[0]?.message?.content;
    if (typeof c === "string") return c;
    throw new LLMError("Workers AI returned no text.", true);
  };
  return {
    model: `workers-ai:${model}`,
    async complete(req) {
      return textOf(await run(req, false));
    },
    async stream(req, onDelta) {
      const out = await run(req, true);
      if (!(out instanceof ReadableStream)) {
        const text = textOf(out);
        onDelta(text);
        return text;
      }
      let full = "";
      for await (const data of sseData(out as ReadableStream<Uint8Array>)) {
        let delta = "";
        try {
          const j = JSON.parse(data) as { response?: string; choices?: { delta?: { content?: string } }[] };
          delta = j.response ?? j.choices?.[0]?.delta?.content ?? "";
        } catch {
          continue;
        }
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      }
      if (!full.trim()) throw new LLMError("Workers AI streamed an empty response.", true);
      return full;
    },
  };
}

function anthropic(apiKey: string, model: string): LLM {
  const call = (req: CompletionRequest, stream: boolean) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        system: req.system,
        messages: req.messages,
        max_tokens: req.maxTokens,
        temperature: req.temperature ?? 0.7,
        stream,
      }),
    });
  return {
    model: `anthropic:${model}`,
    async complete(req) {
      const res = await call(req, false);
      if (!res.ok) throw httpError("Anthropic", res.status, await res.text());
      const data = (await res.json()) as { content: { type: string; text?: string }[] };
      return data.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    },
    async stream(req, onDelta) {
      const res = await call(req, true);
      if (!res.ok || !res.body) throw httpError("Anthropic", res.status, await res.text());
      let full = "";
      for await (const data of sseData(res.body)) {
        const ev = JSON.parse(data) as { type: string; delta?: { type: string; text?: string }; error?: { message: string } };
        if (ev.type === "error") throw new LLMError(`Anthropic stream error: ${ev.error?.message}`, true);
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) {
          full += ev.delta.text;
          onDelta(ev.delta.text);
        }
      }
      return full;
    },
  };
}

function openai(apiKey: string, model: string): LLM {
  const call = (req: CompletionRequest, stream: boolean) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: req.system }, ...req.messages],
        max_completion_tokens: req.maxTokens,
        stream,
        store: false,
      }),
    });
  return {
    model: `openai:${model}`,
    async complete(req) {
      const res = await call(req, false);
      if (!res.ok) throw httpError("OpenAI", res.status, await res.text());
      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      return data.choices[0]?.message.content ?? "";
    },
    async stream(req, onDelta) {
      const res = await call(req, true);
      if (!res.ok || !res.body) throw httpError("OpenAI", res.status, await res.text());
      let full = "";
      for await (const data of sseData(res.body)) {
        const ev = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        const delta = ev.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      }
      return full;
    },
  };
}

/** Pulls the first balanced JSON object out of model text (handles code fences and preambles). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  if (start < 0) throw new Error("No JSON object in model output.");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  throw new Error("Unterminated JSON object in model output.");
}

/**
 * Asks for JSON, validates it, and on failure retries once with the validation error fed back.
 * `validate` throws with a human-readable message when the shape is wrong.
 */
export async function completeJson<T>(
  llm: LLM,
  req: CompletionRequest,
  validate: (value: unknown) => T,
  attempts = 3,
): Promise<T> {
  let messages = req.messages;
  let lastError = "";
  for (let i = 0; i < attempts; i++) {
    const text = await llm.complete({ ...req, messages, temperature: req.temperature ?? 0.2 });
    try {
      return validate(extractJson(text));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      messages = [
        ...req.messages,
        { role: "assistant", content: text.slice(0, 6000) },
        { role: "user", content: `That output was not valid: ${lastError}. Reply again with only the corrected JSON object.` },
      ];
    }
  }
  throw new LLMError(`Model did not return valid JSON after ${attempts} attempts: ${lastError}`, true);
}
