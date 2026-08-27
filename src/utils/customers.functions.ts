import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findCustomerForBusiness, listCustomersForBusiness } from "@/lib/customers.server";
import type {
  BusinessCustomerSummary,
  CustomerLookupResult,
  CustomerCardSummary,
} from "@/lib/customers.server";

export type { BusinessCustomerSummary, CustomerLookupResult, CustomerCardSummary };

export const listBusinessCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { businessId: string }) => {
    const businessId = String(data?.businessId ?? "");
    if (!businessId) throw new Error("Business is required");
    return { businessId };
  })
  .handler(async ({ data, context }): Promise<{ customers: BusinessCustomerSummary[] }> => ({
    customers: await listCustomersForBusiness(context.userId, data.businessId),
  }));

/**
 * Looks up one of the calling business's own customers by scanned QR or typed
 * code. Scoped to the caller's business, so a code is never resolvable by a
 * business the customer has no relationship with.
 */
export const findCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { businessId: string; query: string }) => {
    const query = (data?.query ?? "").trim();
    if (!query) throw new Error("Enter a customer code");
    return { businessId: String(data?.businessId ?? ""), query };
  })
  .handler(async ({ data, context }): Promise<CustomerLookupResult> => {
    return findCustomerForBusiness(context.userId, data.businessId, data.query);
  });
