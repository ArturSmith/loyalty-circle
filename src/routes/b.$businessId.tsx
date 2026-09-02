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
import { ArrowLeft, Globe, Link2 as LinkIcon, MapPin, Phone, Trash2 } from "lucide-react";
import { brandTint, normalizeBrandColor } from "@/lib/brand";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { useServerFn } from "@tanstack/react-start";
import { claimCardToWallet } from "@/utils/cards.functions";
import { isGoogleWalletEnabled, isAppleWalletEnabled } from "@/utils/wallet.functions";
import { GoogleWalletButton } from "@/components/GoogleWalletButton";
import { WalletChooser } from "@/components/WalletChooser";
import { Checkbox } from "@/components/ui/checkbox";
import { CardTermsSection } from "@/components/CardTermsSection";
import { invalidateTabCache } from "@/lib/tabCache";
import { resetAppStatusBarTheme } from "@/lib/native";

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
  const [removing, setRemoving] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ownedTemplateIds, setOwnedTemplateIds] = useState<Map<string, string>>(new Map());
  const [frontTemplateId, setFrontTemplateId] = useState<string | null>(null);
  const [flippedTemplateId, setFlippedTemplateId] = useState<string | null>(null);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [socials, setSocials] = useState<BusinessSocial[]>([]);
  const walletEnabled = useServerFn(isGoogleWalletEnabled);
  const appleWalletEnabled = useServerFn(isAppleWalletEnabled);
  const [googleWalletReady, setGoogleWalletReady] = useState(false);
  const [appleWalletReady, setAppleWalletReady] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState<Set<string>>(new Set());
  const [expandedTermsId, setExpandedTermsId] = useState<string | null>(null);
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
      try { sessionStorage.removeItem("open_card_id"); } catch {
        // Wallet still opens normally when session storage is unavailable.
      }
      // Wallet is a persistent bottom tab and may still hold the list from
      // before this claim. Force its next mount to load the newly-added card
      // instead of briefly rendering that stale snapshot.
      invalidateTabCache("wallet");
      toast.success(result.alreadyOwned ? "Card is already in your wallet" : "Card added to your wallet");
      navigate({ to: "/wallet" });
    } catch (error) {
      toast.error("Couldn't add card", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setClaiming(null);
    }
  };

  const openInWallet = (instanceId: string) => {
    try {
      sessionStorage.setItem("open_card_id", instanceId);
    } catch {
      // The wallet still opens normally when session storage is unavailable.
    }
    navigate({ to: "/wallet" });
  };

  const removeFromWallet = async (template: Template, instanceId: string) => {
    if (!window.confirm(`Remove "${template.title}" from your wallet? This cannot be undone.`)) {
      return;
    }

    setRemoving(template.id);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Please sign in again to remove cards.");

      const { error } = await supabase
        .from("card_instances")
        .delete()
        .eq("id", instanceId)
        .eq("customer_id", data.user.id);
      if (error) throw error;

      setOwnedTemplateIds((previous) => {
        const next = new Map(previous);
        next.delete(template.id);
        return next;
      });
      invalidateTabCache("wallet");
      toast.success("Card removed from your wallet");
    } catch (error) {
      toast.error("Couldn't remove card", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setRemoving(null);
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

  useEffect(() => {
    void resetAppStatusBarTheme();
    return () => {
      void resetAppStatusBarTheme();
    };
  }, []);


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

  const displayedTemplates = frontTemplateId
    ? [
        ...templates.filter((template) => template.id !== frontTemplateId),
        ...templates.filter((template) => template.id === frontTemplateId),
      ]
    : templates;
  const activeTemplate = displayedTemplates[displayedTemplates.length - 1] ?? null;
  const businessBrand = normalizeBrandColor(business?.brand_color);
  const businessInfoStyle = businessBrand
    ? {
        background: `linear-gradient(180deg, ${brandTint(businessBrand, 0.18)} 0%, ${brandTint(businessBrand, 0.06)} 45%, transparent 100%)`,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md">
        <Button
          variant="ghost"
          className="mb-3 -ml-2 gap-2"
          asChild
        >
          <Link to="/discover">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>

        <div
          className="rounded-t-3xl px-5 pb-8 pt-6 text-center"
          style={businessInfoStyle}
        >
          {business?.logo_url ? (
            <img
              src={business.logo_url}
              alt={`${business.name} logo`}
              className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-border ring-offset-2 ring-offset-background"
            />
          ) : null}
          <h1 className="mt-4 font-display text-3xl font-semibold">{business?.name ?? "Loyalty cards"}</h1>
          {business?.category && (
            <p className="mt-2 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium uppercase tracking-widest text-secondary-foreground">
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
          <OrnamentDivider className="mx-auto my-6 w-40 opacity-60" />
        </div>

        {activeTemplate ? (() => {
          const t = activeTemplate;
          const ownedInstanceId = ownedTemplateIds.get(t.id);
          const termsKey = `${t.id}:${t.terms_version}`;
          const hasAcceptedTerms = acceptedTerms.has(termsKey);
          const requestTermsAcceptance = () => {
            setExpandedTermsId(t.id);
            toast.info("Review and accept the card terms to continue");
          };
          const handleActiveCardAction = () => {
            if (!userId) return;
            if (ownedInstanceId) {
              openInWallet(ownedInstanceId);
              return;
            }
            if (!hasAcceptedTerms) {
              requestTermsAcceptance();
              return;
            }
            claim(t.id, t.terms_version);
          };
          const stackOffset = Math.max(0, displayedTemplates.length - 1) * 56;

          return (
            <section className="mt-6" aria-label="Loyalty cards">
              <div className="relative">
                {/* StampCard is responsive, so reserve its real aspect-ratio
                    height plus every visible stack offset. A fixed pixel
                    height lets wide mobile cards cover the controls below. */}
                <div className="aspect-[1.586/1]" aria-hidden="true" />
                {stackOffset > 0 ? <div style={{ height: stackOffset }} aria-hidden="true" /> : null}
                {displayedTemplates.map((template, index) => {
                  const isFront = index === displayedTemplates.length - 1;
                  return (
                    <motion.div
                      key={template.id}
                      className="absolute inset-x-0 top-0"
                      initial={false}
                      animate={{ y: index * 56, scale: isFront ? 1 : 0.98 }}
                      transition={{ type: "spring", stiffness: 260, damping: 30 }}
                      style={{ zIndex: index + 1 }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="block w-full rounded-2xl text-left focus:outline-none focus-visible:ring-2"
                        aria-label={isFront ? `${template.title}, selected` : `Bring ${template.title} forward`}
                        onClick={() => {
                          if (!isFront) {
                            setFrontTemplateId(template.id);
                            setExpandedTermsId(null);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          setFrontTemplateId(template.id);
                          setExpandedTermsId(null);
                        }}
                      >
                        <StampCard
                          title={template.title}
                          subtitle={template.subtitle}
                          cornerTitle={template.corner_title}
                          totalSteps={template.total_steps}
                          stampsCount={0}
                          shape={template.shape}
                          gridCols={template.grid_cols}
                          bgColor={template.bg_color}
                          accentColor={template.accent_color}
                          textColor={template.text_color}
                          stampIcon={template.stamp_icon}
                          logoUrl={template.logo_url}
                          rewards={template.rewards}
                          face={flippedTemplateId === template.id ? "stamps" : "info"}
                          disableShadow
                          showFlipButton={isFront}
                          onFlip={() =>
                            setFlippedTemplateId((previous) =>
                              previous === template.id ? null : template.id,
                            )
                          }
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <CardTermsSection
                  terms={t.terms_and_conditions}
                  className="mt-6 border-border bg-card shadow-sm"
                  termsClassName="max-h-40 overflow-y-auto"
                  open={expandedTermsId === t.id}
                  onOpenChange={(open) => setExpandedTermsId(open ? t.id : null)}
                >
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
                </CardTermsSection>

                {userId ? (
                  <>
                    {ownedInstanceId ? (
                      <div className="mt-3 flex gap-2">
                        <Button
                          className="h-11 min-w-0 flex-1 border-0"
                          onClick={() => openInWallet(ownedInstanceId)}
                        >
                          Open in my wallet
                        </Button>
                        <Button
                          variant="outline"
                          className="h-11 gap-1.5 border-destructive/30 bg-card/90 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={removing === t.id}
                          onClick={() => void removeFromWallet(t, ownedInstanceId)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {removing === t.id ? "Removing…" : "Remove"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="mt-3 h-11 w-full border-0"
                        disabled={claiming === t.id}
                        onClick={handleActiveCardAction}
                      >
                        {claiming === t.id ? "Adding…" : "Add to my wallet"}
                      </Button>
                    )}
                    {googleWalletReady && !ownedInstanceId ? (
                      <>
                        <GoogleWalletButton
                          templateId={t.id}
                          acceptedTermsVersion={hasAcceptedTerms ? t.terms_version : null}
                          onTermsRequired={requestTermsAcceptance}
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
                    onTermsRequired={requestTermsAcceptance}
                    onUseInAppWallet={() => {
                      try { sessionStorage.setItem(`pending_claim:${businessId}`, t.id); } catch {}
                      try { sessionStorage.setItem(`pending_claim_terms:${businessId}`, String(t.terms_version)); } catch {}
                      navigate({ to: "/auth", search: { redirect: `/b/${businessId}` } });
                    }}
                  />
                )}
              </motion.div>
            </section>
          );
        })() : null}

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
                    className="rounded-2xl border border-primary/20 bg-card/90 p-4 shadow-sm backdrop-blur"
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
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-primary/20 bg-card/90 p-4 shadow-sm backdrop-blur">
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
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-card/70 px-3 py-1.5 text-xs font-medium capitalize text-primary backdrop-blur hover:bg-card"
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
