import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findCustomerForBusiness } from "@/lib/customers.server";
import type { CustomerLookupResult, CustomerCardSummary } from "@/lib/customers.server";

export type { CustomerLookupResult, CustomerCardSummary };

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
