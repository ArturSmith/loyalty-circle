import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { claimAnonymousCard, getClaimPreview } from "@/utils/wallet.functions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { OrnamentDivider } from "@/components/OrnamentDivider";
import { invalidateTabCache } from "@/lib/tabCache";

type Search = { s?: string };

export const Route = createFileRoute("/claim/$instanceId")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    s: typeof search["s"] === "string" ? search["s"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Save your loyalty card — ClubCarder" },
      {
        name: "description",
        content: "Attach the loyalty card from your phone wallet to a ClubCarder account so you never lose it.",
      },
      { property: "og:title", content: "Save your loyalty card — ClubCarder" },
      {
        property: "og:description",
        content: "Attach the loyalty card from your phone wallet to a ClubCarder account so you never lose it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClaimPage,
});

type Status = "loading" | "needs-auth" | "claiming" | "done" | "error";

function ClaimPage() {
  const { instanceId } = Route.useParams();
  const { s } = Route.useSearch();
  const navigate = useNavigate();
  const preview = useServerFn(getClaimPreview);
  const claim = useServerFn(claimAnonymousCard);

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [cardName, setCardName] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const secret = s ?? "";
      try {
        const info = await preview({ data: { instanceId, secret } });
        setCardName([info.businessName, info.title].filter(Boolean).join(" · ") || null);

        if (info.alreadyClaimed) {
          setStatus("error");
          setMessage("This card is already saved to an account.");
          return;
        }
        if (!info.valid) {
          setStatus("error");
          setMessage("This claim link is not valid anymore.");
          return;
        }

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setStatus("needs-auth");
          return;
        }

        setStatus("claiming");
        await claim({ data: { instanceId, secret } });
        invalidateTabCache("wallet");
        setStatus("done");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Something went wrong.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId, s]);

  const signIn = () => {
    navigate({ to: "/auth", search: { redirect: `/claim/${instanceId}?s=${s ?? ""}` } });
  };

  return (
    <div className="min-h-screen px-4 py-16">
      <div className="mx-auto max-w-sm rounded-3xl bg-card p-8 text-center card-shadow">
        <OrnamentDivider className="w-40 mx-auto opacity-70" />

        {status === "loading" || status === "claiming" ? (
          <>
            <Spinner size={40} className="mx-auto mt-6" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Saving your card…</h1>
          </>
        ) : null}

        {status === "needs-auth" ? (
          <>
            <h1 className="mt-6 font-display text-2xl font-semibold">Keep this card forever</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {cardName ? `${cardName} — s` : "S"}ign in and this card, with all its stamps, moves to your
              ClubCarder account.
            </p>
            <Button className="mt-6 w-full h-11" onClick={signIn}>
              Sign in to save it
            </Button>
          </>
        ) : null}

        {status === "done" ? (
          <>
            <CheckCircle2 className="mx-auto mt-6 h-12 w-12 text-primary" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Card saved</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {cardName ?? "Your card"} is now in your ClubCarder account.
            </p>
            <Button className="mt-6 w-full h-11" onClick={() => navigate({ to: "/wallet" })}>
              Open my cards
            </Button>
          </>
        ) : null}

        {status === "error" ? (
          <>
            <XCircle className="mx-auto mt-6 h-12 w-12 text-destructive" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Couldn't save the card</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <Button className="mt-6 w-full h-11" onClick={() => navigate({ to: "/" })}>
              Go to ClubCarder
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
