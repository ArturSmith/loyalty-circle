import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationCount } from "@/hooks/useNotificationCount";
import type { NotificationScope } from "@/utils/notifications.functions";

export function NotificationButton({
  scope,
  businessId,
}: {
  scope: NotificationScope;
  businessId?: string;
}) {
  const count = useNotificationCount(scope, businessId);
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";
  const icon = (
    <span className="relative">
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </span>
  );

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="rounded-full glass-panel"
      aria-label={label}
      title="Notifications"
    >
      {scope === "business" && businessId ? (
        <Link to="/business/notifications" search={{ businessId }}>
          {icon}
        </Link>
      ) : (
        <Link to="/notifications">{icon}</Link>
      )}
    </Button>
  );
}
