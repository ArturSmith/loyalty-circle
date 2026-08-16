import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyVoucher = {
  id: string;
  label: string;
  status: "unused" | "used";
  step_number: number;
  created_at: string;
  redeemed_at: string | null;
  card_title: string;
  accent_color: string;
  bg_color: string;
  text_color: string;
  business: {
    id: string;
    name: string;
    logo_url: string | null;
    phone: string | null;
    website: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
};

export const getMyVouchers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyVoucher[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("vouchers")
      .select("id, label, status, step_number, created_at, redeemed_at, template_id, business_id")
      .eq("customer_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!rows || rows.length === 0) return [];

    const templateIds = Array.from(new Set(rows.map((r: any) => r.template_id)));
    const businessIds = Array.from(new Set(rows.map((r: any) => r.business_id)));

    const [{ data: templates }, { data: businesses }] = await Promise.all([
      supabaseAdmin.from("card_templates").select("id, title, accent_color, bg_color, text_color").in("id", templateIds),
      supabaseAdmin
        .from("businesses")
        .select("id, name, logo_url, phone, website, address_line1, address_line2, city, postal_code, country")
        .in("id", businessIds),
    ]);

    const tMap = new Map((templates ?? []).map((t: any) => [t.id, t]));
    const bMap = new Map((businesses ?? []).map((b: any) => [b.id, b]));

    return rows.map((r: any) => {
      const t = tMap.get(r.template_id);
      return {
        id: r.id,
        label: r.label,
        status: r.status === "used" ? "used" : "unused",
        step_number: r.step_number,
        created_at: r.created_at,
        redeemed_at: r.redeemed_at,
        card_title: t?.title ?? "Loyalty card",
        accent_color: t?.accent_color ?? "#3b82f6",
        bg_color: t?.bg_color ?? "#ffffff",
        text_color: t?.text_color ?? "#1a1a2e",
        business: bMap.get(r.business_id) ?? null,
      } satisfies MyVoucher;
    });
  });
