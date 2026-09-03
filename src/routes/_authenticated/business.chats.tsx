import { createFileRoute, Link } from "@tanstack/react-router";
import { PageLoader } from "@/components/Spinner";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getConversations } from "@/utils/chats.functions";
import { publishUnreadChatCount } from "@/hooks/useUnreadChatCount";
import type { ChatConversation } from "@/utils/chats.functions";
import { z } from "zod";
import { BusinessPermissionGate } from "@/components/business/BusinessPermissionGate";
import { getNavigationCache, setNavigationCache } from "@/lib/navigationCache";

export const Route = createFileRoute("/_authenticated/business/chats")({
  head: () => ({
    meta: [
      { title: "Customer messages — ClubCarder" },
      { name: "description", content: "Reply to the customers who collect your loyalty cards." },
      { property: "og:title", content: "Customer messages — ClubCarder" },
      { property: "og:description", content: "Reply to the customers who collect your loyalty cards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: BusinessChats,
});

function timeLabel(iso: string) {
  const date = new Date(iso);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { day: "numeric", month: "short" });
}

function BusinessChats() {
  const { businessId } = Route.useSearch();
  return (
    <BusinessPermissionGate businessId={businessId} permission="customers.message">
      <BusinessChatsContent />
    </BusinessPermissionGate>
  );
}

function BusinessChatsContent() {
  const { businessId } = Route.useSearch();
  const cacheKey = `business-chats:${businessId}`;
  const cached = getNavigationCache<ChatConversation[]>(cacheKey);
  const load = useServerFn(getConversations);
  const [conversations, setConversations] = useState<ChatConversation[]>(() => cached?.value ?? []);
  const [loading, setLoading] = useState(() => cached === null);

  useEffect(() => {
    let alive = true;
    load({ data: { scope: "business", businessId } })
      .then((result) => {
        if (!alive) return;
        setNavigationCache(cacheKey, result.conversations);
        setConversations(result.conversations);
        publishUnreadChatCount(
          result.conversations.reduce((n, c) => n + c.unread_count, 0),
          "business",
        );
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, cacheKey, load]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="tab-screen-header sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex min-h-[56px] w-full max-w-3xl items-center gap-3 px-3 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Back to dashboard">
            <Link to="/business" search={{ businessId }}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="min-w-0 truncate font-display text-2xl font-semibold">Messages</h1>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {loading ? (
          <PageLoader />
        ) : conversations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-secondary">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mt-6 font-display text-xl font-bold">No messages yet</h2>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              When someone adds one of your cards, their conversation starts here.
            </p>
          </div>
        ) : (
          <ul className="mx-auto w-full max-w-3xl divide-y divide-border">
            {conversations.map((conversation) => {
              const title = conversation.customer_name ?? "Customer";
              return (
                <li key={conversation.id}>
                  <Link
                    to="/chats/$conversationId"
                    params={{ conversationId: conversation.id }}
                    search={{ scope: "business", businessId }}
                    aria-label={
                      conversation.unread_count > 0
                        ? `${title}, ${conversation.unread_count} unread`
                        : title
                    }
                    className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-secondary/60"
                  >
                    {conversation.customer_avatar_url ? (
                      <img
                        src={conversation.customer_avatar_url}
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
                      <div className="flex items-center gap-2">
                        <p
                          className={`truncate text-sm ${
                            conversation.unread_count > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {conversation.last_message ?? "No messages yet"}
                        </p>
                        {conversation.unread_count > 0 && (
                          <span
                            aria-hidden
                            className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-none text-primary-foreground"
                          >
                            {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
