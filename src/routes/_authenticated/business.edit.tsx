import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScreenLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import {
  BusinessForm,
  businessDetailsFromRow,
  businessDetailsToPayload,
  emptyBusinessDetails,
  isBusinessDetailsValid,
  type BusinessDetails,
} from "@/components/BusinessForm";
import { LocationsEditor } from "@/components/business/LocationsEditor";
import { SocialsEditor } from "@/components/business/SocialsEditor";
import { VisibilityEditor } from "@/components/business/VisibilityEditor";

export const Route = createFileRoute("/_authenticated/business/edit")({
  head: () => ({ meta: [{ title: "Edit business — ClubCarder" }] }),
  component: EditBusiness,
});

function EditBusiness() {
  const navigate = useNavigate();
  const [bizId, setBizId] = useState<string | null>(null);
  const [details, setDetails] = useState<BusinessDetails>(emptyBusinessDetails);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", u.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        setBizId((data as { id: string }).id);
        setDetails(businessDetailsFromRow(data as Record<string, unknown>));
      }
      setLoading(false);
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizId) return;
    if (!isBusinessDetailsValid(details)) {
      toast.error("Please fill in name, category and full address");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({ ...businessDetailsToPayload(details), updated_at: new Date().toISOString() })
      .eq("id", bizId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Business updated");
    navigate({ to: "/business" });
  };

  if (loading) return <ScreenLoader />;
  if (!bizId) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">No business found.</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/business">
          <Button variant="ghost" size="icon" aria-label="Back to dashboard" className="rounded-full glass-panel"><ChevronLeft className="h-5 w-5" /></Button>
        </Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Edit business</h1>
        <div className="w-9" />
      </header>

      <form onSubmit={save} className="flex-1 px-6 py-4 max-w-md mx-auto w-full">
        <BusinessForm value={details} onChange={setDetails} />
        <Button type="submit" disabled={saving} className="mt-8 w-full h-11">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>

      {/* Locations, networks and visibility save themselves, so they sit
          outside the form. */}
      <div className="px-6 pb-16 max-w-md mx-auto w-full space-y-10">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Locations
          </h2>
          <div className="mt-4">
            <LocationsEditor businessId={bizId} />
          </div>
        </section>
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            My Networks
          </h2>
          <div className="mt-4">
            <SocialsEditor businessId={bizId} />
          </div>
        </section>
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Visibility
          </h2>
          <div className="mt-4">
            <VisibilityEditor businessId={bizId} />
          </div>
        </section>
      </div>
    </div>
  );
}
