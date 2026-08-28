import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  CreditCard,
  Globe2,
  MapPin,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { ScreenLoader, Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import {
  BusinessForm,
  businessDetailsFromRow,
  businessDetailsToPayload,
  emptyBusinessDetails,
  isSectionValid,
  type BusinessDetails,
} from "@/components/BusinessForm";
import { LocationsEditor } from "@/components/business/LocationsEditor";
import { SocialsEditor } from "@/components/business/SocialsEditor";
import { inviteMember, listMembers, type MemberRow } from "@/utils/members.functions";
import { useEntitlements } from "@/hooks/useEntitlements";

export const Route = createFileRoute("/_authenticated/business/onboarding")({
  head: () => ({ meta: [{ title: "Set up your business — ClubCarder" }] }),
  component: OnboardingWizard,
});

/**
 * Eight-step business setup.
 *
 * Progress lives in `businesses.onboarding_step` rather than component state so
 * a half-finished setup survives a closed tab or a switch to another device.
 * Steps 3–6 are optional: they enrich the public page but nothing breaks if the
 * owner skips them, and forcing them is the fastest way to lose a signup.
 */

const TOTAL_STEPS = 8;

type StepDef = {
  n: number;
  title: string;
  blurb: string;
  icon: typeof Store;
  optional: boolean;
};

const STEPS: StepDef[] = [
  { n: 1, title: "Business basics", blurb: "Name, category and how your brand looks.", icon: Store, optional: false },
  { n: 2, title: "Address & contact", blurb: "So customers nearby can find you.", icon: MapPin, optional: false },
  { n: 3, title: "Locations", blurb: "Add every branch that hands out stamps.", icon: MapPin, optional: true },
  { n: 4, title: "Administrators", blurb: "Invite the people who run your counter.", icon: Users, optional: true },
  { n: 5, title: "My Networks", blurb: "Link your social profiles.", icon: Globe2, optional: true },
  { n: 6, title: "Your story", blurb: "A short description and a welcome message.", icon: Store, optional: true },
  { n: 7, title: "Marketplace", blurb: "Decide whether to be listed publicly.", icon: Store, optional: false },
  { n: 8, title: "Review", blurb: "Everything looks right? You're done.", icon: Check, optional: false },
];

type BizRow = {
  id: string;
  name: string;
  accepted_by_platform: boolean;
  onboarding_step: number | null;
  onboarding_completed_at: string | null;
  marketplace_status: string | null;
};

function OnboardingWizard() {
  const navigate = useNavigate();
  const ent = useEntitlements();
  const [biz, setBiz] = useState<BizRow | null>(null);
  const [details, setDetails] = useState<BusinessDetails>(emptyBusinessDetails);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [marketplace, setMarketplace] = useState<"unpublished" | "published">("unpublished");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", u.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const row = data as unknown as BizRow;
        setBiz(row);
        setDetails(businessDetailsFromRow(data as Record<string, unknown>));
        const saved = row.onboarding_step ?? 1;
        setStep(Math.min(Math.max(saved, 1), TOTAL_STEPS));
        if (row.marketplace_status === "published") {
          setMarketplace("published");
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Persist the furthest step reached — never move the marker backwards. */
  const persistStep = useCallback(
    async (next: number, extra: Record<string, unknown> = {}) => {
      if (!biz) return;
      const furthest = Math.max(next, biz.onboarding_step ?? 1);
      const { error } = await (supabase as any)
        .from("businesses")
        .update({ onboarding_step: furthest, ...extra })
        .eq("id", biz.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      setBiz((b) => (b ? { ...b, onboarding_step: furthest, ...(extra as object) } : b));
    },
    [biz],
  );

  const saveDetails = async (): Promise<boolean> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return false;
    const payload = businessDetailsToPayload(details);

    if (!biz) {
      const { data, error } = await supabase
        .from("businesses")
        .insert({ owner_id: u.user.id, ...payload })
        .select()
        .maybeSingle();
      if (error || !data) {
        toast.error(error?.message ?? "Could not create your business");
        return false;
      }
      setBiz(data as unknown as BizRow);
      ent.refetch();
      return true;
    }

    const { error } = await (supabase.rpc as any)("submit_business_changes", {
      _business_id: biz.id,
      _changes: payload,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  };

  const goNext = async () => {
    setSaving(true);
    try {
      // Steps that own business columns write them before advancing.
      if (step === 1 || step === 2 || step === 6) {
        const ok = await saveDetails();
        if (!ok) return;
      }
      if (step === 7 && biz) {
        await (supabase as any)
          .from("businesses")
          .update({
            marketplace_status: marketplace,
            marketplace_submitted_at: marketplace === "published" ? new Date().toISOString() : null,
          })
          .eq("id", biz.id);
      }
      if (step === TOTAL_STEPS) {
        await persistStep(TOTAL_STEPS, { onboarding_completed_at: new Date().toISOString() });
        const { error } = await (supabase.rpc as any)("submit_business_for_moderation", {
          _business_id: biz?.id,
        });
        if (error && !error.message?.includes("already accepted")) {
          toast.error(error.message);
          return;
        }
        toast.success("Your business was submitted for review");
        navigate({ to: "/business" });
        return;
      }
      await persistStep(step + 1);
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    // On the first step there is no previous step, but a dead button is worse
    // than none — leave the wizard rather than trapping the user in it.
    if (step === 1) {
      navigate({ to: "/wallet" });
      return;
    }
    setStep(step - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const current = STEPS[step - 1];

  // Step 1 and 2 gate on their own fields; the business must exist past step 2.
  const canAdvance = useMemo(() => {
    if (step === 1) return isSectionValid(details, "basics");
    if (step === 2) return isSectionValid(details, "address");
    return true;
  }, [step, details]);

  if (loading) return <ScreenLoader />;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Step {step} of {TOTAL_STEPS}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{current.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{current.blurb}</p>
          </div>
          {/* Always offer a way out. Someone part-way through goes to their
              wallet, since /business would only send them back here. */}
          <Button asChild variant="ghost" size="sm">
            <Link to={biz?.onboarding_completed_at ? "/business" : "/wallet"}>Exit</Link>
          </Button>
        </div>

        <div className="mt-5 flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
          {STEPS.map((s) => (
            <span
              key={s.n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s.n < step ? "bg-primary" : s.n === step ? "bg-primary/60" : "bg-border"
              }`}
            />
          ))}
        </div>
      </header>

      <OrnamentDivider className="mb-6" />

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        {step === 1 && <BusinessForm value={details} onChange={setDetails} sections={["basics"]} />}
        {step === 2 && (
          <BusinessForm value={details} onChange={setDetails} sections={["address", "contact"]} />
        )}
        {step === 3 &&
          (biz ? (
            <LocationsEditor businessId={biz.id} />
          ) : (
            <NotYet />
          ))}
        {step === 4 && <AdministratorsStep />}
        {step === 5 && (biz ? <SocialsEditor businessId={biz.id} /> : <NotYet />)}
        {step === 6 && <BusinessForm value={details} onChange={setDetails} sections={["about"]} />}
        {step === 7 && <MarketplaceStep value={marketplace} onChange={setMarketplace} />}
        {step === 8 && biz && <ReviewStep biz={biz} details={details} marketplace={marketplace} />}
      </motion.div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3">
          <Button type="button" variant="ghost" onClick={goBack} disabled={saving}>
            <ArrowLeft className="mr-2 h-4 w-4" /> {step === 1 ? "Cancel" : "Back"}
          </Button>
          <div className="flex-1" />
          {current.optional && (
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                void persistStep(step + 1);
                setStep(step + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Skip
            </Button>
          )}
          <Button type="button" onClick={() => void goNext()} disabled={saving || !canAdvance}>
            {saving ? <Spinner size={16} label={null} className="mr-2" /> : null}
            {step === TOTAL_STEPS ? "Finish setup" : "Continue"}
            {step !== TOTAL_STEPS && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotYet() {
  return (
    <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
      Finish the first two steps and we'll unlock this one.
    </p>
  );
}

/* --------------------------------------------------------- administrators */

function AdministratorsStep() {
  const invite = useServerFn(inviteMember);
  const load = useServerFn(listMembers);
  const ent = useEntitlements();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMembers(await load({ data: {} }));
    } catch {
      // A missing team is not an error worth interrupting setup for.
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const limit = ent.check("administrators");

  const send = async () => {
    if (!email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      const res = await invite({ data: { email: email.trim(), environment: getPaddleEnvironment() } });
      if (res.status === "error") {
        toast.error(res.message);
        return;
      }
      setEmail("");
      await refresh();
      ent.refetch();
      toast.success(
        res.accessGranted
          ? "Administrator added"
          : res.emailSent
            ? "Invitation sent"
            : "Invitation created — copy the link below",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the invitation");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading your team…" />;

  return (
    <div className="space-y-5">
      {members.length > 0 && (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="rounded-xl border border-border bg-card/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.displayName || m.email}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {m.role} · {m.status}
                  </p>
                </div>
                {m.inviteUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(m.inviteUrl!);
                      toast.success("Invite link copied");
                    }}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" /> Link
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {limit.allowed ? (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <Label htmlFor="admin-email">Invite an administrator</Label>
          <div className="flex gap-2">
            <Input
              id="admin-email"
              type="email"
              inputMode="email"
              value={email}
              placeholder="name@business.no"
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="button" onClick={() => void send()} disabled={busy}>
              {busy ? <Spinner size={16} label={null} className="mr-2" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            They get the default administrator permissions. You can change them later under Team.
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm text-muted-foreground">{limit.reason}</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/subscribe">
              <CreditCard className="mr-2 h-4 w-4" /> See plans
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ marketplace */

function MarketplaceStep({
  value,
  onChange,
}: {
  value: "unpublished" | "published";
  onChange: (v: "unpublished" | "published") => void;
}) {
  const options = [
    {
      key: "published" as const,
      title: "List us in the marketplace",
      blurb:
        "Your business and its locations appear in Discover straight away. You can turn this off at any time.",
    },
    {
      key: "unpublished" as const,
      title: "Keep us private",
      blurb:
        "Your card still works over QR and links — you just won't show up in the public directory.",
    },
  ];

  return (
    <div className="space-y-3">
      {options.map((o) => {
        const selected = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={selected}
            className={`w-full rounded-xl border p-4 text-left transition-colors ${
              selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {selected && <Check className="h-3 w-3" />}
              </span>
              <span>
                <span className="block text-sm font-medium">{o.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{o.blurb}</span>
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- review */

function ReviewStep({
  biz,
  details,
  marketplace,
}: {
  biz: BizRow;
  details: BusinessDetails;
  marketplace: string;
}) {
  const rows = [
    { label: "Business", value: details.name || biz.name },
    { label: "Category", value: details.category || "—" },
    {
      label: "Address",
      value: [details.address_line1, details.postal_code, details.city, details.country]
        .filter(Boolean)
        .join(", ") || "—",
    },
    { label: "Contact", value: [details.phone, details.website].filter(Boolean).join(" · ") || "—" },
    {
      label: "Marketplace",
      value: marketplace === "published" ? "Listed in Discover" : "Private",
    },
  ];

  return (
    <div className="space-y-5">
      <dl className="divide-y divide-border rounded-xl border border-border">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-4 px-4 py-3">
            <dt className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {r.label}
            </dt>
            <dd className="min-w-0 flex-1 break-words text-sm">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        Next up: create your first loyalty card so customers have something to collect.
      </p>
      <Button asChild variant="outline">
        <Link to="/business/cards/new" search={{ businessId: biz.id }}>Create a loyalty card</Link>
      </Button>
    </div>
  );
}
