import { Link } from "@tanstack/react-router";
import { CreditCard, Compass, MessageCircle, Ticket, User } from "lucide-react";
import { useUnusedVoucherCount } from "@/hooks/useUnusedVoucherCount";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";

const items = [
  { to: "/wallet", label: "Wallet", icon: CreditCard },
  { to: "/vouchers", label: "Vouchers", icon: Ticket },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const unusedVouchers = useUnusedVoucherCount();
  const unreadChats = useUnreadChatCount();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map(({ to, label, icon: Icon }) => {
          const badge = to === "/vouchers" ? unusedVouchers : to === "/chats" ? unreadChats : 0;
          const badgeLabel = to === "/chats" ? "unread" : "unused";
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-label={badge > 0 ? `${label}, ${badge} ${badgeLabel}` : label}
                activeProps={{ className: "text-primary" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors hover:text-foreground"
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {badge > 0 && (
                    <span
                      aria-hidden
                      className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
