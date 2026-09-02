import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Pencil, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScreenLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardWizard } from "@/components/CardWizard";
import {
  BusinessForm,
  businessDetailsFromRow,
  businessDetailsToPayload,
  emptyBusinessDetails,
  isSectionValid,
  type BusinessDetails,
} from "@/components/BusinessForm";
import { SOCIAL_PLATFORMS } from "@/components/business/SocialsEditor";
import { cardDraftSchema, type CardDraft } from "@/lib/card-draft";
import { invalidateNavigationCache } from "@/lib/navigationCache";
import { invalidateTabCache } from "@/lib/tabCache";

export const Route = createFileRoute("/_authenticated/business/onboarding")({
  head: () => ({ meta: [{ title: "Set up your business — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid().optional() }),
  component: OnboardingWizard,
});

const STEPS = [
  { title: "Business basics", blurb: "Name, category and how your brand looks.", optional: false },
  { title: "Address & contact", blurb: "So customers nearby can find you.", optional: false },
  { title: "My Networks", blurb: "Link your social profiles.", optional: true },
  { title: "Your story", blurb: "A short description and a welcome message.", optional: true },
  {
    title: "Marketplace",
    blurb: "Decide whether to be listed publicly after approval.",
    optional: false,
  },
  {
    title: "Create your first loyalty card",
    blurb: "A loyalty card is required to submit your business.",
    optional: false,
  },
  {
    title: "Review",
    blurb: "Your business and first card will be reviewed before they go live.",
    optional: false,
  },
];

type WizardDraft = {
  id: string;
  details: BusinessDetails;
  socials: Record<string, string>;
  marketplace: "unpublished" | "published";
  card: CardDraft | null;
  cardId: string | null;
  step: number;
};

const storedDraftSchema = z.object({
  id: z.string().uuid(),
  details: z.record(z.string()),
  socials: z.record(z.string()),
  marketplace: z.enum(["unpublished", "published"]),
  card: z.unknown(),
  cardId: z.string().uuid().nullable(),
  step: z
    .number()
    .int()
    .min(0)
    .max(STEPS.length - 1),
});

function OnboardingWizard() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const { businessId } = Route.useSearch();
  const storageKey = `business-onboarding-v2:${user.id}:${businessId ?? "new"}`;
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [editingCard, setEditingCard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDraft(null);
    setLoadError(false);
    void (async () => {
      try {
        let next: WizardDraft = {
          id: businessId ?? crypto.randomUUID(),
          details: { ...emptyBusinessDetails },
          socials: {},
          marketplace: "unpublished",
          card: null,
          cardId: null,
          step: 0,
        };
        if (businessId) {
          const { data: business, error } = await supabase
            .from("businesses")
            .select("*")
            .eq("id", businessId)
            .eq("owner_id", user.id)
            .single();
          if (error) throw error;
          if (business.accepted_by_platform) {
            if (!cancelled)
              void navigate({ to: "/business", search: { businessId }, replace: true });
            return;
          }
          const [cards, socials] = await Promise.all([
            supabase
              .from("card_templates")
              .select("*")
              .eq("business_id", businessId)
              .order("created_at", { ascending: true })
              .limit(1),
            supabase.from("business_socials").select("platform,url").eq("business_id", businessId),
          ]);
          if (cards.error) throw cards.error;
          if (socials.error) throw socials.error;
          const card = cards.data?.[0];
          let cardData: unknown = card;
          if (card) {
            const { data: pending, error: pendingError } = await supabase.rpc(
              "get_pending_moderation",
              { _entity_type: "card", _entity_id: card.id },
            );
            if (pendingError) throw pendingError;
            cardData =
              (pending as { proposed_data?: { card?: unknown } } | null)?.proposed_data?.card ??
              card;
          }
          const parsedCard = cardDraftSchema.safeParse(cardData);
          next = {
            ...next,
            details: businessDetailsFromRow(business),
            marketplace: business.marketplace_status === "published" ? "published" : "unpublished",
            socials: Object.fromEntries(socials.data.map((row) => [row.platform, row.url])),
            card: parsedCard.success ? parsedCard.data : null,
            cardId: card?.id ?? null,
          };
        }
        // Moving between steps never creates database rows. Drafts survive
        // reloads in this tab and are scoped to the account and selected business.
        try {
          const raw = sessionStorage.getItem(storageKey);
          if (raw) {
            const parsed = storedDraftSchema.safeParse(JSON.parse(raw));
            if (parsed.success && (!businessId || parsed.data.id === businessId)) {
              const saved = parsed.data;
              const savedCard = cardDraftSchema.safeParse(saved.card);
              next = {
                ...saved,
                details: businessDetailsFromRow(saved.details),
                step: Math.max(0, Math.min(saved.step, STEPS.length - 1)),
                card: savedCard.success ? savedCard.data : null,
              };
            }
          }
        } catch {
          /* Storage is optional in private browsing. */
        }
        if (!cancelled) setDraft(next);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, navigate, storageKey, user.id]);

  useEffect(() => {
    if (!draft) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* Quota/private mode. */
    }
  }, [draft, storageKey]);

  if (loadError)
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <p role="alert">Could not load your business draft.</p>
        <Button asChild>
          <Link to="/workspace">Back to workspace</Link>
        </Button>
      </div>
    );
  if (!draft) return <ScreenLoader />;

  const { details, card, step, marketplace, socials } = draft;
  const current = STEPS[step];
  const update = (patch: Partial<WizardDraft>) =>
    setDraft((value) => (value ? { ...value, ...patch } : value));
  const moveTo = (next: number) => {
    setAttempted(false);
    setEditingCard(false);
    update({ step: next });
    document.getElementById("app-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const invalidSocials = SOCIAL_PLATFORMS.filter(
    ({ key }) => socials[key]?.trim() && !normalizeSocialUrl(socials[key]),
  );
  const validate = (all = false) => {
    let invalidStep: number | null = null;
    if ((all || step === 0) && !isSectionValid(details, "basics")) invalidStep = 0;
    else if ((all || step === 1) && !isSectionValid(details, "address")) invalidStep = 1;
    else if ((all || step === 2) && invalidSocials.length) invalidStep = 2;
    else if ((all || step === 5) && !cardDraftSchema.safeParse(card).success) invalidStep = 5;
    if (invalidStep !== null) {
      update({ step: invalidStep });
      setAttempted(true);
      toast.error(
        invalidStep === 5
          ? "Create your first loyalty card before continuing."
          : "Please complete the highlighted fields.",
      );
      return false;
    }
    return true;
  };
  const submit = async () => {
    if (saving || !validate(true) || !card) return;
    setSaving(true);
    try {
      const links = SOCIAL_PLATFORMS.flatMap(({ key }) => {
        const url = normalizeSocialUrl(socials[key] ?? "");
        return url ? [{ platform: key, url }] : [];
      });
      const { error } = await supabase.rpc("submit_business_onboarding", {
        _business_id: draft.id,
        _business: businessDetailsToPayload(details),
        _card: card,
        _card_id: draft.cardId ?? undefined,
        _socials: links,
        _marketplace: marketplace,
      });
      if (error) throw error;
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Optional storage. */
      }
      invalidateNavigationCache();
      invalidateTabCache("profile");
      toast.success("Your business and first loyalty card have been sent to moderators.");
      await navigate({ to: "/profile", search: { businessSubmitted: true }, replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : ((error as { message?: string })?.message ??
              "Could not submit your business. Please try again."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-6">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold">{current.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{current.blurb}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => navigate({ to: "/profile" })}
          >
            Exit
          </Button>
        </div>
        <div
          className="mt-5 flex gap-1.5"
          role="progressbar"
          aria-label="Business setup"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          {STEPS.map((item, index) => (
            <span
              key={item.title}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>
      </header>

      {attempted && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {step === 5
            ? "Create your first loyalty card before continuing."
            : "Please complete the highlighted fields."}
        </p>
      )}
      {step === 0 && (
        <BusinessForm
          value={details}
          onChange={(value) => update({ details: value })}
          sections={["basics"]}
          showErrors={attempted}
        />
      )}
      {step === 1 && (
        <BusinessForm
          value={details}
          onChange={(value) => update({ details: value })}
          sections={["address", "contact"]}
          showErrors={attempted}
        />
      )}
      {step === 2 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <Label htmlFor={`network-${key}`}>{label}</Label>
              <Input
                id={`network-${key}`}
                value={socials[key] ?? ""}
                placeholder={placeholder}
                maxLength={300}
                onChange={(event) => update({ socials: { ...socials, [key]: event.target.value } })}
                aria-invalid={attempted && invalidSocials.some((item) => item.key === key)}
                className={`mt-1.5 ${attempted && invalidSocials.some((item) => item.key === key) ? "border-destructive ring-1 ring-destructive" : ""}`}
              />
            </div>
          ))}
        </div>
      )}
      {step === 3 && (
        <BusinessForm
          value={details}
          onChange={(value) => update({ details: value })}
          sections={["about"]}
        />
      )}
      {step === 4 && (
        <div className="space-y-3">
          {[
            {
              value: "published" as const,
              label: "List us in the marketplace",
              description: "Your business will appear in Discover after moderation approval.",
            },
            {
              value: "unpublished" as const,
              label: "Keep us private",
              description:
                "After approval, customers can use your cards through QR codes and links.",
            },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={marketplace === option.value}
              onClick={() => update({ marketplace: option.value })}
              className={`flex w-full gap-3 rounded-2xl border p-4 text-left ${marketplace === option.value ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <Check
                className={`mt-0.5 h-5 w-5 shrink-0 ${marketplace === option.value ? "text-primary" : "text-transparent"}`}
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {step === 5 &&
        (editingCard ? (
          <CardWizard
            draft={card ?? undefined}
            onDraftComplete={(value) => {
              update({ card: value });
              setEditingCard(false);
              setAttempted(false);
            }}
            onCancel={() => setEditingCard(false)}
          />
        ) : (
          <section
            className={`space-y-4 rounded-2xl border bg-card p-5 ${attempted && !card ? "border-destructive ring-1 ring-destructive" : "border-border"}`}
          >
            <CreditCard className="h-6 w-6 text-primary" />
            <h2 className="font-display text-xl font-semibold">
              {card?.title ?? "Create your first loyalty card"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {card
                ? "Card draft saved. It will be reviewed with your business."
                : "Choose the design, rewards and terms your customers will use."}
            </p>
            <Button onClick={() => setEditingCard(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {card ? "Edit loyalty card" : "Create a loyalty card"}
            </Button>
          </section>
        ))}
      {step === 6 && (
        <div className="space-y-4">
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
            {[
              ["Business", details.name],
              ["Category", details.category],
              [
                "Address",
                [details.address_line1, details.postal_code, details.city, details.country]
                  .filter(Boolean)
                  .join(", "),
              ],
              ["Marketplace", marketplace === "published" ? "Listed after approval" : "Private"],
              ["Loyalty card", card?.title ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 p-4 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-words font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">
            Your business will not be available to customers until moderators approve it. You can
            edit your submission from Workspace.
          </p>
        </div>
      )}

      {!editingCard && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"
          style={{ paddingBottom: "var(--safe-bottom, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => (step === 0 ? void navigate({ to: "/profile" }) : moveTo(step - 1))}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            <div className="flex-1" />
            {current.optional && (
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  moveTo(step + 1);
                }}
              >
                Skip
              </Button>
            )}
            <Button
              disabled={saving}
              onClick={() =>
                step === STEPS.length - 1 ? void submit() : validate() && moveTo(step + 1)
              }
            >
              {saving && <Spinner size={16} label={null} className="mr-2" />}
              {step === STEPS.length - 1
                ? businessId
                  ? "Submit for review"
                  : "Create business"
                : "Continue"}
              {step !== STEPS.length - 1 && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeSocialUrl(raw: string): string | null {
  if (!raw.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
