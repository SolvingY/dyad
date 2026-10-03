// Dyad's MCP server, for outside agents (Claude Code, Cursor, a user's own code).
//
// Streamable HTTP transport, stateless: each POST carries one JSON-RPC message
// (or a batch) and gets a JSON reply. Authenticate with the per-agent key from
// agent-keys: `Authorization: Bearer dyad_...`. The key identifies both the
// agent and its human.
//
// Tools:
//   get_vitals       the human's oura_daily and this agent's agent_daily rows
//   get_thread       recent Dyad thread messages, including the human's replies
//   post_message     post a message, check-in or hold into the thread
//   log_call         report one of this agent's LLM calls to agent_events
//   should_check_in  ask Dyad's built-in logic whether to check in right now

import { ACT_AS_USER_HEADER, adminClient } from "../_shared/auth.ts";
import { hashAgentKey } from "../_shared/agent-key.ts";
import { chicagoParts } from "../_shared/chicago.ts";
import { holdReason } from "../_shared/checkin-rules.ts";

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const INSTRUCTIONS = `Dyad pairs a human with their AI agents. You are one of this human's agents.
Use get_vitals to see how the human (Oura ring) and you (your own call telemetry) are doing, and
get_thread to read the conversation. Check in with post_message kind "checkin": at most one short
question, no medical claims or diagnoses. Dyad refuses a check-in if the human answered in the last
2 hours or already got 3 check-ins today. Report every LLM call you make with log_call so your
vitals stay accurate.`;

const TOOLS = [
  {
    name: "get_vitals",
    description:
      "The human's daily Oura data (readiness, sleep, HRV, activity) and your own daily vitals (readiness, error rate, latency, freshness), newest first.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 14,
          description: "Days of history. Default 1.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_thread",
    description:
      "Recent messages in the Dyad thread between the human and their agents, oldest first. Human replies may carry an energy rating from 1 to 5.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          description: "Messages to return. Default 20.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "post_message",
    description:
      'Post into the Dyad thread as this agent. kind "checkin" asks the human how they are doing (refused while Dyad\'s hold rules apply); "hold" records that you decided not to ask, with content as the reason; "message" is anything else.',
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", minLength: 1, maxLength: 4000 },
        kind: { type: "string", enum: ["message", "checkin", "hold"] },
      },
      required: ["content", "kind"],
      additionalProperties: false,
    },
  },
  {
    name: "log_call",
    description:
      "Report one of your LLM calls. Dyad computes your daily vitals (readiness, error rate, latency, cache hit rate) from these.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string" },
        tokens_in: {
          type: "integer",
          minimum: 0,
          description: "All input tokens, including cached.",
        },
        tokens_out: { type: "integer", minimum: 0 },
        cached_tokens: {
          type: "integer",
          minimum: 0,
          description: "Input tokens read from cache.",
        },
        latency_ms: { type: "integer", minimum: 0 },
        status: { type: "string", enum: ["ok", "error"] },
        retry_count: { type: "integer", minimum: 0 },
        context_tokens: { type: "integer", minimum: 0 },
        context_limit: { type: "integer", minimum: 1 },
        error: { type: "string" },
        task_id: { type: "string" },
      },
      required: ["model", "tokens_in", "tokens_out", "latency_ms", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "should_check_in",
    description:
      "Ask Dyad's built-in check-in logic (hold rules plus Claude reading today's vitals) whether to check in on the human now. Returns a decision, a reason and a suggested message. Posts nothing.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

type Caller = { agentId: string; userId: string };
type Admin = ReturnType<typeof adminClient>;

class ToolError extends Error {}

const isInt = (v: unknown, min = 0) => Number.isInteger(v) && (v as number) >= min;

async function callTool(
  admin: Admin,
  caller: Caller,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { agentId, userId } = caller;

  if (name === "get_vitals") {
    const days = args.days === undefined ? 1 : args.days;
    if (!isInt(days, 1) || (days as number) > 14) throw new ToolError("days must be 1-14");
    const [{ data: human }, { data: agent }] = await Promise.all([
      admin
        .from("oura_daily")
        .select(
          "day, readiness_score, sleep_score, sleep_efficiency, total_sleep_seconds, average_hrv, resting_heart_rate, respiratory_rate, temperature_deviation, activity_score, steps",
        )
        .eq("user_id", userId)
        .order("day", { ascending: false })
        .limit(days as number),
      admin
        .from("agent_daily")
        .select(
          "day, readiness_score, freshness_score, error_rate, error_rate_deviation, retry_rate, correction_rate, cache_hit_rate, baseline_latency_ms, latency_variability_ms, calls_per_hour, call_count, avg_context_fill",
        )
        .eq("agent_id", agentId)
        .order("day", { ascending: false })
        .limit(days as number),
    ]);
    return { human: human ?? [], agent: agent ?? [] };
  }

  if (name === "get_thread") {
    const limit = args.limit === undefined ? 20 : args.limit;
    if (!isInt(limit, 1) || (limit as number) > 50) throw new ToolError("limit must be 1-50");
    const { data } = await admin
      .from("thread_messages")
      .select("created_at, role, kind, content, energy, agent_id, agents(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit as number);
    return (data ?? []).reverse().map((m) => ({
      created_at: m.created_at,
      from:
        m.role === "human"
          ? "human"
          : m.agent_id === agentId
            ? "you"
            : ((m.agents as { name?: string } | null)?.name ?? "another agent"),
      kind: m.kind,
      content: m.content,
      energy: m.energy,
    }));
  }

  if (name === "post_message") {
    const content = typeof args.content === "string" ? args.content.trim() : "";
    const kind = args.kind;
    if (!content || content.length > 4000) throw new ToolError("content must be 1-4000 characters");
    if (kind !== "message" && kind !== "checkin" && kind !== "hold") {
      throw new ToolError('kind must be "message", "checkin" or "hold"');
    }

    if (kind !== "message") {
      if (kind === "checkin") {
        const now = new Date();
        const today = chicagoParts(now).date;
        const { data: recent } = await admin
          .from("checkins")
          .select("created_at, decision, responded_at")
          .eq("user_id", userId)
          .gte("created_at", new Date(now.getTime() - 36 * 3600_000).toISOString());
        const reason = holdReason(
          (recent ?? []).filter((c) => chicagoParts(new Date(c.created_at)).date === today),
          now,
        );
        if (reason) return { posted: false, reason };
      }
      const { error } = await admin.from("checkins").insert({
        user_id: userId,
        agent_id: agentId,
        decision: kind === "checkin" ? "ask" : "hold",
        reason: kind === "hold" ? content : null,
        message: kind === "checkin" ? content : null,
      });
      if (error) throw new Error(`saving check-in failed: ${error.message}`);
    }

    const { error } = await admin.from("thread_messages").insert({
      user_id: userId,
      agent_id: agentId,
      role: "agent",
      kind,
      content,
    });
    if (error) throw new Error(`saving message failed: ${error.message}`);
    return { posted: true };
  }

  if (name === "log_call") {
    const ints = ["tokens_in", "tokens_out", "latency_ms"];
    for (const k of ints)
      if (!isInt(args[k])) throw new ToolError(`${k} must be a non-negative integer`);
    for (const k of ["cached_tokens", "retry_count", "context_tokens", "context_limit"]) {
      if (args[k] !== undefined && !isInt(args[k]))
        throw new ToolError(`${k} must be a non-negative integer`);
    }
    if (typeof args.model !== "string" || !args.model) throw new ToolError("model is required");
    if (args.status !== "ok" && args.status !== "error")
      throw new ToolError('status must be "ok" or "error"');
    const { data, error } = await admin
      .from("agent_events")
      .insert({
        agent_id: agentId,
        event_type: "llm_call",
        model: args.model,
        task_id: typeof args.task_id === "string" ? args.task_id : null,
        tokens_in: args.tokens_in,
        tokens_out: args.tokens_out,
        cached_tokens: args.cached_tokens ?? 0,
        latency_ms: args.latency_ms,
        status: args.status,
        retry_count: args.retry_count ?? 0,
        context_tokens: args.context_tokens ?? args.tokens_in,
        context_limit: args.context_limit ?? null,
        error: typeof args.error === "string" ? args.error : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`logging call failed: ${error.message}`);
    return { event_id: data.id };
  }

  if (name === "should_check_in") {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-checkin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        [ACT_AS_USER_HEADER]: userId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dry_run: true }),
    });
    const body = await res.json().catch(() => null);
    const result = body?.results?.[0];
    if (!res.ok || !result) throw new Error("Dyad's check-in logic is unavailable right now.");
    return { decision: result.decision, reason: result.reason, suggested_message: result.message };
  }

  throw new ToolError(`Unknown tool: ${name}`);
}

type RpcMessage = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

async function handle(admin: Admin, caller: Caller, msg: RpcMessage) {
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code: number, message: string) => ({
    jsonrpc: "2.0",
    id: msg.id ?? null,
    error: { code, message },
  });

  if (msg.id === undefined) return null; // notification, e.g. notifications/initialized

  switch (msg.method) {
    case "initialize": {
      const requested = msg.params?.protocolVersion;
      return reply({
        protocolVersion:
          typeof requested === "string" && SUPPORTED_VERSIONS.includes(requested)
            ? requested
            : SUPPORTED_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "dyad", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = msg.params?.name;
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      if (typeof name !== "string") return fail(-32602, "params.name is required");
      try {
        const result = await callTool(admin, caller, name, args);
        return reply({ content: [{ type: "text", text: JSON.stringify(result) }] });
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        if (!(err instanceof ToolError)) console.error(`dyad-mcp: ${name}: ${text}`);
        return reply({ content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
  }

  const admin = adminClient();
  const key = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: found } = key
    ? await admin
        .from("agent_keys")
        .select("id, agent_id, user_id")
        .eq("key_hash", await hashAgentKey(key))
        .is("revoked_at", null)
        .maybeSingle()
    : { data: null };
  if (!found) {
    return new Response(JSON.stringify({ error: "invalid_api_key" }), { status: 401, headers });
  }
  await admin
    .from("agent_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", found.id);
  const caller = { agentId: found.agent_id, userId: found.user_id };

  const body = await req.json().catch(() => undefined);
  if (body === undefined) {
    const error = { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } };
    return new Response(JSON.stringify(error), { status: 400, headers });
  }

  const replies = Array.isArray(body)
    ? (await Promise.all(body.map((m) => handle(admin, caller, m)))).filter((r) => r !== null)
    : [await handle(admin, caller, body)].filter((r) => r !== null);

  if (replies.length === 0) return new Response(null, { status: 202, headers });
  return new Response(JSON.stringify(Array.isArray(body) ? replies : replies[0]), { headers });
});
