import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { DiscoverBusinessTile } from "@/components/DiscoverBusinessTile";
import { PageLoader } from "@/components/Spinner";
import { TabScreen } from "@/components/TabScreen";
import { Button } from "@/components/ui/button";
import { getTabCache } from "@/lib/tabCache";
import {
  fetchDiscoverBusinesses,
  useUserLocation,
  type DiscoverBusiness,
} from "@/lib/discover";

const DISCOVER_CACHE_KEY = "discover_businesses";

export const Route = createFileRoute("/discover_/category/$category")({
  head: () => ({ meta: [{ title: "Discover category — ClubCarder" }] }),
  component: DiscoverCategory,
});

function normalizedCategory(value: string | null | undefined) {
  return value?.trim() || "Other";
}

function inCategory(business: DiscoverBusiness, category: string) {
  return normalizedCategory(business.category).localeCompare(category, undefined, {
    sensitivity: "accent",
  }) === 0;
}

function DiscoverCategory() {
  const { category: categoryParam } = Route.useParams();
  const navigate = useNavigate();
  const category = normalizedCategory(categoryParam);
  const cachedBusinesses = getTabCache<DiscoverBusiness[]>(DISCOVER_CACHE_KEY);
  const [businesses, setBusinesses] = useState<DiscoverBusiness[]>(() =>
    (cachedBusinesses ?? []).filter((business) => inCategory(business, category)),
  );
  const [loading, setLoading] = useState(cachedBusinesses === null);
  const [failed, setFailed] = useState(false);
  const { coords, asked, status, request } = useUserLocation(true);

  useEffect(() => {
    if (!asked) return;
    let cancelled = false;
    setFailed(false);
    if (businesses.length === 0) setLoading(true);

    void fetchDiscoverBusinesses({
      coords,
      query: category === "Other" ? undefined : category,
      limit: 200,
    })
      .then((result) => {
        if (cancelled) return;
        setBusinesses(result.filter((business) => inCategory(business, category)));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // The current list is deliberately excluded: it only decides whether the
    // existing cached content stays visible while this request refreshes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, category, coords]);

  const locationMessage = useMemo(() => {
    if (status === "denied") {
      return "Location is blocked. Allow it in your browser or device settings to sort by what's closest.";
    }
    if (status === "unavailable") {
      return "Couldn't get your location. Check your connection and try again.";
    }
    return "Share your location to sort businesses by what's closest.";
  }, [status]);

  return (
    <TabScreen
      title={category}
      backAction={
        <BackButton
          label="Back to Discover"
          onClick={() => navigate({ to: "/discover" })}
        />
      }
    >
      {!coords && asked ? (
        <div className="mx-auto mt-4 max-w-6xl px-5 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border glass-panel px-4 py-3">
            <p className="text-sm text-muted-foreground">{locationMessage}</p>
            {status !== "denied" ? (
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0 gap-2"
                onClick={request}
                disabled={status === "pending"}
              >
                <MapPin className="h-4 w-4" />
                {status === "pending" ? "Locating…" : "Share location"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <PageLoader />
      ) : businesses.length > 0 ? (
        <div className="mx-auto mt-6 grid max-w-6xl gap-4 px-5 sm:grid-cols-2 lg:grid-cols-3 md:px-8">
          {businesses.map((business) => (
            <DiscoverBusinessTile key={business.business_id} business={business} />
          ))}
        </div>
      ) : (
        <div className="mx-auto mt-20 max-w-md px-6 text-center">
          <h2 className="font-display text-2xl font-extrabold">
            {failed ? "Businesses couldn’t be loaded" : "No businesses found"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {failed ? "Please try again later." : "There are no public businesses in this category yet."}
          </p>
        </div>
      )}
    </TabScreen>
  );
}
