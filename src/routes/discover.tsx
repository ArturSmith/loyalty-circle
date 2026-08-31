import { getTabCache, setTabCache } from "@/lib/tabCache";
import { PageLoader } from "@/components/Spinner";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapPin, ScanLine, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TabScreen } from "@/components/TabScreen";
import { DiscoverBusinessTile } from "@/components/DiscoverBusinessTile";
import {
  fetchDiscoverBusinesses,
  groupBusinessesByCategory,
  useUserLocation,
  type DiscoverBusiness,
} from "@/lib/discover";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover businesses near you — ClubCarder" },
      {
        name: "description",
        content:
          "Browse nearby cafés, salons, shops and other businesses with loyalty programs on ClubCarder.",
      },
      { property: "og:title", content: "Discover businesses near you — ClubCarder" },
      {
        property: "og:description",
        content: "Browse nearby businesses with loyalty programs, organised by category.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Discover,
});

// Survives tab switches so coming back to Discover shows the previous results
// immediately while a fresh fetch runs in the background.
const CACHE_KEY = "discover_businesses";

function Discover() {
  const { coords, asked, status, request } = useUserLocation(true);
  const [businesses, setBusinesses] = useState<DiscoverBusiness[]>(
    () => getTabCache<DiscoverBusiness[]>(CACHE_KEY) ?? [],
  );
  const [loading, setLoading] = useState(() => getTabCache<DiscoverBusiness[]>(CACHE_KEY) === null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!asked) return;
    let cancelled = false;
    if (getTabCache<DiscoverBusiness[]>(CACHE_KEY) === null) setLoading(true);
    (async () => {
      const result = await fetchDiscoverBusinesses({ coords, limit: 200 }).catch(() => null);
      if (cancelled) return;
      if (result) {
        setTabCache<DiscoverBusiness[]>(CACHE_KEY, result);
        setBusinesses(result);
      } else if (getTabCache<DiscoverBusiness[]>(CACHE_KEY) === null) {
        setBusinesses([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [asked, coords]);

  const filteredBusinesses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((b) =>
      [
        b.name,
        b.category,
        b.city,
        b.description,
        ...b.locations.flatMap((l) => [l.name, l.city, l.address_line1]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [businesses, query]);

  const groups = useMemo(
    () => groupBusinessesByCategory(filteredBusinesses),
    [filteredBusinesses],
  );
  const nothingFound = groups.length === 0;

  return (
    <TabScreen
      title="Discover"
      action={
        <Button asChild variant="ghost" size="icon" className="rounded-full glass-panel">
          <Link to="/scan" aria-label="Scan QR code" title="Scan QR">
            <ScanLine className="h-5 w-5" />
          </Link>
        </Button>
      }
    >
      <div className="mx-auto mt-4 max-w-3xl px-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business, category or location"
            aria-label="Search businesses"
            className="pl-9"
          />
        </div>
      </div>


      {!coords && asked && (
        <div className="mx-auto mt-4 max-w-3xl px-5">
          <div className="flex items-center justify-between gap-3 rounded-2xl glass-panel border border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {status === "denied"
                ? "Location is blocked. Allow it in your browser or device settings to sort by what's closest."
                : status === "unavailable"
                  ? "Couldn't get your location. Check your connection and try again."
                  : "Share your location to sort businesses by what's closest."}
            </p>
            {status !== "denied" && (
              <Button
                size="sm"
                variant="secondary"
                className="gap-2 shrink-0"
                onClick={request}
                disabled={status === "pending"}
              >
                <MapPin className="h-4 w-4" />
                {status === "pending" ? "Locating…" : "Share location"}
              </Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <PageLoader />
      ) : nothingFound ? (
        <div className="mx-auto mt-20 max-w-md px-6 text-center">
          <h2 className="font-display text-2xl font-extrabold">Nothing found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {query ? "Try a different search term." : "No businesses are published yet — check back soon."}
          </p>
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-3xl space-y-8">
          {groups.map((group) => (
            <section key={group.category} aria-label={group.category}>
              <div className="flex items-end justify-between gap-3 px-5">
                <h2 className="font-display text-xl font-bold">{group.category}</h2>
                <span className="text-xs text-muted-foreground">
                  {group.businesses.length} {group.businesses.length === 1 ? "business" : "businesses"}
                </span>
              </div>
              <div className="mt-3 grid gap-4 px-5 sm:grid-cols-2">
                {group.businesses.map((business) => (
                  <DiscoverBusinessTile key={business.business_id} business={business} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </TabScreen>
  );
}
