import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BackButton } from "@/components/BackButton";
import { NotificationsInbox } from "@/components/NotificationsInbox";
import { TabScreen } from "@/components/TabScreen";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — ClubCarder" }] }),
  component: CustomerNotifications,
});

function CustomerNotifications() {
  const navigate = useNavigate();
  return (
    <TabScreen
      title="Notifications"
      subtitle="Updates about your loyalty cards and rewards."
      backAction={
        <BackButton label="Back to profile" onClick={() => navigate({ to: "/profile" })} />
      }
      contentClassName="flex-1 px-5 py-6"
    >
      <div className="mx-auto w-full max-w-2xl">
        <NotificationsInbox scope="customer" />
      </div>
    </TabScreen>
  );
}
