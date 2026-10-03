import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const decisionSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["approved", "denied"]),
});

async function requireAdmin(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
}) {
  if (!(await checkAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
}

async function checkAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: approval, error: approvalError }, isAdmin] = await Promise.all([
      context.supabase
        .from("account_approvals")
        .select("status")
        .eq("user_id", context.userId)
        .maybeSingle(),
      checkAdmin(context.supabase, context.userId),
    ]);
    if (approvalError) throw new Error(approvalError.message);
    return { status: approval?.status ?? "pending", isAdmin };
  });

export const listApprovalRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: approvals, error: approvalError }, { data: profiles, error: profileError }, usersResult] =
      await Promise.all([
        supabaseAdmin.from("account_approvals").select("user_id,status,created_at,reviewed_at").order("created_at", { ascending: false }),
        supabaseAdmin.from("profiles").select("id,display_name,avatar_url"),
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
    if (approvalError) throw new Error(approvalError.message);
    if (profileError) throw new Error(profileError.message);
    if (usersResult.error) throw new Error(usersResult.error.message);
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const userById = new Map(usersResult.data.users.map((user) => [user.id, user]));
    return (approvals ?? []).map((approval) => ({
      ...approval,
      displayName: profileById.get(approval.user_id)?.display_name ?? null,
      avatarUrl: profileById.get(approval.user_id)?.avatar_url ?? null,
      email: userById.get(approval.user_id)?.email ?? "Unknown email",
    }));
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => decisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.userId === context.userId && data.status === "denied") {
      throw new Error("You cannot deny your own administrator account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("account_approvals")
      .update({ status: data.status, reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });