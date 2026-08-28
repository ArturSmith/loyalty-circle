import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Forbidden");
}

export const amIAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ admin: boolean }> => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: !!data };
  });

export type AdminBusiness = {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string | null;
  city: string | null;
  comped: boolean;
  comped_note: string | null;
  created_at: string;
};

export type AdminModerationSubmission = {
  id: string;
  entity_type: "business" | "card";
  entity_id: string;
  business_id: string;
  business_name: string;
  entity_name: string;
  change_kind: "create" | "update";
  proposed_data: Json;
  submitted_at: string;
  submitted_by: string | null;
};

export const listModerationForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminModerationSubmission[]> => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("moderation_submissions")
      .select("id,entity_type,entity_id,business_id,change_kind,proposed_data,submitted_at,submitted_by")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true })
      .limit(200);
    if (error) throw error;

    const businessIds = Array.from(new Set((rows ?? []).map((row: any) => row.business_id))) as string[];
    const cardIds = (rows ?? [])
      .filter((row: any) => row.entity_type === "card")
      .map((row: any) => row.entity_id) as string[];
    const [{ data: businesses }, { data: cards }] = await Promise.all([
      businessIds.length
        ? supabaseAdmin.from("businesses").select("id,name").in("id", businessIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      cardIds.length
        ? supabaseAdmin.from("card_templates").select("id,title").in("id", cardIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);
    const businessNames = new Map((businesses ?? []).map((row: any) => [row.id, row.name]));
    const cardNames = new Map((cards ?? []).map((row: any) => [row.id, row.title]));

    return (rows ?? []).map((row: any) => {
      const proposed = row.proposed_data as Record<string, any>;
      const businessName = proposed?.business?.name ?? businessNames.get(row.business_id) ?? "Business";
      const entityName = row.entity_type === "card"
        ? proposed?.card?.title ?? cardNames.get(row.entity_id) ?? "Loyalty card"
        : businessName;
      return {
        ...row,
        business_name: businessName,
        entity_name: entityName,
      } as AdminModerationSubmission;
    });
  });

export const reviewModerationForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { submissionId: string; decision: "accepted" | "rejected"; reason?: string }) => {
    if (!data?.submissionId) throw new Error("submissionId required");
    if (data.decision !== "accepted" && data.decision !== "rejected") throw new Error("Invalid decision");
    const reason = (data.reason ?? "").trim();
    if (data.decision === "rejected" && reason.length < 3) throw new Error("A rejection reason is required");
    return { submissionId: data.submissionId, decision: data.decision, reason: reason || null };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin.rpc as any)("review_moderation_submission", {
      _submission_id: data.submissionId,
      _decision: data.decision,
      _reviewer_id: context.userId,
      _reason: data.reason,
    });
    if (error) throw error;
    return { ok: true };
  });

export const listBusinessesForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { q?: string } | undefined) => ({ q: (data?.q ?? "").trim() }))
  .handler(async ({ data, context }): Promise<AdminBusiness[]> => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("businesses")
      .select("id,name,owner_id,city,comped,comped_note,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.q) query = query.ilike("name", `%${data.q}%`);
    const { data: rows, error } = await query;
    if (error) throw error;

    const out: AdminBusiness[] = [];
    for (const b of rows ?? []) {
      let email: string | null = null;
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(b.owner_id as string);
        email = u?.user?.email ?? null;
      } catch {
        email = null;
      }
      out.push({ ...(b as any), owner_email: email });
    }
    return out;
  });

export const setBusinessComped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { businessId: string; comped: boolean; note?: string }) => {
    if (!data?.businessId) throw new Error("businessId required");
    return {
      businessId: data.businessId,
      comped: !!data.comped,
      note: (data.note ?? "").slice(0, 200) || null,
    };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({ comped: data.comped, comped_note: data.comped ? data.note : null })
      .eq("id", data.businessId);
    if (error) throw error;
    return { ok: true };
  });

export const setAdminByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; admin: boolean }) => {
    const email = (data?.email ?? "").trim().toLowerCase();
    if (!email) throw new Error("email required");
    return { email, admin: !!data.admin };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId: string | null = null;
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      userId = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email)?.id ?? null;
      if (list.users.length < 200) break;
    }
    if (!userId) throw new Error("No account found with that email");

    if (data.admin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) throw error;
    }
    return { ok: true };
  });
