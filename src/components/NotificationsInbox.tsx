import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck, CheckCircle2, Clock3, Gift, Stamp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/Spinner";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationScope,
} from "@/utils/notifications.functions";
import { invalidateNotificationCount } from "@/hooks/useNotificationCount";

export function NotificationsInbox({
  scope,
  businessId,
}: {
  scope: NotificationScope;
  businessId?: string;
}) {
  const navigate = useNavigate();
  const loadNotifications = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAllRead = useServerFn(markAllNotificationsRead);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    void loadNotifications({ data: { scope, businessId } })
      .then(setNotifications)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Notifications could not be loaded"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, [businessId, loadNotifications, scope]);

  const openNotification = async (notification: AppNotification) => {
    if (!notification.read_at) {
      try {
        const { readAt } = await markRead({ data: { notificationId: notification.id } });
        setNotifications((current) =>
          current.map((row) => (row.id === notification.id ? { ...row, read_at: readAt } : row)),
        );
        invalidateNotificationCount(scope, businessId);
      } catch {
        // Navigation remains available if recording read state fails.
      }
    }

    const metadata = isRecord(notification.metadata) ? notification.metadata : {};
    if (scope === "business" && businessId) {
      if (metadata.entity_type === "card" && typeof metadata.entity_id === "string") {
        navigate({
          to: "/business/cards/$id",
          params: { id: metadata.entity_id },
          search: { businessId },
        });
      } else if (metadata.entity_type === "business") {
        navigate({ to: "/business/edit", search: { businessId } });
      } else {
        navigate({ to: "/business", search: { businessId } });
      }
      return;
    }

    if (typeof metadata.card_instance_id === "string") {
      try {
        sessionStorage.setItem("open_card_id", metadata.card_instance_id);
      } catch {
        // The wallet still opens even when storage is unavailable.
      }
    }
    navigate({ to: "/wallet" });
  };

  const markEverythingRead = async () => {
    setMarkingAll(true);
    try {
      const { readAt } = await markAllRead({ data: { scope, businessId } });
      setNotifications((current) => current.map((row) => ({ ...row, read_at: readAt })));
      invalidateNotificationCount(scope, businessId);
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="font-medium">Notifications couldn’t be loaded</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-4" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }

  const unread = notifications.filter((notification) => !notification.read_at).length;
  return (
    <div>
      {unread > 0 && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            disabled={markingAll}
            onClick={() => void markEverythingRead()}
          >
            <CheckCheck className="h-4 w-4" />
            {markingAll ? "Marking…" : "Mark all as read"}
          </Button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
          <Bell className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 font-medium">No notifications yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope === "business"
              ? "Platform reviews and other business updates will appear here."
              : "Wallet, stamp and reward updates will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const Icon = notificationIcon(notification.event_type);
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => void openNotification(notification)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors hover:bg-muted/40 ${
                  notification.read_at
                    ? "border-border bg-card"
                    : "border-primary/25 bg-primary/[0.045]"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${notificationIconClass(notification.event_type)}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold">{notification.title}</span>
                    {!notification.read_at && (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    )}
                  </span>
                  <span className="mt-1 block whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {notification.body}
                  </span>
                  <span className="mt-2 block text-[11px] text-muted-foreground">
                    {formatNotificationTime(notification.created_at)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function notificationIcon(eventType: string) {
  if (eventType === "moderation_rejected") return XCircle;
  if (eventType === "moderation_accepted") return CheckCircle2;
  if (eventType === "moderation_pending") return Clock3;
  if (eventType === "reward_unlocked") return Gift;
  if (eventType === "stamp_added") return Stamp;
  return Bell;
}

function notificationIconClass(eventType: string) {
  if (eventType === "moderation_rejected") return "bg-destructive/10 text-destructive";
  if (eventType === "moderation_accepted" || eventType === "reward_unlocked") {
    return "bg-emerald-500/10 text-emerald-700";
  }
  if (eventType === "moderation_pending") return "bg-amber-500/10 text-amber-700";
  return "bg-primary/10 text-primary";
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
