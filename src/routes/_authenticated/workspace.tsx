import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, ChevronRight, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { TabScreen } from "@/components/TabScreen";

type WorkspaceBusiness = {
  id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  role: "owner" | "admin";
};

export const Route = createFileRoute("/_authenticated/workspace")({
  head: () => ({ meta: [{ title: "Workspace — ClubCarder" }] }),
  component: Workspace,
});

function Workspace() {
  const [businesses, setBusinesses] = useState<WorkspaceBusiness[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }

      const [{ data: owned }, { data: memberships }] = await Promise.all([
        supabase
          .from("businesses")
          .select("id,name,city,logo_url")
          .eq("owner_id", auth.user.id)
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("business_members")
          .select("business_id")
          .eq("user_id", auth.user.id)
          .eq("role", "admin")
          .eq("status", "active"),
      ]);

      const adminIds = ((memberships as { business_id: string }[] | null) ?? []).map(
        (membership) => membership.business_id,
      );
      const { data: administered } = adminIds.length
        ? await supabase.from("businesses").select("id,name,city,logo_url").in("id", adminIds)
        : { data: [] };

      const ownRows = ((owned as Omit<WorkspaceBusiness, "role">[] | null) ?? []).map((business) => ({
        ...business,
        role: "owner" as const,
      }));
      const adminRows = ((administered as Omit<WorkspaceBusiness, "role">[] | null) ?? [])
        .filter((business) => !ownRows.some((ownedBusiness) => ownedBusiness.id === business.id))
        .map((business) => ({ ...business, role: "admin" as const }));

      setBusinesses([...ownRows, ...adminRows]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <PageLoader />;

  return (
    <TabScreen
      title="Workspace"
      subtitle="Choose a business you own or help manage."
      contentClassName="flex-1 px-5 py-6"
    >
      <div className="mx-auto w-full max-w-md">

        {businesses.length === 0 ? (
          <section className="rounded-2xl glass-panel p-5 text-center">
            <Building2 className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">You don’t have access to a business yet.</p>
            <Link to="/business" className="mt-4 block">
              <Button className="w-full gap-2"><Store className="h-4 w-4" /> Create a business</Button>
            </Link>
          </section>
        ) : (
          <div className="space-y-3">
            {businesses.map((business) => (
              <Link
                key={business.id}
                to="/business"
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
