import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Clock3, Pencil, RefreshCw, CircleAlert } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { BackButton } from "@/components/BackButton";
import { TabScreen } from "@/components/TabScreen";
import { Button } from "@/components/ui/button";
import { ScreenLoader } from "@/components/Spinner";
import { invalidateNavigationCache } from "@/lib/navigationCache";

export const Route = createFileRoute("/_authenticated/business/review")({
  head: () => ({ meta: [{ title: "Business review — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: BusinessReviewRoute,
});

function BusinessReviewRoute() {
  const { businessId } = Route.useSearch();
  return <BusinessReview key={businessId} />;
}

type ReviewState = {
  business: {
    name: string;
    owner_id: string;
    accepted_by_platform: boolean;
    onboarding_completed_at: string | null;
  };
  submissions: {
    entity_type: string;
    entity_id: string;
    status: string;
    rejection_reason: string | null;
  }[];
};

function BusinessReview() {
  const { businessId } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [state, setState] = useState<ReviewState | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [business, submissions] = await Promise.all([
        supabase
          .from("businesses")
          .select("name,owner_id,accepted_by_platform,onboarding_completed_at")
          .eq("id", businessId)
          .single(),
        supabase
          .from("moderation_submissions")
          .select("entity_type,entity_id,status,rejection_reason")
          .eq("business_id", businessId)
          .order("submitted_at", { ascending: false }),
      ]);
      if (business.error) throw business.error;
      if (submissions.error) throw submissions.error;
      if (business.data.accepted_by_platform) invalidateNavigationCache();
      // Only the latest review per entity applies. An older rejection must
      // disappear when the owner has submitted a revised version.
      const seen = new Set<string>();
      const latest = submissions.data.filter((row) => {
        const key = `${row.entity_type}:${row.entity_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setState({ business: business.data, submissions: latest });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, [businessId]);

  useEffect(() => {
    setState(null);
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [refresh]);

  if (!state && !error) return <ScreenLoader />;
  if (state?.business.accepted_by_platform)
    return <Navigate to="/business" search={{ businessId }} replace />;
  const own = state?.business.owner_id === user.id;
  const rejected = state?.submissions.filter((row) => row.status === "rejected") ?? [];
  const incomplete = state && !state.business.onboarding_completed_at;
  const title = incomplete
    ? "Finish setting up your business"
    : rejected.some((row) => row.entity_type === "business")
      ? "Your business needs changes"
      : "Business is waiting for approval from moderators";

  return (
    <TabScreen
      title="Business review"
      backAction={
        <BackButton label="Back to workspace" onClick={() => navigate({ to: "/workspace" })} />
      }
      contentClassName="flex-1 px-5 py-6"
    >
      <div className="mx-auto w-full max-w-lg space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
          >
            Could not refresh the review status. Please try again.
          </p>
        )}
        {state && (
          <section className="rounded-2xl border border-border bg-card p-6 text-center">
            {rejected.length ? (
              <CircleAlert className="mx-auto h-10 w-10 text-amber-600" />
            ) : (
              <Clock3 className="mx-auto h-10 w-10 text-primary" />
            )}
            <p className="mt-4 break-words text-sm font-semibold text-muted-foreground">
              {state.business.name}
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold">{title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {incomplete
                ? "Complete the wizard and create your first loyalty card to submit your business."
                : "Your business is not live yet. Business features will become available after approval."}
            </p>
            {rejected.map((submission) => (
              <div
                key={`${submission.entity_type}:${submission.entity_id}`}
                className="mt-4 rounded-xl bg-destructive/5 p-4 text-left"
              >
                <h2 className="text-sm font-semibold text-destructive">
                  {submission.entity_type === "card"
                    ? "Loyalty card needs changes"
                    : "Moderator feedback"}
                </h2>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                  {submission.rejection_reason}
                </p>
              </div>
            ))}
            {own && (
              <>
                <p className="mt-4 text-sm text-muted-foreground">
                  You can update your business details and loyalty card, then submit them for review
                  again.
                </p>
                <Button asChild className="mt-5 w-full">
                  <Link to="/business/onboarding" search={{ businessId }}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {incomplete ? "Finish setup" : "Edit submission"}
                  </Link>
                </Button>
              </>
            )}
          </section>
        )}
        <Button
          variant="outline"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="w-full"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh status
        </Button>
      </div>
    </TabScreen>
  );
}
