import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
