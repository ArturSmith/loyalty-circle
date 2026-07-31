import { Link } from "@tanstack/react-router";
import { MapPin, Store } from "lucide-react";
import { formatDistance, type DiscoverCard } from "@/lib/discover";

export function DiscoverCardTile({
  card,
  compact = false,
  className = "",
}: {
  card: DiscoverCard;
  compact?: boolean;
  className?: string;
}) {
  const distance = formatDistance(card.distance_km);
  return (
    <Link
      to="/b/$businessId"
      params={{ businessId: card.business_id }}
      className={`group block shrink-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      style={{ width: compact ? 190 : 220 }}
      aria-label={`${card.title} by ${card.business_name}`}
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-white/60 p-3 transition-transform group-hover:-translate-y-1"
        style={{
          height: compact ? 116 : 132,
          backgroundColor: card.bg_color,
          color: card.text_color,
        }}
      >
        <div
          className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30"
          style={{ backgroundColor: card.accent_color }}
          aria-hidden
        />
        <div className="relative flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/70">
            {card.business_logo_url ? (
              <img src={card.business_logo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <Store className="h-4 w-4 text-foreground/70" />
            )}
          </div>
          <span className="truncate text-xs font-semibold opacity-80">{card.business_name}</span>
        </div>
        <p className="relative mt-2 line-clamp-2 font-display text-base font-extrabold leading-tight">{card.title}</p>
        <div className="relative mt-auto flex items-center gap-2 pt-2 text-[11px] opacity-75">
          <span className="rounded-full bg-white/50 px-2 py-0.5">{card.total_steps} steps</span>
          {distance ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {distance}
            </span>
          ) : card.city ? (
            <span className="truncate">{card.city}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
