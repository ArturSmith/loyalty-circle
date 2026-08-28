import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getUnreadNotificationCount,
  type NotificationScope,
} from "@/utils/notifications.functions";

const cached = new Map<string, number>();
const listeners = new Map<string, Set<(count: number) => void>>();
const refreshers = new Map<string, Set<() => void>>();

function scopeKey(scope: NotificationScope, businessId?: string) {
  return scope === "business" ? `business:${businessId ?? ""}` : "customer";
}

function publish(key: string, count: number) {
  if (cached.get(key) === count) return;
  cached.set(key, count);
  listeners.get(key)?.forEach((listener) => listener(count));
}

export function invalidateNotificationCount(scope: NotificationScope, businessId?: string) {
  refreshers.get(scopeKey(scope, businessId))?.forEach((refresh) => refresh());
}

export function useNotificationCount(scope: NotificationScope, businessId?: string) {
  const fetchCount = useServerFn(getUnreadNotificationCount);
  const key = useMemo(() => scopeKey(scope, businessId), [scope, businessId]);
  const [count, setCount] = useState(() =>
    typeof window === "undefined" ? 0 : (cached.get(key) ?? 0),
  );

  const load = useCallback(async () => {
    if (scope === "business" && !businessId) return;
    try {
      const result = await fetchCount({ data: { scope, businessId } });
      publish(key, result.count);
    } catch {
      // Keep the last badge value during a transient network or rollout error.
    }
  }, [businessId, fetchCount, key, scope]);

  useEffect(() => {
    const scopedListeners = listeners.get(key) ?? new Set<(count: number) => void>();
    scopedListeners.add(setCount);
    listeners.set(key, scopedListeners);
    return () => {
      scopedListeners.delete(setCount);
    };
  }, [key]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const refresh = () => void load();
    const scopedRefreshers = refreshers.get(key) ?? new Set<() => void>();
    scopedRefreshers.add(refresh);
    refreshers.set(key, scopedRefreshers);

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user || (scope === "business" && !businessId)) return;
      refresh();
      const filter =
        scope === "business" ? `business_id=eq.${businessId}` : `recipient_id=eq.${data.user.id}`;
      channel = supabase
        .channel(`notification-count:${key}:${data.user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter },
          refresh,
        )
        .subscribe();
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      scopedRefreshers.delete(refresh);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [businessId, key, load, scope]);

  return count;
}
