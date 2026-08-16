import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared unused-voucher count, so the bottom nav badge and any page that
 * already knows the number stay in agreement.
 *
 * The badge renders on every page, so it can't afford to poll. It refreshes on
 * realtime events and tab focus — but neither of those fires while the customer
 * sits on the vouchers page watching a redemption, which is exactly when the
 * badge must move. Pages holding the real list push the authoritative count in
 * via `publishUnusedVoucherCount`, costing no extra query.
 */
let cached: number | null = null;
const listeners = new Set<(n: number) => void>();
const refreshers = new Set<() => void>();

export function publishUnusedVoucherCount(n: number) {
  if (cached === n) return;
  cached = n;
  for (const listener of listeners) listener(n);
}

/** Ask mounted badges to recount — for callers that know something changed
 *  but not what the new total is. */
export function invalidateUnusedVoucherCount() {
  for (const refresh of refreshers) refresh();
}

export function useUnusedVoucherCount() {
  // The cache is module state, which on the server is shared between requests —
  // so only seed from it in the browser, never during SSR.
  const [count, setCount] = useState(() =>
    typeof window === "undefined" ? 0 : cached ?? 0,
  );

  const load = useCallback(async (userId: string) => {
    const { count: n, error } = await supabase
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", userId)
      .eq("status", "unused");
    if (!error) publishUnusedVoucherCount(n ?? 0);
  }, []);

  // Keep this badge in step with every other one, and with pages that publish.
  useEffect(() => {
    listeners.add(setCount);
    return () => { listeners.delete(setCount); };
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let userId: string | null = null;

    const refresh = () => { if (userId) void load(userId); };

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        // Signed out — clear any count left over from the previous session.
        publishUnusedVoucherCount(0);
        return;
      }
      userId = data.user.id;
      void load(userId);

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;
      channel = supabase
        .channel(`voucher-count:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "vouchers", filter: `customer_id=eq.${userId}` },
          refresh,
        )
        .subscribe();
    })();

    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    refreshers.add(refresh);

    return () => {
      cancelled = true;
      refreshers.delete(refresh);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  return count;
}
