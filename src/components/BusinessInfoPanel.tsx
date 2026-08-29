import { Link } from "@tanstack/react-router";
import { ExternalLink, Globe, MapPin, Phone, Sparkles } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
  const address = formatBusinessAddress(business);
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${address}`)}`
    : null;

  return (
    <Accordion type="single" collapsible className="mt-5 rounded-2xl border border-ink/10 bg-secondary text-left">
      <AccordionItem value="business-info" className="border-0">
        <AccordionTrigger className="gap-3 px-4 py-4 hover:no-underline">
          <span className="flex min-w-0 items-center gap-3">
            {business.logo_url ? (
              <img src={business.logo_url} alt={`${business.name} logo`} className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : null}
            <span className="min-w-0">
              <span className="block truncate font-display text-base font-bold">{business.name}</span>
              {business.category ? (
                <span className="block text-xs uppercase tracking-widest text-muted-foreground">{business.category}</span>
              ) : null}
            </span>
          </span>
        </AccordionTrigger>

        <AccordionContent className="px-4">
          {business.welcome_message ? (
            <p className="flex gap-2 text-sm text-foreground">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{business.welcome_message}</span>
            </p>
          ) : null}

          {business.description ? (
            <p className="mt-2 text-xs text-muted-foreground">{business.description}</p>
          ) : null}

          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            {address ? (
              <a href={mapsUrl ?? undefined} target="_blank" rel="noreferrer" className="flex gap-2 hover:text-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{address}</span>
              </a>
            ) : null}
            {business.phone ? (
              <a href={`tel:${business.phone}`} className="flex gap-2 hover:text-foreground">
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{business.phone}</span>
              </a>
            ) : null}
            {business.website ? (
              <a href={business.website} target="_blank" rel="noreferrer" className="flex gap-2 hover:text-foreground">
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{business.website.replace(/^https?:\/\//, "")}</span>
              </a>
            ) : null}
          </div>

          {businessId ? (
            <Link
              to="/b/$businessId"
              params={{ businessId }}
              className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-ink/10 bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              View business profile
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
