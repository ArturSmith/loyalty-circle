import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BackButton } from "@/components/BackButton";
import { ScreenLoader } from "@/components/Spinner";
import { TeamChat } from "@/components/business/TeamChat";
import { TeamManagement } from "@/components/business/TeamManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusinessPermissions } from "@/hooks/useBusinessPermissions";

export const Route = createFileRoute("/_authenticated/business/team")({
  head: () => ({ meta: [{ title: "My team — ClubCarder Business" }] }),
  validateSearch: z.object({
    businessId: z.string().uuid(),
    view: z.enum(["chat", "members"]).optional(),
  }),
  component: TeamPage,
});

function TeamPage() {
  const { businessId, view } = Route.useSearch();
  return <MyTeam key={businessId} businessId={businessId} view={view} />;
}

function MyTeam({ businessId, view }: { businessId: string; view?: "chat" | "members" }) {
  const navigate = useNavigate();
  const permissions = useBusinessPermissions(businessId);

  if (permissions.loading) return <ScreenLoader />;
  if (!permissions.role) return <Navigate to="/workspace" replace />;

  // Management never mounts for administrators, including with a manually edited URL.
  const activeView = permissions.isOwner && view === "members" ? "members" : "chat";

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-background">
      <Tabs
        value={activeView}
        onValueChange={(value) =>
          navigate({
            to: "/business/team",
            search: { businessId, view: value === "members" ? "members" : "chat" },
            replace: true,
          })
        }
        className="flex min-h-0 flex-1 flex-col"
      >
        <header
          className="z-30 shrink-0 border-b border-border bg-card/95 backdrop-blur"
          style={{
            paddingTop: "var(--safe-top)",
            paddingLeft: "var(--safe-left)",
            paddingRight: "var(--safe-right)",
          }}
        >
          <div className="mx-auto flex min-h-[56px] w-full max-w-3xl items-center gap-3 px-5 py-3">
            <BackButton
              label="Back to business dashboard"
              onClick={() => navigate({ to: "/business", search: { businessId } })}
            />
            <h1 className="truncate font-display text-2xl font-semibold">My team</h1>
          </div>
          {permissions.isOwner && (
            <div className="mx-auto w-full max-w-3xl px-5 pb-3">
              <TabsList className="grid h-auto w-full grid-cols-2">
                <TabsTrigger value="chat" className="whitespace-normal">
                  Chat
                </TabsTrigger>
                <TabsTrigger value="members" className="whitespace-normal">
                  Members & permissions
                </TabsTrigger>
              </TabsList>
            </div>
          )}
        </header>

        <TabsContent
          value="chat"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <TeamChat businessId={businessId} />
        </TabsContent>
        {permissions.isOwner && (
          <TabsContent
            value="members"
            className="mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain"
            style={{
              paddingBottom: "var(--safe-bottom)",
              paddingLeft: "var(--safe-left)",
              paddingRight: "var(--safe-right)",
            }}
          >
            <TeamManagement businessId={businessId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
