import { Link } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";

/** Persistent website navigation; operational routes still enforce their gates. */
export function BusinessDesktopNavigation({ businessId }: { businessId?: string }) {
  const linkClass = "rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary";
  const activeProps = { className: "bg-primary/10 text-primary", "aria-current": "page" as const };
  return (
    <nav aria-label="Business navigation" className="business-desktop-navigation fixed inset-x-0 top-0 z-40 hidden border-b border-border bg-card md:block">
      <div className="app-navigation-inner">
        <div className="app-navigation-brand" data-i18n-ignore>
          <CreditCard className="h-7 w-7 text-primary" aria-hidden="true" /> <span className="hidden lg:inline">ClubCarder</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Link to="/business" search={{ businessId }} activeOptions={{ exact: true }} activeProps={activeProps} className={linkClass}>Dashboard</Link>
          {businessId && <Link to="/business/menu" search={{ businessId }} activeOptions={{ exact: true }} activeProps={activeProps} className={linkClass}>Menu</Link>}
          <Link to="/workspace" search={{}} className={linkClass}>Workspace</Link>
          <Link to="/wallet" search={{}} className={linkClass}>My Wallet</Link>
        </div>
      </div>
    </nav>
  );
}
