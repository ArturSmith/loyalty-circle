import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScreenLoader, Spinner } from "@/components/Spinner";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Gift, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  amIAdmin,
  listBusinessesForAdmin,
  setAdminByEmail,
  setBusinessComped,
  type AdminBusiness,
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

  const [admin, setAdminState] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AdminBusiness[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

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

  useEffect(() => {
    checkAdmin({})
      .then((r) => {
        setAdminState(r.admin);
        if (r.admin) load("");
      })
      .catch(() => setAdminState(false));
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
          Give a business free access — it works exactly like a paid plan, with no payment required.
        </p>

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
