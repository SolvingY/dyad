// Connect an outside agent to Dyad, or disconnect it.
//
// POST with the signed-in user's session:
//   { action: "create", name }  -> creates an external agent and its API key.
//                                  The key is returned once and never again.
//   { action: "revoke", key_id } -> revokes a key.
//
// The key is used as `Authorization: Bearer <key>` against dyad-mcp.

import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient, getCallerId } from "../_shared/auth.ts";
import { hashAgentKey, newAgentKey } from "../_shared/agent-key.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = adminClient();
  const userId = await getCallerId(req, admin);
  if (!userId) return json({ error: "not_signed_in" }, 401);

  const body = await req.json().catch(() => null);

  if (body?.action === "create") {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (!name) return json({ error: "bad_request", detail: "name is required" }, 400);

    const { data: agent, error: agentErr } = await admin
      .from("agents")
      .insert({ user_id: userId, name, source: "external" })
      .select("id")
      .single();
    if (agentErr || !agent) {
      console.error(`agent-keys: creating agent failed: ${agentErr?.message}`);
      return json({ error: "save_failed" }, 500);
    }

    const key = newAgentKey();
    const { error: keyErr } = await admin.from("agent_keys").insert({
      user_id: userId,
      agent_id: agent.id,
      key_hash: await hashAgentKey(key),
      key_prefix: key.slice(0, 12),
    });
    if (keyErr) {
      console.error(`agent-keys: saving key failed: ${keyErr.message}`);
      await admin.from("agents").delete().eq("id", agent.id);
      return json({ error: "save_failed" }, 500);
    }

    return json({
      agent_id: agent.id,
      key,
      mcp_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/dyad-mcp`,
    });
  }

  if (body?.action === "revoke") {
    if (typeof body.key_id !== "string") {
      return json({ error: "bad_request", detail: "key_id is required" }, 400);
    }
    const { data, error } = await admin
      .from("agent_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", body.key_id)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .select("id");
    if (error) return json({ error: "save_failed" }, 500);
    if (!data?.length) return json({ error: "key_not_found" }, 404);
    return json({ ok: true });
  }

  return json({ error: "bad_request", detail: "action must be create or revoke" }, 400);
});
