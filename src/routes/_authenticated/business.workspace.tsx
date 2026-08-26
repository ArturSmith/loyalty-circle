import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, MessageCircle } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/business/workspace")({
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: BusinessWorkspace,
});

function BusinessWorkspace() {
  const { businessId } = Route.useSearch();
  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-6">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Business</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold">Workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">Work with the people who run this business.</p>
      <div className="mt-6 space-y-3">
        <Link to="/business/team" search={{ businessId }} className="block">
          <Button variant="outline" className="h-12 w-full justify-start gap-3"><Users className="h-5 w-5" /> Team members</Button>
        </Link>
        <Link to="/business/chats" className="block">
          <Button variant="outline" className="h-12 w-full justify-start gap-3"><MessageCircle className="h-5 w-5" /> Messages</Button>
        </Link>
      </div>
      <Link to="/business" search={{ businessId }} className="mt-6 block text-center text-sm text-primary">Back to dashboard</Link>
    </main>
  );
}
