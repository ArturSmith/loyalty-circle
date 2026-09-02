import { createFileRoute, Navigate } from "@tanstack/react-router";
import { z } from "zod";

// Keep existing chat bookmarks working after consolidating the team screens.
export const Route = createFileRoute("/_authenticated/business/workspace")({
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: LegacyTeamPage,
});

function LegacyTeamPage() {
  const { businessId } = Route.useSearch();
  return <Navigate to="/business/team" search={{ businessId }} replace />;
}
