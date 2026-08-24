import { useNavigate } from "@tanstack/react-router";
import { Globe, MapPin, Phone, Sparkles } from "lucide-react";

export type PublicBusinessInfo = {
  id: string;
  name: string;
  logo_url?: string | null;
  category?: string | null;
  description?: string | null;
  welcome_message?: string | null;
  phone?: string | null;
  website?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  region?: string | null;
  country?: string | null;
};

export function formatBusinessAddress(b: PublicBusinessInfo) {
  const line1 = [b.address_line1, b.address_line2].filter(Boolean).join(", ");
  const line2 = [b.postal_code, b.city].filter(Boolean).join(" ");
  const line3 = [b.region, b.country].filter(Boolean).join(", ");
  return [line1, line2, line3].filter(Boolean).join(" · ");
}

export function BusinessInfoPanel({
  business,
  businessId,
}: {
  business: PublicBusinessInfo;
  businessId?: string;
}) {
  const navigate = useNavigate();
  const address = formatBusinessAddress(business);
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${address}`)}`
    : null;

  const isClickable = Boolean(businessId);

  const handleClick = () => {
    if (!businessId) return;
    navigate({ to: "/b/$businessId", params: { businessId } });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!businessId) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      className={`mt-5 rounded-2xl border border-ink/10 bg-secondary p-4 text-left ${
        isClickable ? "cursor-pointer transition-colors hover:bg-muted/60" : ""
      }`}
      aria-label={isClickable ? `Open ${business.name} business page` : undefined}
    >
      <div className="flex items-center gap-3">
        {business.logo_url ? (
          <img src={business.logo_url} alt={`${business.name} logo`} className="h-9 w-9 rounded-full object-cover" />
        ) : null}
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold">{business.name}</p>
          {business.category ? (
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{business.category}</p>
          ) : null}
        </div>
      </div>

      {business.welcome_message ? (
        <p className="mt-3 flex gap-2 text-sm text-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{business.welcome_message}</span>
        </p>
      ) : null}

      {business.description ? (
        <p className="mt-2 text-xs text-muted-foreground">{business.description}</p>
      ) : null}

      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        {address ? (
          <a
            href={mapsUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="flex gap-2 hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{address}</span>
          </a>
        ) : null}
        {business.phone ? (
          <a href={`tel:${business.phone}`} className="flex gap-2 hover:text-foreground" onClick={(e) => e.stopPropagation()}>
            <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{business.phone}</span>
          </a>
        ) : null}
        {business.website ? (
          <a href={business.website} target="_blank" rel="noreferrer" className="flex gap-2 hover:text-foreground" onClick={(e) => e.stopPropagation()}>
            <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{business.website.replace(/^https?:\/\//, "")}</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
