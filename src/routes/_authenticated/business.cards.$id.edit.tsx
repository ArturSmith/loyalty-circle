import { createFileRoute } from "@tanstack/react-router";
import { CardWizard } from "@/components/CardWizard";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/business/cards/$id/edit")({
  head: () => ({ meta: [{ title: "Edit card — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: EditCard,
});

function EditCard() {
  const { id } = Route.useParams();
  return <CardWizard templateId={id} businessId={Route.useSearch().businessId} />;
}
