import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";
import { TabScreen } from "@/components/TabScreen";
import { getConversations } from "@/utils/chats.functions";
import type { ChatConversation } from "@/utils/chats.functions";

export const Route = createFileRoute("/_authenticated/chats/")({
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
  component: ChatsList,
});

// Kept between tab switches so returning to Chats renders instantly.
let cachedConversations: ChatConversation[] | null = null;

function timeLabel(iso: string) {
  const date = new Date(iso);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { day: "numeric", month: "short" });
}

function ChatsList() {
  const load = useServerFn(getConversations);
  const [conversations, setConversations] = useState<ChatConversation[]>(() => cachedConversations ?? []);
  const [loading, setLoading] = useState(() => cachedConversations === null);

  useEffect(() => {
    let alive = true;
    load({})
      .then((result) => {
        if (!alive) return;
        cachedConversations = result.conversations;
        setConversations(result.conversations);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TabScreen title="Chats" contentClassName="flex flex-1 flex-col">
      {loading ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-secondary">
            <MessageCircle className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-6 font-display text-xl font-bold">No chats yet</h2>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Add a loyalty card to your wallet and the business will say hello here.
          </p>
        </div>
      ) : (
        <ul className="mx-auto w-full max-w-3xl divide-y divide-border">
          {conversations.map((conversation) => {
            const title =
              conversation.viewer_role === "business"
                ? conversation.customer_name ?? "Customer"
                : conversation.business.name;
            return (
              <li key={conversation.id}>
                <Link
                  to="/chats/$conversationId"
                  params={{ conversationId: conversation.id }}
                  className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-secondary/60"
                >
                  {conversation.business.logo_url ? (
                    <img
                      src={conversation.business.logo_url}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                      {title.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium">{title}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeLabel(conversation.last_message_at)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {conversation.last_message ?? "No messages yet"}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </TabScreen>
  );
}
