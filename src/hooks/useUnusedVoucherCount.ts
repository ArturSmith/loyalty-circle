import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Number of vouchers the signed-in customer hasn't redeemed yet, for the
 * bottom nav badge.
 *
 * This runs on every page that shows the nav, so it's a `head` count rather
 * than a row fetch. Kept fresh with realtime, with a visibility-change refetch
 * as a fallback for when the socket drops.
 */
export function useUnusedVoucherCount() {
  const [count, setCount] = useState(0);

  const load = useCallback(async (userId: string) => {
    const { count: n, error } = await supabase
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", userId)
      .eq("status", "unused");
    if (!error) setCount(n ?? 0);
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let userId: string | null = null;

    const refresh = () => { if (userId) void load(userId); };

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
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

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  return count;
}
