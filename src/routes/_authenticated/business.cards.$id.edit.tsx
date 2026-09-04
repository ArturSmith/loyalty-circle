import { createFileRoute, Link } from "@tanstack/react-router";
import { CardWizard } from "@/components/CardWizard";
import { z } from "zod";
import { BusinessPermissionGate } from "@/components/business/BusinessPermissionGate";
import { CARD_IN_USE_MESSAGE, useCardEditability } from "@/hooks/useCardEditability";
import { ScreenLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";

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
      <EditableCard id={id} businessId={businessId} />
    </BusinessPermissionGate>
  );
}

function EditableCard({ id, businessId }: { id: string; businessId: string }) {
  const { canEdit, error } = useCardEditability(id);
  if (canEdit === null && !error) return <ScreenLoader />;
  if (canEdit !== true) return (
    <div className="max-w-lg mx-auto px-5 py-8 space-y-5">
      <p role="alert">{error ?? CARD_IN_USE_MESSAGE}</p>
      <Button asChild variant="outline">
        <Link to="/business/cards/$id" params={{ id }} search={{ businessId }}>Back to card</Link>
      </Button>
    </div>
  );
  return <CardWizard templateId={id} businessId={businessId} />;
}
