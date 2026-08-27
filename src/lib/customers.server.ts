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

export type BusinessCustomerSummary = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  joined_at: string;
  cards: CustomerCardSummary[];
};

/** UUIDs are stored with dashes; codes are typed without. Compare on bare hex. */
const bareHex = (value: string) => value.replace(/-/g, "").toLowerCase();

async function canViewBusinessCustomers(userId: string, businessId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select("id, owner_id")
    .eq("id", businessId)
    .maybeSingle();

  if (!business) return { allowed: false, business: null } as const;
  if (business.owner_id === userId) return { allowed: true, business } as const;

  const { data: membership } = await (supabaseAdmin as any)
    .from("business_members")
    .select("role, permissions")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const member = membership as { role?: string; permissions?: string[] } | null;
  const allowed = member?.role === "owner" || (member?.permissions ?? []).includes("customers.view");
  return { allowed, business } as const;
}

/** All current card holders for a business, with progress for every program. */
export async function listCustomersForBusiness(
  userId: string,
  businessId: string,
): Promise<{ customers: BusinessCustomerSummary[]; activeCardCount: number }> {
  const access = await canViewBusinessCustomers(userId, businessId);
  if (!access.allowed || !access.business) throw new Error("You do not have permission to view customers");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: templates, error: templatesError } = await supabaseAdmin
    .from("card_templates")
    .select("id, title, total_steps, active")
    .eq("business_id", businessId);
  if (templatesError) throw templatesError;

  const templateById = new Map((templates ?? []).map((template) => [template.id, template]));
  const templateIds = [...templateById.keys()];
  const activeCardCount = (templates ?? []).filter((template) => template.active).length;
  if (templateIds.length === 0) return { customers: [], activeCardCount };

  type InstanceRow = {
    id: string;
    customer_id: string;
    template_id: string;
    stamps_count: number;
    completed_at: string | null;
    created_at: string;
  };

  // PostgREST caps responses, so page explicitly instead of silently dropping
  // customers once a business grows beyond the default row limit.
  const PAGE_SIZE = 1000;
  const instances: InstanceRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("card_instances")
      .select("id, customer_id, template_id, stamps_count, completed_at, created_at")
      .in("template_id", templateIds)
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as InstanceRow[];
    instances.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  if (instances.length === 0) return { customers: [], activeCardCount };

  const customerIds = Array.from(new Set(instances.map((instance) => instance.customer_id)));
  const profiles: Array<{ id: string; display_name: string | null; avatar_url: string | null }> = [];
  // Keep each `in (...)` URL comfortably below proxy limits.
  for (let index = 0; index < customerIds.length; index += 200) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", customerIds.slice(index, index + 200));
    if (error) throw error;
    profiles.push(...(data ?? []));
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const byCustomer = new Map<string, BusinessCustomerSummary>();
  for (const instance of instances) {
    const template = templateById.get(instance.template_id);
    if (!template) continue;
    let customer = byCustomer.get(instance.customer_id);
    if (!customer) {
      const profile = profileById.get(instance.customer_id);
      customer = {
        id: instance.customer_id,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        joined_at: instance.created_at,
        cards: [],
      };
      byCustomer.set(instance.customer_id, customer);
    }
    if (instance.created_at < customer.joined_at) customer.joined_at = instance.created_at;
    customer.cards.push({
      instance_id: instance.id,
      template_id: instance.template_id,
      title: template.title,
      stamps_count: instance.stamps_count,
      total_steps: template.total_steps,
      completed_at: instance.completed_at,
      created_at: instance.created_at,
    });
  }

  const customers = [...byCustomer.values()].sort((a, b) => {
    const aName = a.display_name?.trim();
    const bName = b.display_name?.trim();
    if (aName && bName) return aName.localeCompare(bName);
    if (aName) return -1;
    if (bName) return 1;
    return b.joined_at.localeCompare(a.joined_at);
  });
  return { customers, activeCardCount };
}

export async function findCustomerForBusiness(userId: string, businessId: string, rawQuery: string): Promise<CustomerLookupResult> {
  const query = parseCustomerQuery(rawQuery);
  if (!query) return { status: "invalid" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const access = await canViewBusinessCustomers(userId, businessId);
  if (!access.allowed || !access.business) return { status: "not_found" };

  const { data: templates } = await supabaseAdmin
    .from("card_templates")
    .select("id, title, total_steps")
    .eq("business_id", access.business.id);

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
