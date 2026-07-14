import { createFileRoute } from "@tanstack/react-router";
import { CardWizard } from "@/components/CardWizard";

export const Route = createFileRoute("/_authenticated/business/cards/$id/edit")({
  head: () => ({ meta: [{ title: "Edit card — Stempel" }] }),
  component: EditCard,
});

function EditCard() {
  const { id } = Route.useParams();
  return <CardWizard templateId={id} />;
}
