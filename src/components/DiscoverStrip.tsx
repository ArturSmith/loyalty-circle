import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/Spinner";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Compass } from "lucide-react";
import { DiscoverCardTile } from "@/components/DiscoverCardTile";
import { fetchDiscoverCards, useUserLocation, type DiscoverCard } from "@/lib/discover";

export function DiscoverStrip() {
  const { coords, asked } = useUserLocation(true);
  const [cards, setCards] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

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

  // Gentle auto-scroll that pauses on interaction.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || cards.length < 2) return;
    let paused = false;
    let raf = 0;
    let last = performance.now();
    const pause = () => {
      paused = true;
      window.setTimeout(() => {
        paused = false;
      }, 4000);
    };
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      if (!paused && el.scrollWidth > el.clientWidth + 4) {
        const next = el.scrollLeft + (dt / 1000) * 18;
        el.scrollLeft = next >= el.scrollWidth - el.clientWidth - 1 ? 0 : next;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    el.addEventListener("pointerdown", pause);
    el.addEventListener("wheel", pause, { passive: true });
    el.addEventListener("touchstart", pause, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("wheel", pause);
      el.removeEventListener("touchstart", pause);
    };
  }, [cards.length]);

  if (!loading && cards.length === 0) return null;

  return (
    <section className="relative pt-2 pb-4" aria-label="Discover nearby loyalty cards">
      <Link to="/discover" className="mx-auto flex max-w-md items-center justify-between gap-2 px-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Compass className="h-4 w-4" /> {coords ? "Nearby loyalty programs" : "Discover loyalty programs"}
        </h2>
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground">
          See all <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </Link>

      <div
        ref={scrollerRef}
        className="mx-auto mt-2 flex max-w-md gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {loading ? (
          <div className="flex h-[116px] w-full items-center justify-center">
            <Spinner size={28} />
          </div>
        ) : (
          cards.map((card) => (
            <DiscoverCardTile key={card.template_id} card={card} compact className="first:ml-5 last:mr-5" />
          ))
        )}
      </div>
    </section>
  );
}
