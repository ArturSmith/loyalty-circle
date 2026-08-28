import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ScreenLoader } from "@/components/Spinner";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { StampCard } from "@/components/StampCard";
import type { CardShape, Reward, StampIconName } from "@/components/StampCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Globe, Link2 as LinkIcon, MapPin, Phone } from "lucide-react";
import { brandTint, isDarkBrandColor, normalizeBrandColor } from "@/lib/brand";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { useServerFn } from "@tanstack/react-start";
import { claimCardToWallet } from "@/utils/cards.functions";
import { isGoogleWalletEnabled, isAppleWalletEnabled } from "@/utils/wallet.functions";
import { GoogleWalletButton } from "@/components/GoogleWalletButton";
import { WalletChooser } from "@/components/WalletChooser";
import { Checkbox } from "@/components/ui/checkbox";

type Template = {
  id: string; business_id: string; title: string; subtitle: string | null; description: string | null;
  corner_title: string | null;
  total_steps: number; shape: CardShape;
  bg_color: string; accent_color: string; text_color: string;
  stamp_icon: StampIconName; logo_url: string | null; rewards: Reward[]; active: boolean; grid_cols: number | null;
  terms_and_conditions: string; terms_version: number;
};

type BusinessLocation = {
  id: string;
  name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  region: string | null;
  country: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
};

type BusinessSocial = { platform: string; url: string };

/**
 * Everything get_business_public() already returned. The page previously kept
 * only four of these fields and discarded the rest, so a business could fill in
 * a description, phone and website that no visitor ever saw.
 */
type PublicBusiness = {
  id: string;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  category: string | null;
  description: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  region: string | null;
  country: string | null;
};

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createPublicFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createPublicSupabaseClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing backend configuration");
  }

  return createClient<Database>(supabaseUrl, supabaseKey, {
    global: { fetch: createPublicFetch(supabaseKey) },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

const publicSupabase = createPublicSupabaseClient();

export const Route = createFileRoute("/b/$businessId")({
  head: () => ({ meta: [{ title: "Claim your card — ClubCarder" }] }),
  component: BusinessPublic,
});

function BusinessPublic() {
  const { businessId } = Route.useParams();
  const navigate = useNavigate();
  const claimCard = useServerFn(claimCardToWallet);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownedTemplateIds, setOwnedTemplateIds] = useState<Map<string, string>>(new Map());
  const [flippedTemplateId, setFlippedTemplateId] = useState<string | null>(null);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [socials, setSocials] = useState<BusinessSocial[]>([]);
  const walletEnabled = useServerFn(isGoogleWalletEnabled);
  const appleWalletEnabled = useServerFn(isAppleWalletEnabled);
  const [googleWalletReady, setGoogleWalletReady] = useState(false);
  const [appleWalletReady, setAppleWalletReady] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState<Set<string>>(new Set());
  const [cardsLoadError, setCardsLoadError] = useState(false);

  useEffect(() => {
    walletEnabled({}).then((r) => setGoogleWalletReady(r.enabled)).catch(() => setGoogleWalletReady(false));
    appleWalletEnabled({}).then((r) => setAppleWalletReady(r.enabled)).catch(() => setAppleWalletReady(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: t, error: cardsError }, { data: b }, { data: u }, { data: detail }] = await Promise.all([
        publicSupabase.rpc("get_business_cards_public", { _id: businessId }),
        publicSupabase.rpc("get_business_public", { _id: businessId }),
        supabase.auth.getUser(),
        // Cast until Supabase types are regenerated with the new RPC.
        (publicSupabase.rpc as any)("get_business_detail_public", { _id: businessId }),
      ]);
      setCardsLoadError(Boolean(cardsError));
      if (cardsError) console.error("Could not load public business cards", cardsError);
      setTemplates((t as Template[] | null) ?? []);
      const d = (detail ?? {}) as { locations?: BusinessLocation[]; socials?: BusinessSocial[] };
      setLocations(Array.isArray(d.locations) ? d.locations : []);
      setSocials(Array.isArray(d.socials) ? d.socials : []);
      const brow = Array.isArray(b) ? b[0] : null;
      if (brow) setBusiness(brow as PublicBusiness);
      const uid = u.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: owned } = await supabase
          .from("card_instances")
          .select("id, template_id")
          .eq("customer_id", uid);
        const m = new Map<string, string>();
        (owned ?? []).forEach((r: { id: string; template_id: string }) => m.set(r.template_id, r.id));
        setOwnedTemplateIds(m);
      }
      setLoading(false);
    })();
  }, [businessId]);


  const claim = async (templateId: string, acceptedTermsVersion: number) => {
    if (!userId) {
      try { sessionStorage.setItem(`pending_claim:${businessId}`, templateId); } catch {}
      try { sessionStorage.setItem(`pending_claim_terms:${businessId}`, String(acceptedTermsVersion)); } catch {}
      navigate({ to: "/auth", search: { redirect: `/b/${businessId}` } });
      return;
    }
    setClaiming(templateId);
    try {
      const result = await claimCard({ data: { templateId, acceptedTermsVersion } });
      setOwnedTemplateIds((prev) => {
        const next = new Map(prev);
        next.set(templateId, result.instanceId);
        return next;
      });
      try { sessionStorage.setItem("open_card_id", result.instanceId); } catch {}
      toast.success(result.alreadyOwned ? "Card is already in your wallet" : "Card added to your wallet");
      navigate({ to: "/wallet" });
    } catch (error) {
      toast.error("Couldn't add card", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setClaiming(null);
    }
  };

  // Auto-claim after signing in via redirect back
  useEffect(() => {
    if (!userId || loading || templates.length === 0) return;
    let pending: string | null = null;
    let acceptedVersion: number | null = null;
    try { pending = sessionStorage.getItem(`pending_claim:${businessId}`); } catch {}
    try {
      const raw = sessionStorage.getItem(`pending_claim_terms:${businessId}`);
      acceptedVersion = raw ? Number(raw) : null;
    } catch {}
    if (!pending) return;
    try { sessionStorage.removeItem(`pending_claim:${businessId}`); } catch {}
    try { sessionStorage.removeItem(`pending_claim_terms:${businessId}`); } catch {}
    if (ownedTemplateIds.has(pending)) { navigate({ to: "/wallet" }); return; }
    const template = templates.find((t) => t.id === pending);
    if (template && acceptedVersion === template.terms_version) {
      claim(pending, acceptedVersion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loading, templates, businessId]);


  if (loading) return <ScreenLoader />;

  if (!business) {
    return (
      <div className="min-h-screen px-4 py-16">
        <div className="mx-auto max-w-md rounded-2xl border-2 border-ink/10 bg-card p-8 text-center card-shadow">
          <h1 className="font-display text-2xl font-semibold">Business unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This business is not currently published. It may still be awaiting platform review.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/discover">Browse loyalty programs</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Older businesses store a single address on the row itself rather than in
  // business_locations, so fall back to it when no locations were added.
  const fallbackAddress = [
    business?.address_line1,
    business?.address_line2,
    business?.postal_code,
    business?.city,
    business?.region,
    business?.country,
  ]
    .filter(Boolean)
    .join(", ");

  // Validated once here so the raw column value never reaches a style prop.
  const brand = normalizeBrandColor(business?.brand_color);

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-md">
        <Button variant="ghost" className="mb-3 -ml-2 gap-2 text-muted-foreground" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>

        {/* The header renders regardless of cards: a business with none is
            still a real place someone may have scanned a QR code to reach.
            Only the top corners are rounded and there is no bottom edge, so
            the brand tint fades out into the page instead of ending in a line. */}
        <div
          className="rounded-t-3xl px-5 pb-10 pt-6 text-center"
          style={
            brand
              ? {
                  background: `linear-gradient(180deg, ${brandTint(brand, 0.18)} 0%, ${brandTint(brand, 0.06)} 45%, transparent 100%)`,
                }
              : undefined
          }
        >
          {business?.logo_url ? (
            <img
              src={business.logo_url}
              alt={`${business.name} logo`}
              className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-offset-2 ring-offset-background"
              style={{ ["--tw-ring-color" as string]: brand ?? "transparent" }}
            />
          ) : null}
          <h1 className="mt-4 font-display text-3xl font-semibold">{business?.name ?? "Loyalty cards"}</h1>
          {business?.category && (
            <p
              className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium uppercase tracking-widest"
              style={
                brand
                  ? { backgroundColor: brand, color: isDarkBrandColor(brand) ? "#fff" : "#111" }
                  : undefined
              }
            >
              {business.category}
            </p>
          )}
          {business?.description && (
            <p className="mx-auto mt-3 max-w-prose text-sm text-muted-foreground">
              {business.description}
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {cardsLoadError
              ? "Loyalty cards could not be loaded. Please try again shortly."
              : templates.length === 0
              ? "No loyalty cards available right now."
              : "Choose a loyalty card to add to your wallet."}
          </p>
          <OrnamentDivider className="w-40 mx-auto my-6 opacity-60" />
        </div>

        {templates.length > 0 && (
          <div className="space-y-6">
              {templates.map((t, i) => {
                const ownedInstanceId = ownedTemplateIds.get(t.id);
                const termsKey = `${t.id}:${t.terms_version}`;
                const hasAcceptedTerms = acceptedTerms.has(termsKey);
                const handleCardClick = () => {
                  // Signed-out visitors pick a wallet from the options below the
                  // card, so tapping the card itself must not hijack them into
                  // the sign-in flow.
                  if (!userId) return;
                  if (ownedInstanceId) {
                    try { sessionStorage.setItem("open_card_id", ownedInstanceId); } catch {}
                    navigate({ to: "/wallet" });
                    return;
                  }
                  if (!hasAcceptedTerms) {
                    toast.info("Accept the card terms before adding it");
                    return;
                  }
                  claim(t.id, t.terms_version);
                };
                return (
                <motion.div key={t.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <div
                    role={userId ? "button" : undefined}
                    tabIndex={userId ? 0 : undefined}
                    onClick={handleCardClick}
                    onKeyDown={(event) => {
                      if (!userId) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleCardClick();
                      }
                    }}
                    className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
                    aria-label={userId ? (ownedInstanceId ? `Open ${t.title} in your wallet` : `Add ${t.title} to your wallet`) : undefined}
                  >
                    <StampCard
                      title={t.title}
                      subtitle={t.subtitle}
                      cornerTitle={t.corner_title}
                      totalSteps={t.total_steps}
                      stampsCount={0}
                      shape={t.shape}
                      gridCols={t.grid_cols}
                      bgColor={t.bg_color}
                      accentColor={t.accent_color}
                      textColor={t.text_color}
                      stampIcon={t.stamp_icon}
                      logoUrl={t.logo_url}
                      rewards={t.rewards}
                      face={flippedTemplateId === t.id ? "stamps" : "info"}
                      showFlipButton
                      onFlip={() => setFlippedTemplateId((prev) => prev === t.id ? null : t.id)}
                    />
                  </div>
                  <section className="mt-3 rounded-2xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold">Terms &amp; conditions</h3>
                    <div className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {t.terms_and_conditions}
                    </div>
                    {!ownedInstanceId && (
                      <label className="mt-3 flex cursor-pointer items-start gap-3 border-t border-border pt-3 text-sm">
                        <Checkbox
                          checked={hasAcceptedTerms}
                          onCheckedChange={(checked) => {
                            setAcceptedTerms((previous) => {
                              const next = new Set(previous);
                              if (checked === true) next.add(termsKey);
                              else next.delete(termsKey);
                              return next;
                            });
                          }}
                          aria-label={`Accept terms for ${t.title}`}
                        />
                        <span>I have read and accept these terms and conditions.</span>
                      </label>
                    )}
                  </section>
                  {userId ? (
                    <>
                      <Button
                        className="mt-3 w-full h-11"
                        disabled={claiming === t.id || (!ownedInstanceId && !hasAcceptedTerms)}
                        onClick={handleCardClick}
                      >
                        {claiming === t.id
                          ? "Adding…"
                          : ownedInstanceId
                          ? "Open in my wallet"
                          : "Add to my wallet"}
                      </Button>
                      {googleWalletReady && !ownedInstanceId ? (
                        <>
                          <GoogleWalletButton
                            templateId={t.id}
                            acceptedTermsVersion={hasAcceptedTerms ? t.terms_version : null}
                            className="mt-2"
                          />
                          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                            No account needed — the pass goes straight to your phone.
                          </p>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <WalletChooser
                      templateId={t.id}
                      cardTitle={t.title}
                      googleReady={googleWalletReady}
                      appleReady={appleWalletReady}
                      acceptedTermsVersion={hasAcceptedTerms ? t.terms_version : null}
                      onUseInAppWallet={() => {
                        try { sessionStorage.setItem(`pending_claim:${businessId}`, t.id); } catch {}
                        try { sessionStorage.setItem(`pending_claim_terms:${businessId}`, String(t.terms_version)); } catch {}
                        navigate({ to: "/auth", search: { redirect: `/b/${businessId}` } });
                      }}
                    />
                  )}
                </motion.div>
                );
              })}
            </div>
        )}

        {locations.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">
              {locations.length === 1 ? "Where to find us" : "Our locations"}
            </h2>
            <ul className="mt-3 space-y-2">
              {locations.map((loc) => {
                const address = [loc.address_line1, loc.postal_code, loc.city, loc.country]
                  .filter(Boolean)
                  .join(", ");
                // Let the OS pick the maps app rather than assuming Google.
                const mapsHref = loc.latitude != null && loc.longitude != null
                  ? `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`
                  : address
                    ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
                    : null;
                return (
                  <li
                    key={loc.id}
                    className="rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {loc.name || "Location"}
                          {loc.is_primary && locations.length > 1 && (
                            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                              Main
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {address || "Address not listed"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          {loc.phone && (
                            <a href={`tel:${loc.phone}`} className="font-medium text-primary">
                              {loc.phone}
                            </a>
                          )}
                          {mapsHref && (
                            <a
                              href={mapsHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary"
                            >
                              Directions
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {locations.length === 0 && fallbackAddress && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">Where to find us</h2>
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{fallbackAddress}</p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(fallbackAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-primary"
                >
                  Directions
                </a>
              </div>
            </div>
          </section>
        )}

        {(business?.phone || business?.website) && (
          <section className="mt-8">
            <h2 className="font-display text-xl font-bold">Contact</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {business?.phone && (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <a href={`tel:${business.phone}`} className="font-medium text-primary">
                    {business.phone}
                  </a>
                </li>
              )}
              {business?.website && (
                <li className="flex items-center gap-2">
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <a
                    href={business.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="truncate font-medium text-primary"
                  >
                    {business.website.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              )}
            </ul>
          </section>
        )}

        {socials.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl font-bold">Follow us</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {socials.map((s) => (
                <li key={s.platform}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium capitalize hover:bg-muted/40"
                  >
                    <LinkIcon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    {s.platform}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
