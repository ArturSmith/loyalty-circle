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
  type BusinessFormSection,
} from "@/components/BusinessForm";
import { LocationsEditor } from "@/components/business/LocationsEditor";
import { SocialsEditor } from "@/components/business/SocialsEditor";
import { VisibilityEditor } from "@/components/business/VisibilityEditor";
import { BusinessLifecycle } from "@/components/business/BusinessLifecycle";
import { z } from "zod";

/** Rendered as separate cards; BusinessForm supplies each heading. */
const DETAIL_SECTIONS: BusinessFormSection[] = ["basics", "address", "contact", "about"];

export const Route = createFileRoute("/_authenticated/business/edit")({
  head: () => ({ meta: [{ title: "Edit business — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: EditBusiness,
});

function EditBusiness() {
  const navigate = useNavigate();
  const { businessId } = Route.useSearch();
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
        .eq("id", businessId)
        .maybeSingle();
      if (data) {
        setBizId((data as { id: string }).id);
        setDetails(businessDetailsFromRow(data as Record<string, unknown>));
      }
      setLoading(false);
    })();
  }, [businessId]);

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
    navigate({ to: "/business", search: { businessId } });
  };

  if (loading) return <ScreenLoader />;
  if (!bizId) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">No business found.</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/business" search={{ businessId }}>
          <Button variant="ghost" size="icon" aria-label="Back to dashboard" className="rounded-full glass-panel"><ChevronLeft className="h-5 w-5" /></Button>
        </Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Edit business</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 px-6 py-4 pb-16 max-w-md mx-auto w-full space-y-4">
        {/* Each concern is its own card, matching the profile page. The
            details form still submits as one unit, so it keeps a single
            surrounding <form> spanning its cards. */}
        <form onSubmit={save} className="space-y-4">
          {DETAIL_SECTIONS.map((section) => (
            <section key={section} className="rounded-2xl glass-panel p-4">
              <BusinessForm value={details} onChange={setDetails} sections={[section]} />
            </section>
          ))}
          <Button type="submit" disabled={saving} className="w-full h-11">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>

        {/* Locations, networks and visibility save themselves, so they sit
            outside the form. */}
        <section className="rounded-2xl glass-panel p-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Locations
          </h2>
          <div className="mt-4">
            <LocationsEditor businessId={bizId} />
          </div>
        </section>
        <section className="rounded-2xl glass-panel p-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            My Networks
          </h2>
          <div className="mt-4">
            <SocialsEditor businessId={bizId} />
          </div>
        </section>
        <section className="rounded-2xl glass-panel p-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Visibility
          </h2>
          <div className="mt-4">
            <VisibilityEditor businessId={bizId} />
          </div>
        </section>
        <section className="rounded-2xl glass-panel p-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Business status
          </h2>
          <div className="mt-4">
            <BusinessLifecycle businessId={bizId} businessName={details.name} />
          </div>
        </section>
      </div>
    </div>
  );
}
