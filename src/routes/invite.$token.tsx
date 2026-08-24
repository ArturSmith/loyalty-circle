import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ScreenLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/utils/members.functions";
import { CheckCircle2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Team invitation — ClubCarder" }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const accept = useServerFn(acceptInvite);
  const [state, setState] = useState<
    { kind: "working" } | { kind: "ok"; businessName: string } | { kind: "error"; message: string }
  >({ kind: "working" });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        // Come back here once signed in, otherwise the token is lost.
        navigate({ to: "/auth", search: { redirect: `/invite/${token}` } });
        return;
      }
      try {
        const result = await accept({ data: { token } });
        setState(
          result.status === "accepted"
            ? { kind: "ok", businessName: result.businessName }
            : { kind: "error", message: result.message },
        );
      } catch (error) {
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "Something went wrong.",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (state.kind === "working") return <ScreenLoader />;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border-2 border-ink/10 bg-card p-7 text-center">
        {state.kind === "ok" ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="mt-4 font-display text-2xl font-semibold">You're in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You now have administrator access to {state.businessName}.
            </p>
            <Button className="mt-6 h-11 w-full" onClick={() => navigate({ to: "/business" })}>
              Open dashboard
            </Button>
          </>
        ) : (
          <>
            <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Invitation problem</h1>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
            <Button
              variant="outline"
              className="mt-6 h-11 w-full"
              onClick={() => navigate({ to: "/wallet" })}
            >
              Go to my wallet
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
