import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { ACT_AS_USER_HEADER, adminClient } from "./auth.ts";

export type EdgeHealthContext = {
  userId?: string;
  agentIds?: string[];
};

type Handler = (req: Request, health: EdgeHealthContext) => Promise<Response>;

function safeStatus(response: Response) {
  return response.status >= 500 ? "error" : "ok";
}

async function resolveAgentIds(
  req: Request,
  admin: SupabaseClient,
  health: EdgeHealthContext,
): Promise<string[]> {
  if (health.agentIds?.length) return [...new Set(health.agentIds)];
  let userId = health.userId;
  if (!userId) {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return [];
    if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      userId = req.headers.get(ACT_AS_USER_HEADER) ?? undefined;
    } else {
      const { data } = await admin.auth.getUser(token);
      userId = data.user?.id;
    }
  }
  if (!userId) return [];
  const { data } = await admin
    .from("agents")
    .select("id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1);
  return data?.map((agent) => agent.id) ?? [];
}

async function record(
  req: Request,
  functionName: string,
  started: number,
  response: Response,
  health: EdgeHealthContext,
) {
  try {
    const admin = adminClient();
    const agentIds = await resolveAgentIds(req, admin, health);
    if (!agentIds.length) return;
    const status = safeStatus(response);
    const { error } = await admin.from("agent_events").insert(
      agentIds.map((agentId) => ({
        agent_id: agentId,
        event_type: "edge_invocation",
        function_name: functionName,
        latency_ms: Math.max(0, Math.round(performance.now() - started)),
        status,
        retry_count: 0,
        error: status === "error" ? `HTTP ${response.status}` : null,
      })),
    );
    if (error) console.error(`${functionName}: health logging failed: ${error.message}`);
  } catch (error) {
    console.error(`${functionName}: health logging failed: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

/** Records completed requests without storing request bodies, credentials, or response content. */
export function withEdgeHealth(functionName: string, handler: Handler) {
  return async (req: Request): Promise<Response> => {
    const started = performance.now();
    const health: EdgeHealthContext = {};
    let response: Response;
    try {
      response = await handler(req, health);
    } catch (error) {
      response = new Response(JSON.stringify({ error: "server_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
      console.error(`${functionName}: unhandled request failure: ${error instanceof Error ? error.message : "unknown"}`);
    }
    await record(req, functionName, started, response, health);
    return response;
  };
}