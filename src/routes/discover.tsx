import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Compass, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DiscoverCardTile } from "@/components/DiscoverCardTile";
import { fetchDiscoverCards, groupByCategory, useUserLocation, type DiscoverCard } from "@/lib/discover";

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

function Discover() {
  const { coords, asked, request } = useUserLocation(true);
  const [cards, setCards] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!asked) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const rows = await fetchDiscoverCards({ coords, limit: 300 });
        if (!cancelled) setCards(rows);
      } catch {
        if (!cancelled) setCards([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
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

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <main className="min-h-screen pb-16">
      <header className="sticky top-0 z-20 glass-panel border-b border-white/50 px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link to="/wallet" aria-label="Back to my cards">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <Compass className="h-5 w-5" /> Discover
          </h1>
        </div>
        <div className="mx-auto mt-3 max-w-3xl">
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
      </header>

      {!coords && asked && (
        <div className="mx-auto mt-4 flex max-w-3xl items-center justify-between gap-3 rounded-2xl glass-panel border border-white/60 px-4 py-3 md:px-5">
          <p className="text-sm text-muted-foreground">Share your location to sort cards by what's closest.</p>
          <Button size="sm" variant="secondary" className="gap-2 shrink-0" onClick={request}>
            <MapPin className="h-4 w-4" /> Use location
          </Button>
        </div>
      )}

      {loading ? (
        <div className="mx-auto mt-8 max-w-3xl space-y-6 px-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[150px] animate-pulse rounded-2xl bg-white/50" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="mx-auto mt-20 max-w-md px-6 text-center">
          <h2 className="font-display text-2xl font-extrabold">Nothing found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {query ? "Try a different search term." : "No loyalty cards are published yet — check back soon."}
          </p>
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-3xl space-y-8">
          {groups.map((group) => (
            <section key={group.category} aria-label={group.category}>
              <h2 className="px-5 font-display text-lg font-bold">{group.category}</h2>
              <div className="mt-2 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {group.cards.map((card) => (
                  <DiscoverCardTile key={card.template_id} card={card} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
