import { Link } from "@tanstack/react-router";
import { ChevronRight, CreditCard, MapPin, Store } from "lucide-react";
import { formatDistance, formatLocationAddress, type DiscoverBusiness } from "@/lib/discover";
import { brandTint, normalizeBrandColor } from "@/lib/brand";

/**
 * A business-first discovery tile. The full variant is used in the category
 * grid and the compact variant in Wallet's horizontal recommendation strip.
 * Both open the public business page, where the customer chooses a program.
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
  const programLabel =
    business.card_count === 1 ? "1 loyalty program" : `${business.card_count} loyalty programs`;

  if (compact) {
    return (
      <Link
        to="/b/$businessId"
        params={{ businessId: business.business_id }}
        className={`group relative block w-[238px] shrink-0 overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
        style={{ borderColor: brandBorder ?? undefined }}
        aria-label={`Open ${business.name}`}
      >
        <span
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: brandColor ?? "var(--primary)" }}
          aria-hidden="true"
        />
        <div className="flex items-start gap-3">
          <BusinessLogo business={business} size="compact" />
          <span className="min-w-0 flex-1 pt-0.5">
            <span className="block truncate font-display text-base font-bold">{business.name}</span>
            <span className="mt-1 block w-fit max-w-full truncate rounded-full bg-background/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {business.category?.trim() || "Other"}
            </span>
          </span>
          <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>

        <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">
          <MapPin className="mr-1 inline h-3 w-3" aria-hidden="true" />
          {locationLabel}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-3 text-[11px] font-medium text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1">
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
      className={`group relative block overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
      style={{ borderColor: brandBorder ?? undefined }}
      aria-label={`Open ${business.name}`}
    >
      <span
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundColor: brandColor ?? "var(--primary)" }}
        aria-hidden="true"
      />
      <div className="flex items-start gap-4">
        <BusinessLogo business={business} size="full" />
        <span className="min-w-0 flex-1">
          <span className="inline-flex max-w-full rounded-full bg-background/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="truncate">{business.category?.trim() || "Other"}</span>
          </span>
          <span className="mt-1.5 block truncate font-display text-xl font-bold">{business.name}</span>
          {business.description && (
            <span className="mt-1 block line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {business.description}
            </span>
          )}
        </span>
        <ChevronRight className="mt-5 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-foreground">
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
          {programLabel}
        </span>
        {business.location_count > 0 && (
          <span className="rounded-full bg-background/80 px-3 py-1.5 text-muted-foreground">
            {business.location_count} {business.location_count === 1 ? "location" : "locations"}
          </span>
        )}
        {distance && (
          <span className="rounded-full bg-background/80 px-3 py-1.5 text-muted-foreground">
            {distance} away
          </span>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="line-clamp-1">{locationLabel}</span>
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
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-border bg-background shadow-sm ${
        size === "full" ? "h-16 w-16 rounded-2xl" : "h-12 w-12 rounded-xl"
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
          className={size === "full" ? "h-6 w-6 text-muted-foreground" : "h-5 w-5 text-muted-foreground"}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
