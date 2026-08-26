import { createFileRoute } from "@tanstack/react-router";
import { CardWizard } from "@/components/CardWizard";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/business/cards/new")({
  head: () => ({ meta: [{ title: "New card — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: NewCard,
});

function NewCard() {
  return <CardWizard businessId={Route.useSearch().businessId} />;
}
