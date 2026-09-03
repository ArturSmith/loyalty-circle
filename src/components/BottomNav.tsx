import { Link } from "@tanstack/react-router";
import { CreditCard, Compass, MessageCircle, Ticket, User } from "lucide-react";
import { useUnusedVoucherCount } from "@/hooks/useUnusedVoucherCount";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { DesktopAccountTools } from "@/components/DesktopAccountTools";

const items = [
  { to: "/wallet", label: "Wallet", icon: CreditCard },
  { to: "/vouchers", label: "Vouchers", icon: Ticket },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
] as const;

/**
 * True only on the five top-level tab screens. Detail pages pushed from a tab
 * (a single conversation, a card, the business dashboard) deliberately hide the
 * nav, so this matches exact paths rather than prefixes.
 */
export function isTabRoute(pathname: string) {
  return items.some((item) => item.to === pathname.replace(/\/$/, ""));
}

/** Desktop keeps app navigation available on customer detail screens too. */
export function isCustomerAppRoute(pathname: string) {
  const path = pathname.replace(/\/$/, "");
  return isTabRoute(path) || path.startsWith("/chats/") || path.startsWith("/discover/") ||
    path.startsWith("/b/") || ["/notifications", "/workspace", "/scan", "/settings/billing", "/subscribe"].includes(path);
}

export function BottomNav({ desktopOnly = false }: { desktopOnly?: boolean }) {
  const unusedVouchers = useUnusedVoucherCount();
  const unreadChats = useUnreadChatCount();

  return (
    <nav
      aria-label="Main navigation"
      className={`app-navigation pointer-events-none fixed inset-x-0 bottom-0 z-40 ${desktopOnly ? "hidden md:block" : ""}`}
      style={{
        paddingBottom: "var(--safe-bottom)",
        paddingLeft: "max(0.75rem, var(--safe-left))",
        paddingRight: "max(0.75rem, var(--safe-right))",
      }}
    >
      <div className="app-navigation-inner">
      <div className="app-navigation-brand hidden md:flex" data-i18n-ignore>
        <CreditCard className="h-7 w-7 text-primary" aria-hidden="true" /> <span>ClubCarder</span>
      </div>
      <ul className="glass-tab-bar pointer-events-auto mx-auto mb-3 grid max-w-md grid-cols-5 gap-0.5 p-1">
        {items.map(({ to, label, icon: Icon }) => {
          const badge = to === "/vouchers" ? unusedVouchers : to === "/chats" ? unreadChats : 0;
          const badgeLabel = to === "/chats" ? "unread" : "unused";
          return (
            <li key={to} className="min-w-0">
              <Link
                to={to}
                aria-label={badge > 0 ? `${label}, ${badge} ${badgeLabel}` : label}
                activeOptions={{ exact: true }}
                activeProps={{ className: "glass-tab-link-active", "aria-current": "page" }}
                className="glass-tab-link flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[9px] font-semibold leading-tight min-[360px]:text-[10px] sm:text-[11px]"
              >
                <span className="relative">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden="true" />
                  {badge > 0 && (
                    <span
                      aria-hidden
                      className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-card/90"
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <DesktopAccountTools />
      </div>
    </nav>
  );
}
