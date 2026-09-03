import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Check, ChevronDown, LoaderCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loadWorkspaceBusinesses, type WorkspaceBusiness } from "@/lib/workspaces";

// Omitting businessId selects the personal Wallet space. In that context the
// trigger is hidden until at least one managed business has been confirmed.
export function SpacesButton({ businessId }: { businessId?: string }) {
  const [open, setOpen] = useState(false);
  const [businesses, setBusinesses] = useState<WorkspaceBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open && businessId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    // Recheck membership on each open. A failed request must not look like an
    // empty account, and it must never prevent returning to the personal Wallet.
    loadWorkspaceBusinesses().then((next) => {
      if (!cancelled) setBusinesses(next);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, businessId]);

  const canSwitch = businesses.some((business) => business.id !== businessId);
  if (!businessId && businesses.length === 0) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button className="h-9 gap-1.5 rounded-full bg-primary px-3 text-primary-foreground shadow-none hover:bg-primary/90">
          Spaces <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl p-2">
        <DropdownMenuItem asChild disabled={!businessId} className="min-h-11 cursor-pointer rounded-xl px-3 data-[disabled]:opacity-100">
          <Link to="/wallet" search={{}} aria-current={!businessId ? "page" : undefined}>
            <Wallet aria-hidden="true" />
            <span className="flex-1 font-semibold">My Wallet</span>
            {!businessId && <Check className="text-primary" aria-hidden="true" />}
          </Link>
        </DropdownMenuItem>
        {loading ? (
          <div role="status" className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading workspaces…
          </div>
        ) : failed ? (
          <>
            <p role="status" className="px-3 py-2 text-xs text-muted-foreground">Workspaces couldn’t be loaded.</p>
            <DropdownMenuItem asChild className="min-h-11 cursor-pointer rounded-xl px-3">
              <Link to="/workspace" search={{}}>Open Workspace</Link>
            </DropdownMenuItem>
          </>
        ) : canSwitch ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-3 text-xs text-muted-foreground">Switch workspace</DropdownMenuLabel>
            {businesses.map((business) => (
              <DropdownMenuItem
                key={business.id}
                asChild
                disabled={business.id === businessId}
                className="min-h-12 cursor-pointer rounded-xl px-3 data-[disabled]:opacity-100"
              >
                <Link
                  to={business.accepted_by_platform ? "/business" : "/business/review"}
                  search={{ businessId: business.id }}
                  aria-current={business.id === businessId ? "page" : undefined}
                >
                  <Building2 className="text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block [overflow-wrap:anywhere] font-medium" data-i18n-ignore>{business.name}</span>
                    <span className="block text-xs text-muted-foreground">{business.role === "owner" ? "Owner" : "Admin"}</span>
                    {!business.accepted_by_platform && (
                      <span className="block text-xs text-muted-foreground">
                        {business.onboarding_completed_at ? "Awaiting approval" : "Finish setup"}
                      </span>
                    )}
                  </span>
                  {business.id === businessId && <Check className="text-primary" aria-hidden="true" />}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
