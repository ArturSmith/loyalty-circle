import { Link } from "@tanstack/react-router";
import { ChevronRight, CreditCard, MapPin, Store } from "lucide-react";
import { formatDistance, formatLocationAddress, type DiscoverBusiness } from "@/lib/discover";
import { brandTint, normalizeBrandColor } from "@/lib/brand";

/**
 * A business-first discovery tile. The full variant is used in the category
 * grid and the compact variant in Wallet's horizontal recommendation strip.
 * Both open the public business page, where the customer chooses a program.
 *
 * The brand color shows up as a soft decorative circle in the corner instead
 * of a hard accent bar, so the tile reads as a small "storefront card".
 */
export function DiscoverBusinessTile({
  business,
  compact = false,
  className = "",
}: {
  business: DiscoverBusiness;
  compact?: boolean;
  className?: string;
}) {
  const distance = formatDistance(business.distance_km);
  const nearestLocation = business.locations[0] ?? null;
  const locationLabel = nearestLocation
    ? formatLocationAddress(nearestLocation)
    : [business.city, business.country].filter(Boolean).join(", ") || "Location not listed";
  const brandBorder = brandTint(business.brand_color, 0.33);
  const brandColor = normalizeBrandColor(business.brand_color);
  const brandCircle = brandTint(business.brand_color, 0.22);
  const programLabel =
    business.card_count === 1 ? "1 loyalty program" : `${business.card_count} loyalty programs`;

  if (compact) {
    return (
      <Link
        to="/b/$businessId"
        params={{ businessId: business.business_id }}
        className={`group relative block w-[238px] shrink-0 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] ${className}`}
        style={{ borderColor: brandBorder ?? undefined }}
        aria-label={`Open ${business.name}`}
      >
        <span
          className="absolute -right-7 -top-7 h-20 w-20 rounded-full"
          style={{ backgroundColor: brandCircle ?? "color-mix(in oklab, var(--primary) 14%, transparent)" }}
          aria-hidden="true"
        />
        <div className="relative flex items-start gap-3">
          <BusinessLogo business={business} size="compact" />
          <span className="min-w-0 flex-1 pt-0.5">
            <span className="block truncate font-display text-base font-bold">{business.name}</span>
            <span className="mt-1 block w-fit max-w-full truncate rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {business.category?.trim() || "Other"}
            </span>
          </span>
          <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>

        <p className="relative mt-3 line-clamp-1 text-xs text-muted-foreground">
          <MapPin className="mr-1 inline h-3 w-3" aria-hidden="true" />
          {locationLabel}
        </p>
        <div className="relative mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-3 text-[11px] font-medium text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1 text-primary">
            <CreditCard className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{programLabel}</span>
          </span>
          {distance && <span className="shrink-0 text-foreground">{distance}</span>}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/b/$businessId"
      params={{ businessId: business.business_id }}
      className={`group relative block overflow-hidden rounded-2xl border border-border bg-card p-3.5 shadow-[0_4px_20px_-4px_color-mix(in_oklab,var(--foreground)_10%,transparent)] transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] ${className}`}
      aria-label={`Open ${business.name}`}
    >
      {/* Soft brand-colored corner circle — replaces the old hard accent bar */}
      <span
        className="absolute -right-9 -top-9 h-28 w-28 rounded-full"
        style={{ backgroundColor: brandCircle ?? "color-mix(in oklab, var(--primary) 12%, transparent)" }}
        aria-hidden="true"
      />
      <span
        className="absolute right-6 top-6 h-3 w-3 rounded-full"
        style={{ backgroundColor: brandTint(business.brand_color, 0.45) ?? "color-mix(in oklab, var(--primary) 30%, transparent)" }}
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-4">
        <BusinessLogo business={business} size="full" />
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {business.category?.trim() || "Other"}
          </span>
          <span className="mt-1 block truncate font-display text-lg font-bold leading-tight">
            {business.name}
          </span>
          <span className="mt-1.5 block space-y-0.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <CreditCard className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {programLabel}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {distance ? `${distance} · ${locationLabel}` : locationLabel}
              </span>
            </span>
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </Link>
  );
}

function BusinessLogo({
  business,
  size,
}: {
  business: DiscoverBusiness;
  size: "compact" | "full";
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-border bg-background shadow-inner ${
        size === "full" ? "h-16 w-16 rounded-xl" : "h-12 w-12 rounded-xl"
      }`}
      style={{
        borderColor: brandTint(business.brand_color, 0.33) ?? undefined,
        backgroundColor: brandTint(business.brand_color, 0.08) ?? undefined,
      }}
    >
      {business.logo_url ? (
        <img
          src={business.logo_url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <Store
          className={size === "full" ? "h-7 w-7 text-muted-foreground" : "h-5 w-5 text-muted-foreground"}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
