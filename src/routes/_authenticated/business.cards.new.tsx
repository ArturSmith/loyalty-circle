import { createFileRoute } from "@tanstack/react-router";
import { CardWizard } from "@/components/CardWizard";

export const Route = createFileRoute("/_authenticated/business/cards/new")({
  head: () => ({ meta: [{ title: "New card — ClubCarder" }] }),
  component: () => <CardWizard />,
});
