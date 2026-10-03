// Dyad's MCP server, for outside agents (Claude Code, Cursor, a user's own code).
//
// Streamable HTTP transport, stateless: each POST carries one JSON-RPC message
// (or a batch) and gets a JSON reply. Two ways to authenticate:
//   - OAuth: MCP clients like claude.ai discover Supabase Auth's OAuth 2.1
//     server from /.well-known/oauth-protected-resource, the human approves on
//     Dyad's /oauth/consent page, and each app becomes its own external agent.
//   - API key from agent-keys: `Authorization: Bearer dyad_...`.
//
// Tools:
//   get_vitals       the human's oura_daily and this agent's agent_daily rows
//   get_thread       this agent's conversation with the human
//   post_message     post a message, check-in or hold into the thread
//   log_call         report one of this agent's LLM calls to agent_events
//   should_check_in  ask Dyad's built-in logic whether to check in right now
//
// Each tool call is logged to agent_events as the agent's telemetry.
// Each agent may make RATE_LIMIT tool calls per RATE_WINDOW_SECONDS; the
// handshake and tool listing don't count.

import { ACT_AS_USER_HEADER, adminClient } from "../_shared/auth.ts";
import { KEY_PREFIX, hashAgentKey } from "../_shared/agent-key.ts";
import { chicagoParts } from "../_shared/chicago.ts";
import { holdReason } from "../_shared/checkin-rules.ts";

const RATE_LIMIT = 20;
const RATE_WINDOW_SECONDS = 3600;

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const SERVER_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/dyad-mcp`;
const METADATA_PATH = "/.well-known/oauth-protected-resource";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
  "Access-Control-Allow-Headers":
    "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const INSTRUCTIONS = `Dyad pairs a human with their AI agents. You are one of this human's agents.
Use get_vitals to see how the human (Oura ring) and you (your own call telemetry) are doing, and
get_thread to read your conversation with them: the human can message you directly in Dyad, so
check it and answer with post_message kind "message". Check in with post_message kind "checkin":
at most one short question, no medical claims or diagnoses. Dyad refuses a check-in if the human
answered in the last 2 hours or already got 3 check-ins today. Report every LLM call you make with
log_call so your vitals stay accurate. You may make 20 tool calls per hour.`;

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
      "Your conversation with the human in Dyad, oldest first. The human can message you there directly; answer with post_message. Human messages may carry an energy rating from 1 to 5.",
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
      .select("created_at, role, kind, content, energy")
      .eq("user_id", userId)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(limit as number);
    return (data ?? []).reverse().map((m) => ({
      created_at: m.created_at,
      from: m.role === "human" ? "human" : "you",
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

// Every tool call counts toward the agent's vitals, so a connected agent has
// vitals even if it never reports its own LLM calls. log_call is skipped: the
// call it reports is the telemetry. Reading vitals or the thread also counts as
// a context refresh.
async function logToolCall(
  admin: Admin,
  agentId: string,
  tool: string,
  started: number,
  error: string | null,
) {
  if (tool === "log_call") return;
  const rows: Record<string, unknown>[] = [
    {
      agent_id: agentId,
      event_type: "llm_call",
      model: `mcp:${tool}`.slice(0, 100),
      task_id: "mcp",
      latency_ms: Date.now() - started,
      status: error ? "error" : "ok",
      error,
    },
  ];
  if (!error && (tool === "get_vitals" || tool === "get_thread")) {
    rows.push({ agent_id: agentId, event_type: "context_refresh", task_id: "mcp" });
  }
  const { error: logErr } = await admin.from("agent_events").insert(rows);
  if (logErr) console.error(`dyad-mcp: logging tool call failed: ${logErr.message}`);
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
      const { data: waitSeconds, error: limitErr } = await admin.rpc("consume_agent_call", {
        p_agent_id: caller.agentId,
        p_limit: RATE_LIMIT,
        p_window_seconds: RATE_WINDOW_SECONDS,
      });
      if (limitErr) {
        console.error(`dyad-mcp: rate limiter failed: ${limitErr.message}`);
        return reply({
          content: [{ type: "text", text: "Dyad is unavailable right now." }],
          isError: true,
        });
      }
      if (waitSeconds > 0) {
        const text = `Rate limited: ${RATE_LIMIT} tool calls per hour. Retry in ${waitSeconds} seconds.`;
        return reply({ content: [{ type: "text", text }], isError: true });
      }
      const started = Date.now();
      try {
        const result = await callTool(admin, caller, name, args);
        await logToolCall(admin, caller.agentId, name, started, null);
        return reply({ content: [{ type: "text", text: JSON.stringify(result) }] });
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        if (!(err instanceof ToolError)) console.error(`dyad-mcp: ${name}: ${text}`);
        await logToolCall(admin, caller.agentId, name, started, text);
        return reply({ content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}

/** The caller for an API key, or null. */
async function callerFromKey(admin: Admin, key: string): Promise<Caller | null> {
  const { data } = await admin
    .from("agent_keys")
    .select("id, agent_id, user_id")
    .eq("key_hash", await hashAgentKey(key))
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  await admin
    .from("agent_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return { agentId: data.agent_id, userId: data.user_id };
}

/** The caller for an OAuth access token, creating the app's agent on first use. */
async function callerFromOAuth(admin: Admin, token: string): Promise<Caller | null> {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  let clientId: unknown;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    clientId = JSON.parse(atob(payload)).client_id;
  } catch {
    return null;
  }
  // Only tokens issued to an OAuth app, not ordinary Dyad sign-in sessions.
  if (typeof clientId !== "string" || !clientId) return null;
  const userId = data.user.id;

  const find = () =>
    admin
      .from("agents")
      .select("id")
      .eq("user_id", userId)
      .eq("oauth_client_id", clientId)
      .maybeSingle();
  let { data: agent } = await find();
  if (!agent) {
    const { data: client } = await admin.auth.admin.oauth.getClient(clientId);
    await admin.from("agents").insert({
      user_id: userId,
      name: client?.client_name || "Connected app",
      source: "external",
      oauth_client_id: clientId,
    });
    // Re-read rather than use the insert result, in case a parallel request won.
    ({ data: agent } = await find());
  }
  return agent ? { agentId: agent.id, userId } : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  // OAuth protected resource metadata (RFC 9728): tells MCP clients where to sign in.
  if (req.method === "GET" && new URL(req.url).pathname.endsWith(METADATA_PATH)) {
    return new Response(
      JSON.stringify({
        resource: SERVER_URL,
        authorization_servers: [`${Deno.env.get("SUPABASE_URL")}/auth/v1`],
        bearer_methods_supported: ["header"],
        resource_name: "Dyad",
      }),
      { headers },
    );
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
  }

  const admin = adminClient();
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const caller = !token
    ? null
    : token.startsWith(KEY_PREFIX)
      ? await callerFromKey(admin, token)
      : await callerFromOAuth(admin, token);
  if (!caller) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: {
        ...headers,
        "WWW-Authenticate": `Bearer resource_metadata="${SERVER_URL}${METADATA_PATH}"`,
      },
    });
  }

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
