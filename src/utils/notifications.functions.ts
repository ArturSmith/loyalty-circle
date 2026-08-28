import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json, Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationScope = "business" | "customer";

export type AppNotification = {
  id: string;
  audience: NotificationScope;
  business_id: string | null;
  recipient_id: string | null;
  event_type: string;
  title: string;
  body: string;
  action_url: string | null;
  metadata: Json;
  created_at: string;
  read_at: string | null;
};

type NotificationScopeInput = {
  scope: NotificationScope;
  businessId?: string;
};

function validateScope(data: NotificationScopeInput) {
  if (data?.scope !== "business" && data?.scope !== "customer") {
    throw new Error("Invalid notification scope");
  }
  if (data.scope === "business" && !data.businessId) {
    throw new Error("businessId is required");
  }
  return data;
}

async function loadVisibleNotifications(
  supabase: SupabaseClient<Database>,
  data: NotificationScopeInput,
  limit = 100,
) {
  let query = supabase
    .from("notifications")
    .select(
      "id,audience,business_id,recipient_id,event_type,title,body,action_url,metadata,created_at",
    )
    .eq("audience", data.scope)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (data.scope === "business") query = query.eq("business_id", data.businessId!);

  const { data: rows, error } = await query;
  if (error) throw error;
  return (rows ?? []) as Omit<AppNotification, "read_at">[];
}

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateScope)
  .handler(async ({ data, context }): Promise<AppNotification[]> => {
    const rows = await loadVisibleNotifications(context.supabase, data);
    if (rows.length === 0) return [];

    const { data: reads, error } = await context.supabase
      .from("notification_reads")
      .select("notification_id,read_at")
      .in(
        "notification_id",
        rows.map((row) => row.id),
      );
    if (error) throw error;
    const readTimes = new Map<string, string>(
      (reads ?? []).map((read: { notification_id: string; read_at: string }) => [
        read.notification_id,
        read.read_at,
      ]),
    );
    return rows.map((row) => ({ ...row, read_at: readTimes.get(row.id) ?? null }));
  });

export const getUnreadNotificationCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateScope)
  .handler(async ({ data, context }): Promise<{ count: number }> => {
    const rows = await loadVisibleNotifications(context.supabase, data, 500);
    if (rows.length === 0) return { count: 0 };
    const { data: reads, error } = await context.supabase
      .from("notification_reads")
      .select("notification_id")
      .in(
        "notification_id",
        rows.map((row) => row.id),
      );
    if (error) throw error;
    const readIds = new Set(
      (reads ?? []).map((read: { notification_id: string }) => read.notification_id),
    );
    return { count: rows.filter((row) => !readIds.has(row.id)).length };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { notificationId: string }) => {
    if (!data?.notificationId) throw new Error("notificationId is required");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ readAt: string }> => {
    const { data: notification, error: notificationError } = await context.supabase
      .from("notifications")
      .select("id")
      .eq("id", data.notificationId)
      .maybeSingle();
    if (notificationError) throw notificationError;
    if (!notification) throw new Error("Notification not found");

    const readAt = new Date().toISOString();
    const { error } = await context.supabase.from("notification_reads").upsert(
      {
        notification_id: data.notificationId,
        user_id: context.userId,
        read_at: readAt,
      },
      { onConflict: "notification_id,user_id" },
    );
    if (error) throw error;
    return { readAt };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateScope)
  .handler(async ({ data, context }): Promise<{ readAt: string }> => {
    const rows = await loadVisibleNotifications(context.supabase, data, 500);
    const readAt = new Date().toISOString();
    if (rows.length === 0) return { readAt };

    const { error } = await context.supabase.from("notification_reads").upsert(
      rows.map((row) => ({
        notification_id: row.id,
        user_id: context.userId,
        read_at: readAt,
      })),
      { onConflict: "notification_id,user_id" },
    );
    if (error) throw error;
    return { readAt };
  });
