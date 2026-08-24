import { Link } from "@tanstack/react-router";
import { ChevronRight, MapPin, Store } from "lucide-react";
import {
  formatDistance,
  formatLocationAddress,
  type DiscoverBusiness,
  type DiscoverLocation,
} from "@/lib/discover";
import { brandTint } from "@/lib/brand";

/**
 * A business in the Discover feed, with the places you can actually visit.
 *
 * Locations are the point of this tile: a chain with six cafés was previously
 * indistinguishable from a single shop, because Discover only listed card
 * designs. Each location links to the business page so tapping one gets you
 * the full detail rather than a dead row.
 */
export function DiscoverBusinessTile({
  business,
  className = "",
}: {
  business: DiscoverBusiness;
  className?: string;
}) {
  // Long lists of branches would crowd the feed; the rest are one tap away.
  const MAX_VISIBLE = 3;
  const visible = business.locations.slice(0, MAX_VISIBLE);
  const hidden = business.locations.length - visible.length;
  const distance = formatDistance(business.distance_km);
  // Appending "55" for alpha only worked for six-digit hex; anything else
  // produced an invalid colour that silently dropped the border.
  const brandBorder = brandTint(business.brand_color, 0.33);

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-border bg-card ${className}`}
    >
      <Link
        to="/b/$businessId"
        params={{ businessId: business.business_id }}
        className="flex items-center gap-3 p-4 hover:bg-muted/40"
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40"
          style={brandBorder ? { borderColor: brandBorder } : undefined}
        >
          {business.logo_url ? (
            <img
              src={business.logo_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Store className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-bold">{business.name}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {[
              business.category,
              business.card_count === 1 ? "1 card" : `${business.card_count} cards`,
              distance,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>

        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      {visible.length > 0 && (
        <ul className="border-t border-border">
          {visible.map((loc) => (
            <LocationRow key={loc.id} businessId={business.business_id} location={loc} />
          ))}
          {hidden > 0 && (
            <li>
              <Link
                to="/b/$businessId"
                params={{ businessId: business.business_id }}
                className="block px-4 py-2.5 text-xs font-medium text-primary hover:bg-muted/40"
              >
                +{hidden} more {hidden === 1 ? "location" : "locations"}
              </Link>
            </li>
          )}
        </ul>
      )}
    </article>
  );
}

function LocationRow({
  businessId,
  location,
}: {
  businessId: string;
  location: DiscoverLocation;
}) {
  const distance = formatDistance(location.distance_km);

  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to="/b/$businessId"
        params={{ businessId }}
        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40"
      >
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          {location.name && (
            <span className="block truncate text-sm font-medium">{location.name}</span>
          )}
          <span className="block truncate text-xs text-muted-foreground">
            {formatLocationAddress(location)}
          </span>
        </span>
        {distance && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{distance}</span>
        )}
      </Link>
    </li>
  );
}
