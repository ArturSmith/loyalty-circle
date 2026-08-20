import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUnreadChatCount } from "@/utils/chats.functions";

/**
 * Shared unread-message count for the Chats badge.
 *
 * Mirrors `useUnusedVoucherCount`: the badge renders on every screen, so it
 * refreshes on realtime inserts and tab focus rather than polling, and pages
 * that already know the true number publish it directly.
 *
 * Unlike vouchers, the count can't be a single client-side query — unread spans
 * conversations the viewer owns *and* conversations they're the customer in, and
 * RLS-safe aggregation across both lives on the server.
 */
let cached: number | null = null;
const listeners = new Set<(n: number) => void>();
const refreshers = new Set<() => void>();

export function publishUnreadChatCount(n: number) {
  if (cached === n) return;
  cached = n;
  for (const listener of listeners) listener(n);
}

/** Ask mounted badges to recount, for callers that know something changed but
 *  not what the new total is. */
export function invalidateUnreadChatCount() {
  for (const refresh of refreshers) refresh();
}

export function useUnreadChatCount() {
  // Module state is shared between requests on the server, so only seed from the
  // cache in the browser.
  const [count, setCount] = useState(() => (typeof window === "undefined" ? 0 : cached ?? 0));

  const load = useCallback(async () => {
    try {
      const { count: n } = await getUnreadChatCount({});
      publishUnreadChatCount(n);
    } catch {
      // A failed count is not worth surfacing — the badge just keeps its
      // previous value until the next refresh.
    }
  }, []);

  useEffect(() => {
    listeners.add(setCount);
    return () => {
      listeners.delete(setCount);
    };
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const refresh = () => {
      void load();
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        // Signed out — drop any count left over from the previous session.
        publishUnreadChatCount(0);
        return;
      }
      void load();

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;
      // No filter: messages arrive on conversations this user may be either side
      // of, and RLS already limits the stream to conversations they can read.
      channel = supabase
        .channel(`chat-unread:${data.user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, refresh)
        .subscribe();
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
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
