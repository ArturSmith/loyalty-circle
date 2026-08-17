import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { TabScreen } from "@/components/TabScreen";

export const Route = createFileRoute("/_authenticated/chats")({
  head: () => ({
    meta: [
      { title: "Chats — ClubCarder" },
      { name: "description", content: "Message the businesses whose loyalty cards you collect on ClubCarder." },
      { property: "og:title", content: "Chats — ClubCarder" },
      { property: "og:description", content: "Message the businesses whose loyalty cards you collect." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Chats,
});

function Chats() {
  return (
    <TabScreen title="Chats" contentClassName="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-secondary">
          <MessageCircle className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-6 font-display text-xl font-bold">No chats yet</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Soon you'll be able to message the businesses you collect cards from.
        </p>
      </div>
    </TabScreen>
  );
}
