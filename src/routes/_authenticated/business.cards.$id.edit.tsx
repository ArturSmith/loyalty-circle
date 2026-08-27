import { createFileRoute } from "@tanstack/react-router";
import { CardWizard } from "@/components/CardWizard";
import { z } from "zod";
import { BusinessPermissionGate } from "@/components/business/BusinessPermissionGate";

export const Route = createFileRoute("/_authenticated/business/cards/$id/edit")({
  head: () => ({ meta: [{ title: "Edit card — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: EditCard,
});

function EditCard() {
  const { id } = Route.useParams();
  const { businessId } = Route.useSearch();
  return (
    <BusinessPermissionGate businessId={businessId} permission="cards.manage">
      <CardWizard templateId={id} businessId={businessId} />
    </BusinessPermissionGate>
  );
}
