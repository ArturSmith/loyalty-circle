import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUnreadChatCount } from "@/utils/chats.functions";
import type { ChatScope } from "@/utils/chats.functions";

/**
 * Shared unread-message count for the Chats badges.
 *
 * Mirrors `useUnusedVoucherCount`: the badge renders on every screen, so it
 * refreshes on realtime inserts and tab focus rather than polling, and pages
 * that already know the true number publish it directly.
 *
 * Counts are kept per scope. Someone who runs a business is also a customer
 * elsewhere, and a single total would light up their personal Chats tab for
 * enquiries they can only read from the dashboard.
 */
const cached: Record<ChatScope, number | null> = { customer: null, business: null };
const listeners: Record<ChatScope, Set<(n: number) => void>> = { customer: new Set(), business: new Set() };
const refreshers: Record<ChatScope, Set<() => void>> = { customer: new Set(), business: new Set() };

export function publishUnreadChatCount(n: number, scope: ChatScope = "customer") {
  if (cached[scope] === n) return;
  cached[scope] = n;
  for (const listener of listeners[scope]) listener(n);
}

/** Ask mounted badges to recount, for callers that know something changed but
 *  not what the new total is. */
export function invalidateUnreadChatCount(scope?: ChatScope) {
  const scopes: ChatScope[] = scope ? [scope] : ["customer", "business"];
  for (const s of scopes) for (const refresh of refreshers[s]) refresh();
}

export function useUnreadChatCount(scope: ChatScope = "customer") {
  // Module state is shared between requests on the server, so only seed from the
  // cache in the browser.
  const [count, setCount] = useState(() => (typeof window === "undefined" ? 0 : cached[scope] ?? 0));

  const load = useCallback(async () => {
    try {
      const { count: n } = await getUnreadChatCount({ data: { scope } });
      publishUnreadChatCount(n, scope);
    } catch {
      // A failed count is not worth surfacing — the badge just keeps its
      // previous value until the next refresh.
    }
  }, [scope]);

  useEffect(() => {
    const scoped = listeners[scope];
    scoped.add(setCount);
    return () => {
      scoped.delete(setCount);
    };
  }, [scope]);

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
        publishUnreadChatCount(0, scope);
        return;
      }
      void load();

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      if (cancelled) return;
      // No filter: messages arrive on conversations this user may be either side
      // of, and RLS already limits the stream to conversations they can read.
      channel = supabase
        .channel(`chat-unread:${scope}:${data.user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, refresh)
        .subscribe();
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    refreshers[scope].add(refresh);

    return () => {
      cancelled = true;
      refreshers[scope].delete(refresh);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [load, scope]);

  return count;
}
