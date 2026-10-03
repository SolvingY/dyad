// Saves the human's answer to a check-in.
//
// POST { checkin_id, energy (1-5), note? } with the signed-in user's session.
// Updates the checkins row and logs an agent_events 'context_refresh', since
// the agent now has fresh information about the human.

import { corsHeaders, json } from "../_shared/cors.ts";
import { adminClient, getCallerId } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = adminClient();
  const userId = await getCallerId(req, admin);
  if (!userId) return json({ error: "not_signed_in" }, 401);

  const body = await req.json().catch(() => null);
  const { checkin_id, energy, note = null } = body ?? {};
  if (typeof checkin_id !== "string" || !Number.isInteger(energy) || energy < 1 || energy > 5) {
    return json({ error: "bad_request", detail: "checkin_id and energy (1-5) are required" }, 400);
  }
  if (note !== null && typeof note !== "string") {
    return json({ error: "bad_request", detail: "note must be a string" }, 400);
  }

  // A malformed uuid makes this query error; treat that as "not found" too.
  const { data: checkin } = await admin
    .from("checkins")
    .select("id, agent_id, decision, responded_at")
    .eq("id", checkin_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!checkin || checkin.decision !== "ask") return json({ error: "checkin_not_found" }, 404);
  if (checkin.responded_at) return json({ error: "already_answered" }, 409);

  const { error } = await admin
    .from("checkins")
    .update({
      response_energy: energy,
      response_note: note?.trim() || null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", checkin.id);
  if (error) {
    console.error(`checkin-respond: update failed: ${error.message}`);
    return json({ error: "save_failed" }, 500);
  }

  const { error: eventErr } = await admin
    .from("agent_events")
    .insert({ agent_id: checkin.agent_id, event_type: "context_refresh", task_id: "checkin" });
  if (eventErr)
    console.error(`checkin-respond: logging context_refresh failed: ${eventErr.message}`);

  return json({ ok: true });
});
