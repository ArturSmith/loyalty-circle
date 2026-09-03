import { useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Compass } from "lucide-react";
import { DiscoverCardTile } from "@/components/DiscoverCardTile";
import { fetchDiscoverCards, useUserLocation, type DiscoverCard } from "@/lib/discover";

export function DiscoverStrip() {
  const { coords, asked } = useUserLocation(true);
  const [cards, setCards] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!asked) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchDiscoverCards({ coords, limit: 20 });
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

  if (!loading && cards.length === 0) return null;

  return (
    <section className="relative pt-2 pb-4" aria-label="Discover loyalty cards">
      <Link to="/discover" className="mx-auto flex max-w-md items-center justify-between gap-2 px-5 md:px-0">
        <h2 className="flex min-w-0 items-center gap-2 font-display text-lg font-bold md:text-base lg:text-lg">
          <Compass className="h-4 w-4 shrink-0" /> {coords ? "Nearby loyalty programs" : "Discover loyalty programs"}
        </h2>
        <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-xs font-semibold text-muted-foreground">
          See all <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </Link>

      <div
        className="mx-auto mt-2 flex max-w-md gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {loading ? (
          <div className="flex h-[116px] w-full items-center justify-center">
            <Spinner size={28} />
          </div>
        ) : (
          cards.map((card) => (
            <DiscoverCardTile key={card.template_id} card={card} compact className="first:ml-5 last:mr-5 md:first:ml-0 md:last:mr-0" />
          ))
        )}
      </div>
    </section>
  );
}
