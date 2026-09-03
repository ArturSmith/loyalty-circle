import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, ChevronRight, Store } from "lucide-react";
import { PageLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { TabScreen } from "@/components/TabScreen";
import { BackButton } from "@/components/BackButton";
import { getNavigationCache, setNavigationCache } from "@/lib/navigationCache";
import { loadWorkspaceBusinesses, type WorkspaceBusiness } from "@/lib/workspaces";

export const Route = createFileRoute("/_authenticated/workspace")({
  head: () => ({ meta: [{ title: "Workspace — ClubCarder" }] }),
  component: Workspace,
});

function Workspace() {
  const navigate = useNavigate();
  const cached = getNavigationCache<WorkspaceBusiness[]>("workspace");
  const [businesses, setBusinesses] = useState<WorkspaceBusiness[]>(() => cached?.value ?? []);
  const [loading, setLoading] = useState(() => cached === null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadWorkspaceBusinesses().then((next) => {
      if (cancelled) return;
      setBusinesses(next);
      setNavigationCache("workspace", next);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <PageLoader />;

  return (
    <TabScreen
      title="Workspace"
      subtitle="Choose a business you own or help manage."
      backAction={<BackButton label="Back to profile" onClick={() => navigate({ to: "/profile" })} />}
      contentClassName="flex-1 px-5 py-6"
    >
      <div className="mx-auto w-full max-w-md">

        {failed && <p role="alert" className="mb-4 text-sm text-destructive">Workspaces couldn’t be loaded.</p>}
        {businesses.length === 0 && !failed ? (
          <section className="rounded-2xl glass-panel p-5 text-center">
            <Building2 className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">You don’t have access to a business yet.</p>
            <Link to="/business/onboarding" className="mt-4 block">
              <Button className="w-full gap-2"><Store className="h-4 w-4" /> Create a business</Button>
            </Link>
          </section>
        ) : (
          <div className="space-y-3">
            {businesses.map((business) => (
              <Link
                key={business.id}
                to={business.accepted_by_platform ? "/business" : "/business/review"}
                search={{ businessId: business.id }}
                className="flex min-h-24 items-center gap-3 rounded-2xl border-2 border-ink/10 bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                  {business.logo_url ? (
                    <img src={business.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{business.name}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {business.role}
                    </span>
                  </div>
                  {business.city ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{business.city}</p> : null}
                  {!business.accepted_by_platform && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">{business.onboarding_completed_at ? "Awaiting approval" : "Finish setup"}</p>}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </TabScreen>
  );
}
