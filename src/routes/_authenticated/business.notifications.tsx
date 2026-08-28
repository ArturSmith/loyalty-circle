import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { BackButton } from "@/components/BackButton";
import { NotificationsInbox } from "@/components/NotificationsInbox";
import { TabScreen } from "@/components/TabScreen";

export const Route = createFileRoute("/_authenticated/business/notifications")({
  head: () => ({ meta: [{ title: "Business notifications — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: BusinessNotifications,
});

function BusinessNotifications() {
  const navigate = useNavigate();
  const { businessId } = Route.useSearch();
  return (
    <TabScreen
      title="Notifications"
      subtitle="Platform reviews and updates for this business."
      backAction={
        <BackButton
          label="Back to business dashboard"
          onClick={() => navigate({ to: "/business", search: { businessId } })}
        />
      }
      contentClassName="flex-1 px-5 py-6"
    >
      <div className="mx-auto w-full max-w-2xl">
        <NotificationsInbox scope="business" businessId={businessId} />
      </div>
    </TabScreen>
  );
}
