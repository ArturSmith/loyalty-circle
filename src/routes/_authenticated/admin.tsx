import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScreenLoader, Spinner } from "@/components/Spinner";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Clock3, Gift, Search, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Json } from "@/integrations/supabase/types";
import {
  amIAdmin,
  listBusinessesForAdmin,
  listModerationForAdmin,
  reviewModerationForAdmin,
  setAdminByEmail,
  setBusinessComped,
  type AdminBusiness,
  type AdminModerationSubmission,
} from "@/utils/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Staff admin — ClubCarder" },
      { name: "description", content: "Grant free test access to businesses." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(amIAdmin);
  const list = useServerFn(listBusinessesForAdmin);
  const setComped = useServerFn(setBusinessComped);
  const setAdmin = useServerFn(setAdminByEmail);
  const listModeration = useServerFn(listModerationForAdmin);
  const reviewModeration = useServerFn(reviewModerationForAdmin);

  const [admin, setAdminState] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AdminBusiness[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [moderation, setModeration] = useState<AdminModerationSubmission[]>([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = async (query = q) => {
    setLoading(true);
    try {
      setRows(await list({ data: { q: query } }));
    } catch (e) {
      console.error(e);
      toast.error("Could not load businesses.");
    } finally {
      setLoading(false);
    }
  };

  const loadModeration = async () => {
    setModerationLoading(true);
    try {
      setModeration(await listModeration({}));
    } catch (e) {
      console.error(e);
      toast.error("Could not load moderation queue.");
    } finally {
      setModerationLoading(false);
    }
  };

  const decide = async (submission: AdminModerationSubmission, decision: "accepted" | "rejected") => {
    const reason = decision === "rejected"
      ? window.prompt("Tell the business why this submission was rejected:")
      : "";
    if (decision === "rejected" && reason === null) return;
    if (decision === "rejected" && (reason ?? "").trim().length < 3) {
      toast.error("Add a short rejection reason.");
      return;
    }
    setReviewingId(submission.id);
    try {
      await reviewModeration({
        data: { submissionId: submission.id, decision, reason: reason ?? undefined },
      });
      setModeration((current) => current.filter((row) => row.id !== submission.id));
      toast.success(decision === "accepted" ? "Submission accepted and published" : "Submission rejected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not review this submission.");
    } finally {
      setReviewingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Wait until the Supabase session is restored, otherwise the bearer token
      // isn't attached yet and every admin server fn 401s on first paint.
      let session = (await supabase.auth.getSession()).data.session;
      for (let i = 0; !session && i < 20; i++) {
        await new Promise((r) => setTimeout(r, 100));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (cancelled) return;
      if (!session) {
        setAdminState(false);
        return;
      }
      try {
        const r = await checkAdmin({});
        if (cancelled) return;
        setAdminState(r.admin);
        if (r.admin) {
          load("");
          loadModeration();
        }
      } catch {
        if (!cancelled) setAdminState(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const toggle = async (b: AdminBusiness, next: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === b.id ? { ...r, comped: next } : r)));
    try {
      await setComped({
        data: { businessId: b.id, comped: next, note: next ? "Test account" : "" },
      });
      toast.success(next ? `${b.name} now has free access` : `Free access removed from ${b.name}`);
    } catch (e) {
      console.error(e);
      setRows((prev) => prev.map((r) => (r.id === b.id ? { ...r, comped: !next } : r)));
      toast.error("Could not update free access.");
    }
  };

  if (admin === null) {
    return <ScreenLoader />;
  }

  if (!admin) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl border-2 border-ink/10 bg-card p-8 text-center card-shadow">
          <h1 className="font-display text-2xl font-semibold">Staff only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is restricted to ClubCarder staff admins.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate({ to: "/wallet" })}>
            Back to my cards
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={() => navigate({ to: "/wallet" })}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck className="h-5 w-5 text-primary" /> Staff admin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review content before publication and manage platform access.
        </p>

        <section className="mt-6 rounded-2xl border-2 border-ink/10 bg-card p-4 card-shadow">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="h-4 w-4 text-primary" /> Moderation queue
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Accepting publishes the proposed business or card data. Rejected submissions stay private.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={loadModeration} disabled={moderationLoading}>
              Refresh
            </Button>
          </div>

          {moderationLoading && <Spinner size={24} className="mx-auto my-5" />}
          {!moderationLoading && moderation.length === 0 && (
            <p className="mt-4 rounded-xl bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              Nothing is waiting for review.
            </p>
          )}
          <div className="mt-4 space-y-3">
            {moderation.map((submission) => (
              <article key={submission.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{submission.entity_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {submission.entity_type === "business" ? "Business" : `Card · ${submission.business_name}`}
                      {` · ${submission.change_kind === "create" ? "New" : "Changes"}`}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Submitted {new Date(submission.submitted_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Pending
                  </span>
                </div>
                <ModerationComparison submission={submission} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={reviewingId === submission.id}
                    onClick={() => void decide(submission, "accepted")}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 text-destructive"
                    disabled={reviewingId === submission.id}
                    onClick={() => void decide(submission, "rejected")}
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-6 rounded-2xl border-2 border-ink/10 bg-card p-4 card-shadow">
          <p className="text-sm font-semibold">Staff admins</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="person@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await setAdmin({ data: { email, admin: true } });
                    toast.success("Admin access granted.");
                    setEmail("");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Could not grant admin access.");
                  }
                }}
              >
                Make admin
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await setAdmin({ data: { email, admin: false } });
                    toast.success("Admin access removed.");
                    setEmail("");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Could not remove admin access.");
                  }
                }}
              >
                Remove
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            The person must already have a ClubCarder account.
          </p>
        </div>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <Input placeholder="Search businesses…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          {loading && (
            <div className="p-4">
              <Spinner size={24} className="mx-auto" />
            </div>
          )}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No businesses found.</p>
          )}
          {rows.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink/10 bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{b.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {b.owner_email ?? b.owner_id}
                  {b.city ? ` · ${b.city}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {b.comped && <Gift className="h-4 w-4 text-primary" />}
                <Switch
                  checked={b.comped}
                  onCheckedChange={(v) => toggle(b, v)}
                  aria-label={`Free access for ${b.name}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type ReviewValue = Json | undefined;

type ReviewDifference = {
  field: string;
  current: ReviewValue;
  proposed: ReviewValue;
};

function ModerationComparison({ submission }: { submission: AdminModerationSubmission }) {
  const currentValues = flattenReviewData(submission.current_data);
  const proposedValues = flattenReviewData(submission.proposed_data);
  const keys = Array.from(new Set([...currentValues.keys(), ...proposedValues.keys()]));
  const differences: ReviewDifference[] = keys
    .filter((field) => {
      const proposed = proposedValues.get(field);
      if (submission.change_kind === "create") return !isEmptyReviewValue(proposed);
      return stableJson(currentValues.get(field)) !== stableJson(proposed);
    })
    .map((field) => ({
      field,
      current: currentValues.get(field),
      proposed: proposedValues.get(field),
    }));

  return (
    <details className="mt-3 rounded-xl border border-border bg-muted/20 p-3" open>
      <summary className="cursor-pointer text-xs font-semibold">
        {submission.change_kind === "create"
          ? `Review new ${submission.entity_type}`
          : `${differences.length} ${differences.length === 1 ? "change" : "changes"} to review`}
      </summary>

      {submission.change_kind === "create" && (
        <p className="mt-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          This content has not been published yet. The proposed values are shown below.
        </p>
      )}

      {differences.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No data changes were found.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <div className="hidden grid-cols-[minmax(8rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] bg-muted/60 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:grid">
            <span className="p-2.5">Field</span>
            <span className="border-l border-border p-2.5">Current</span>
            <span className="border-l border-border p-2.5">Proposed</span>
          </div>
          {differences.map(({ field, current, proposed }) => (
            <div
              key={field}
              className="border-t border-border first:border-t-0 sm:grid sm:grid-cols-[minmax(8rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <div className="bg-muted/30 p-2.5 text-xs font-semibold sm:bg-transparent">
                {formatFieldName(field)}
              </div>
              <div className="grid grid-cols-2 sm:contents">
                <div className="min-w-0 border-r border-border bg-destructive/[0.035] p-2.5 sm:border-l sm:border-r-0">
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground sm:hidden">
                    Current
                  </p>
                  <ReviewValuePreview
                    field={field}
                    value={submission.change_kind === "create" ? undefined : current}
                  />
                </div>
                <div className="min-w-0 bg-emerald-500/[0.055] p-2.5 sm:border-l sm:border-border">
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground sm:hidden">
                    Proposed
                  </p>
                  <ReviewValuePreview field={field} value={proposed} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

function ReviewValuePreview({ field, value }: { field: string; value: ReviewValue }) {
  if (isEmptyReviewValue(value)) {
    return <span className="text-xs italic text-muted-foreground">Not set</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-xs">{value ? "Yes" : "No"}</span>;
  }

  if (typeof value === "number") {
    return <span className="text-xs tabular-nums">{value}</span>;
  }

  if (typeof value === "string") {
    if (field.endsWith("logo_url") && isWebUrl(value)) {
      return (
        <div className="flex items-center gap-2">
          <img
            src={value}
            alt="Proposed business logo"
            className="h-10 w-10 rounded-lg border object-cover"
          />
          <ExternalValueLink value={value} label="View logo" />
        </div>
      );
    }

    if (field.includes("color") && /^#[0-9a-f]{3,8}$/i.test(value)) {
      return (
        <span className="flex items-center gap-2 text-xs">
          <span
            className="h-5 w-5 shrink-0 rounded-full border"
            style={{ backgroundColor: value }}
          />
          {value}
        </span>
      );
    }

    if (isWebUrl(value)) return <ExternalValueLink value={value} />;

    return <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{value}</p>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0)
      return <span className="text-xs italic text-muted-foreground">None</span>;

    return (
      <div className="space-y-1.5">
        {value.map((item, index) => (
          <div
            key={reviewItemKey(item, index)}
            className="rounded-md border bg-background/70 p-2 text-[11px]"
          >
            <StructuredReviewValue field={field} value={item} index={index} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-[10px] text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function StructuredReviewValue({
  field,
  value,
  index,
}: {
  field: string;
  value: Json;
  index: number;
}) {
  if (!isJsonObject(value)) return <span>{String(value)}</span>;

  if (field === "locations") {
    const address = [value.address_line1, value.city, value.country].filter(Boolean).join(", ");
    return (
      <div>
        <p className="font-semibold">{String(value.name || `Location ${index + 1}`)}</p>
        {address && <p className="mt-0.5 text-muted-foreground">{address}</p>}
      </div>
    );
  }

  if (field === "socials") {
    const url = typeof value.url === "string" ? value.url : "";
    return (
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="font-semibold capitalize">{String(value.platform || "Social link")}</span>
        {isWebUrl(url) && <ExternalValueLink value={url} label="Open" />}
      </div>
    );
  }

  if (field.endsWith("rewards")) {
    const label = value.label ?? value.title ?? value.name ?? `Reward ${index + 1}`;
    const step = value.step ?? value.required_steps ?? value.stamps;
    return (
      <p>
        {step !== undefined && <span className="font-semibold">Step {String(step)} · </span>}
        {String(label)}
      </p>
    );
  }

  return <pre className="whitespace-pre-wrap break-words">{JSON.stringify(value, null, 2)}</pre>;
}

function ExternalValueLink({ value, label }: { value: string; label?: string }) {
  let hostname = "Open link";
  try {
    hostname = new URL(value).hostname.replace(/^www\./, "");
  } catch {
    // URL was already validated by the caller.
  }

  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="break-all text-xs font-medium text-primary underline-offset-2 hover:underline"
    >
      {label ?? hostname}
    </a>
  );
}

function flattenReviewData(
  value: Json | null,
  prefix = "",
  result = new Map<string, ReviewValue>(),
) {
  if (!isJsonObject(value)) return result;

  Object.entries(value).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isJsonObject(child)) {
      flattenReviewData(child, path, result);
    } else {
      result.set(path, child);
    }
  });

  return result;
}

function formatFieldName(field: string) {
  const withoutEntity = field.replace(/^(business|card)\./, "");
  return withoutEntity
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" · ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isJsonObject(value: ReviewValue): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmptyReviewValue(value: ReviewValue) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isWebUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function stableJson(value: ReviewValue): string {
  if (value === undefined) return "__undefined__";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isJsonObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function reviewItemKey(value: Json, index: number) {
  if (isJsonObject(value) && typeof value.id === "string") return value.id;
  if (isJsonObject(value) && typeof value.platform === "string")
    return `${value.platform}-${index}`;
  return `${stableJson(value)}-${index}`;
}
