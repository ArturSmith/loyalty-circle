import { createFileRoute } from "@tanstack/react-router";
import { CardWizard } from "@/components/CardWizard";
import { z } from "zod";
import { BusinessPermissionGate } from "@/components/business/BusinessPermissionGate";

export const Route = createFileRoute("/_authenticated/business/cards/new")({
  head: () => ({ meta: [{ title: "New card — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: NewCard,
});

function NewCard() {
  const { businessId } = Route.useSearch();
  return (
    <BusinessPermissionGate businessId={businessId} permission="cards.manage">
      <CardWizard businessId={businessId} />
    </BusinessPermissionGate>
  );
}
