import { Link } from "@tanstack/react-router";
import { Building2, CreditCard, LayoutDashboard, Menu, Wallet } from "lucide-react";

/** Persistent website navigation; operational routes still enforce their gates. */
export function BusinessDesktopNavigation({ businessId }: { businessId?: string }) {
  const linkClass = "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary";
  const activeProps = { className: "bg-primary/10 text-primary", "aria-current": "page" as const };
  return (
    <nav aria-label="Business navigation" className="business-desktop-navigation fixed inset-x-0 top-0 z-40 hidden border-b border-border bg-card md:block">
      <div className="app-navigation-inner">
        <div className="app-navigation-brand" data-i18n-ignore>
          <CreditCard className="h-7 w-7 text-primary" aria-hidden="true" /> <span>ClubCarder</span>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Link to="/business" search={{ businessId }} activeOptions={{ exact: true }} activeProps={activeProps} className={linkClass}><LayoutDashboard className="h-5 w-5" /> Dashboard</Link>
          {businessId && <Link to="/business/menu" search={{ businessId }} activeOptions={{ exact: true }} activeProps={activeProps} className={linkClass}><Menu className="h-5 w-5" /> Menu</Link>}
          <Link to="/workspace" search={{}} className={linkClass}><Building2 className="h-5 w-5" /> Workspace</Link>
          <Link to="/wallet" search={{}} className={linkClass}><Wallet className="h-5 w-5" /> My Wallet</Link>
        </div>
      </div>
    </nav>
  );
}
