import { getTabCache, setTabCache } from "@/lib/tabCache";
import { PageLoader } from "@/components/Spinner";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TabScreen } from "@/components/TabScreen";
import { DiscoverCardTile } from "@/components/DiscoverCardTile";
import { DiscoverBusinessTile } from "@/components/DiscoverBusinessTile";
import {
  fetchDiscoverCards,
  fetchDiscoverBusinesses,
  groupByCategory,
  useUserLocation,
  type DiscoverBusiness,
  type DiscoverCard,
} from "@/lib/discover";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover loyalty cards near you — ClubCarder" },
      {
        name: "description",
        content:
          "Browse loyalty cards from nearby cafés, salons and shops. Search by business name or card and add them to your ClubCarder wallet.",
      },
      { property: "og:title", content: "Discover loyalty cards near you — ClubCarder" },
      {
        property: "og:description",
        content: "Browse nearby loyalty programs by category and add them to your wallet in one tap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Discover,
});

// Survives tab switches so coming back to Discover shows the previous results
// immediately while a fresh fetch runs in the background.
const CACHE_KEY = "discover";
const BIZ_CACHE_KEY = "discover_businesses";

function Discover() {
  const { coords, asked, status, request } = useUserLocation(true);
  const [cards, setCards] = useState<DiscoverCard[]>(() => getTabCache<DiscoverCard[]>(CACHE_KEY) ?? []);
  const [businesses, setBusinesses] = useState<DiscoverBusiness[]>(
    () => getTabCache<DiscoverBusiness[]>(BIZ_CACHE_KEY) ?? [],
  );
  const [loading, setLoading] = useState(() => getTabCache<DiscoverCard[]>(CACHE_KEY) === null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!asked) return;
    let cancelled = false;
    if (getTabCache<DiscoverCard[]>(CACHE_KEY) === null) setLoading(true);
    (async () => {
      // Fetched together, but settled independently: a failure in one list
      // should not blank the other.
      const [cardRes, bizRes] = await Promise.allSettled([
        fetchDiscoverCards({ coords, limit: 300 }),
        fetchDiscoverBusinesses({ coords, limit: 100 }),
      ]);
      if (cancelled) return;
      if (cardRes.status === "fulfilled") {
        setTabCache<DiscoverCard[]>(CACHE_KEY, cardRes.value);
        setCards(cardRes.value);
      } else if (getTabCache<DiscoverCard[]>(CACHE_KEY) === null) {
        setCards([]);
      }
      if (bizRes.status === "fulfilled") {
        setTabCache<DiscoverBusiness[]>(BIZ_CACHE_KEY, bizRes.value);
        setBusinesses(bizRes.value);
      } else if (getTabCache<DiscoverBusiness[]>(BIZ_CACHE_KEY) === null) {
        setBusinesses([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [asked, coords]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) =>
      [card.business_name, card.title, card.subtitle, card.description, card.category, card.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [cards, query]);

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

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);
  const nothingFound = groups.length === 0 && filteredBusinesses.length === 0;

  return (
    <TabScreen title="Discover">
      <div className="mx-auto mt-4 max-w-3xl px-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business, card or category"
            aria-label="Search loyalty cards"
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
                  : "Share your location to sort cards by what's closest."}
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
            {query ? "Try a different search term." : "No loyalty cards are published yet — check back soon."}
          </p>
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-3xl space-y-8">
          {filteredBusinesses.length > 0 && (
            <section aria-label="Businesses">
              <h2 className="px-5 font-display text-lg font-bold">Businesses near you</h2>
              <p className="mt-0.5 px-5 text-xs text-muted-foreground">
                Tap a location for opening details and their cards.
              </p>
              <div className="mt-3 space-y-3 px-5">
                {filteredBusinesses.map((business) => (
                  <DiscoverBusinessTile key={business.business_id} business={business} />
                ))}
              </div>
            </section>
          )}

          {groups.map((group) => (
            <section key={group.category} aria-label={group.category}>
              <h2 className="px-5 font-display text-lg font-bold">{group.category}</h2>
              <div className="mt-2 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {group.cards.map((card) => (
                  <DiscoverCardTile key={card.template_id} card={card} className="first:ml-5 last:mr-5" />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </TabScreen>
  );
}
