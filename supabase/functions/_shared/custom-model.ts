// The owner's own hosted model, used as the agent's voice: any OpenAI-compatible
// /chat/completions endpoint, configured by edge secrets. With any of the three
// required secrets unset, Dyad uses Claude only. CUSTOM_MODEL_API_KEY is never
// logged or returned.

export type CustomModel = { baseUrl: string; apiKey: string; id: string; contextLimit: number };

export type CustomResult =
  | {
      ok: true;
      text: string;
      stopReason: "end_turn" | "max_tokens";
      tokensIn: number | null;
      tokensOut: number | null;
      latencyMs: number;
    }
  | { ok: false; error: string; latencyMs: number };

type Message = { role: string; content: string | { type: string; text?: string }[] };

// One attempt with a short timeout: on any failure agent-call falls back to
// Claude right away, so the human isn't left waiting.
const TIMEOUT_MS = 15_000;
const DEFAULT_CONTEXT_LIMIT = 128_000;

export function customModelFromEnv(): CustomModel | null {
  const baseUrl = Deno.env.get("CUSTOM_MODEL_BASE_URL")?.trim();
  const apiKey = Deno.env.get("CUSTOM_MODEL_API_KEY")?.trim();
  const id = Deno.env.get("CUSTOM_MODEL_ID")?.trim();
  if (!baseUrl || !apiKey || !id) return null;
  const limit = Number(Deno.env.get("CUSTOM_MODEL_CONTEXT_LIMIT"));
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    id,
    contextLimit: Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_CONTEXT_LIMIT,
  };
}

/** Calls the model with a Claude-style request (system + messages). Never throws. */
export async function callCustomModel(
  model: CustomModel,
  system: string | undefined,
  messages: Message[],
  maxTokens: number,
  timeoutMs = TIMEOUT_MS,
): Promise<CustomResult> {
  const started = performance.now();
  const latencyMs = () => Math.round(performance.now() - started);
  const textOf = (c: Message["content"]) =>
    typeof c === "string"
      ? c
      : c
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("");
  // Provider errors can echo part of the key; keep it out of logs.
  const fail = (error: string) => ({
    ok: false as const,
    error: error.replaceAll(model.apiKey, "[redacted]").slice(0, 500),
    latencyMs: latencyMs(),
  });

  try {
    const res = await fetch(`${model.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${model.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        max_tokens: maxTokens,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          ...messages.map((m) => ({ role: m.role, content: textOf(m.content) })),
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = typeof data?.error === "string" ? data.error : data?.error?.message;
      return fail(`${res.status}: ${detail ?? res.statusText}`);
    }
    const choice = data?.choices?.[0];
    const text = typeof choice?.message?.content === "string" ? choice.message.content.trim() : "";
    if (!text) return fail("empty reply");
    return {
      ok: true,
      text,
      stopReason: choice.finish_reason === "length" ? "max_tokens" : "end_turn",
      tokensIn: data?.usage?.prompt_tokens ?? null,
      tokensOut: data?.usage?.completion_tokens ?? null,
      latencyMs: latencyMs(),
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return fail(`timed out after ${timeoutMs} ms`);
    }
    return fail(err instanceof Error ? err.message : String(err));
  }
}
