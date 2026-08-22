import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ArrowLeft, Search, ScanLine, UserX, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/Spinner";
import { findCustomer } from "@/utils/customers.functions";
import type { CustomerLookupResult } from "@/utils/customers.functions";
import { MIN_CODE_LENGTH, shortCustomerCode } from "@/lib/customer-code";
import { resolveAvatarUrl } from "@/lib/avatar";

export const Route = createFileRoute("/_authenticated/business/customers")({
  head: () => ({ meta: [{ title: "Find a customer — ClubCarder" }] }),
  // `q` lets the scanner hand off a result by navigating here, so the scanned
  // and typed paths converge on one screen.
  validateSearch: z.object({ q: z.string().optional() }),
  component: FindCustomer,
});

function FindCustomer() {
  const navigate = useNavigate();
  const { q } = Route.useSearch();
  const lookup = useServerFn(findCustomer);

  const [input, setInput] = useState(q ?? "");
  const [result, setResult] = useState<CustomerLookupResult | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query) return;
      setBusy(true);
      setResult(null);
      setAvatar(null);
      try {
        const found = await lookup({ data: { query } });
        setResult(found);
        if (found.status === "found" && found.customer.avatar_url) {
          setAvatar(await resolveAvatarUrl(found.customer.avatar_url));
        }
      } catch {
        setResult({ status: "not_found" });
      } finally {
        setBusy(false);
      }
    },
    [lookup],
  );

  // Run automatically when arriving from the scanner.
  useEffect(() => {
    if (q) void run(q);
  }, [q, run]);

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/business" })} className="rounded-full glass-panel">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-2xl font-semibold">Find a customer</h1>
      </header>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          void run(input);
        }}
      >
        <label htmlFor="code" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Customer code
        </label>
        <div className="mt-2 flex gap-2">
          <Input
            id="code"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="A1B2-C3D4"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="font-mono tracking-wider"
          />
          <Button type="submit" disabled={busy || input.trim().length === 0} className="shrink-0 gap-2">
            {busy ? <Spinner size={16} label={null} className="text-primary-foreground" /> : <Search className="h-4 w-4" />}
            Find
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Type the code from their profile, or scan their QR instead.
        </p>
      </form>

      <Link to="/business/scan" className="mt-3 block">
        <Button variant="outline" className="w-full gap-2">
          <ScanLine className="h-4 w-4" /> Scan customer QR
        </Button>
      </Link>

      {result && (
        <div className="mt-8">
          {result.status === "found" ? (
            <>
              <div className="flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-card p-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (result.customer.display_name ?? "?").slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{result.customer.display_name ?? "Customer"}</p>
                  <p className="font-mono text-xs text-muted-foreground">{shortCustomerCode(result.customer.id)}</p>
                </div>
              </div>

              <h2 className="mt-6 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Cards with you
              </h2>
              <div className="mt-2 space-y-2">
                {result.cards.map((card) => (
                  <Link
                    key={card.instance_id}
                    to="/business/cards/$id/customers/$customerId"
                    params={{ id: card.template_id, customerId: result.customer.id }}
                    className="flex items-center gap-3 rounded-2xl border-2 border-ink/10 bg-card p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{card.title}</p>
                      {card.completed_at && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 font-display text-lg leading-none">
                      {card.stamps_count}
                      <span className="text-sm text-muted-foreground">/{card.total_steps}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
              <UserX className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">
                {result.status === "ambiguous"
                  ? "More than one match"
                  : result.status === "invalid"
                    ? "Code too short"
                    : "No customer found"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.status === "ambiguous"
                  ? `${result.matches} of your customers share this code. Type a few more characters, or scan their QR.`
                  : result.status === "invalid"
                    ? `Enter at least ${MIN_CODE_LENGTH} characters of their code.`
                    : "Nobody with this code holds one of your cards."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
