/** Server-only: resolve a scanned/typed customer code to someone holding this business's cards. */

import { parseCustomerQuery } from "@/lib/customer-code";

export type CustomerCardSummary = {
  instance_id: string;
  template_id: string;
  title: string;
  stamps_count: number;
  total_steps: number;
  completed_at: string | null;
  created_at: string;
};

export type CustomerLookupHit = {
  status: "found";
  customer: { id: string; display_name: string | null; avatar_url: string | null };
  cards: CustomerCardSummary[];
};

export type CustomerLookupMiss = {
  /**
   * `ambiguous` is deliberately distinct from `not_found`: it means the code is
   * valid but too short, which the UI can fix by asking for more characters.
   */
  status: "not_found" | "ambiguous" | "invalid";
  matches?: number;
};

export type CustomerLookupResult = CustomerLookupHit | CustomerLookupMiss;

/** UUIDs are stored with dashes; codes are typed without. Compare on bare hex. */
const bareHex = (value: string) => value.replace(/-/g, "").toLowerCase();

export async function findCustomerForBusiness(userId: string, businessId: string, rawQuery: string): Promise<CustomerLookupResult> {
  const query = parseCustomerQuery(rawQuery);
  if (!query) return { status: "invalid" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) return { status: "not_found" };

  const { data: membership } = await (supabaseAdmin as any)
    .from("business_members")
    .select("id")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const { data: ownership } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!membership && !ownership) return { status: "not_found" };

  const { data: templates } = await supabaseAdmin
    .from("card_templates")
    .select("id, title, total_steps")
    .eq("business_id", business.id);

  const templateIds = (templates ?? []).map((t: any) => t.id);
  if (templateIds.length === 0) return { status: "not_found" };

  // Removing a card deletes its instance row, so simply having a row here is
  // what "active holder" means — no need to consult the card_events log.
  const { data: instances } = await supabaseAdmin
    .from("card_instances")
    .select("id, customer_id, template_id, stamps_count, completed_at, created_at")
    .in("template_id", templateIds)
    .not("customer_id", "is", null);

  const matching = (instances ?? []).filter((i: any) => bareHex(i.customer_id).startsWith(query));
  if (matching.length === 0) return { status: "not_found" };

  const customerIds = Array.from(new Set(matching.map((i: any) => i.customer_id)));
  // The prefix is only meaningful if it lands on exactly one person. Say so
  // rather than silently showing whichever record happened to sort first.
  if (customerIds.length > 1) return { status: "ambiguous", matches: customerIds.length };

  const customerId = customerIds[0] as string;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", customerId)
    .maybeSingle();

  const templateById = new Map((templates ?? []).map((t: any) => [t.id, t]));
  const cards: CustomerCardSummary[] = matching
    .filter((i: any) => i.customer_id === customerId)
    .map((i: any) => {
      const template = templateById.get(i.template_id);
      return {
        instance_id: i.id,
        template_id: i.template_id,
        title: template?.title ?? "Card",
        stamps_count: i.stamps_count ?? 0,
        total_steps: template?.total_steps ?? 0,
        completed_at: i.completed_at,
        created_at: i.created_at,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    status: "found",
    customer: {
      id: customerId,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    },
    cards,
  };
}
