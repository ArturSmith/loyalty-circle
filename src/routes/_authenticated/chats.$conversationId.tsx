import { createFileRoute, Link } from "@tanstack/react-router";
import { PageLoader } from "@/components/Spinner";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Send } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getConversation, markChatRead, sendChatMessage } from "@/utils/chats.functions";
import { invalidateUnreadChatCount } from "@/hooks/useUnreadChatCount";
import type { ChatMessage } from "@/utils/chats.functions";
import { BusinessPermissionGate } from "@/components/business/BusinessPermissionGate";
import { getNavigationCache, setNavigationCache } from "@/lib/navigationCache";

type ConversationCache = {
  title: string;
  logo: string | null;
  viewerRole: "business" | "customer";
  publicBusinessId: string | null;
  customerActivity: { customerId: string; cardId: string } | null;
  messages: ChatMessage[];
};

// Which side the reader is acting as. Carried in the URL so the same screen can
// serve a customer's chat and a business inbox thread without guessing — and so
// that a shared or bookmarked link keeps its meaning.
const searchSchema = z
  .object({ scope: z.enum(["customer", "business"]).optional(), businessId: z.string().uuid().optional() })
  .catch({ scope: undefined });

export const Route = createFileRoute("/_authenticated/chats/$conversationId")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Conversation — ClubCarder" },
      { name: "description", content: "Chat directly with the business behind your ClubCarder loyalty card." },
      { property: "og:title", content: "Conversation — ClubCarder" },
      { property: "og:description", content: "Chat directly with the business behind your loyalty card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConversationAccess,
});

function ConversationAccess() {
  const { scope: scopeParam, businessId } = Route.useSearch();
  if ((scopeParam ?? "customer") === "business" && businessId) {
    return (
      <BusinessPermissionGate businessId={businessId} permission="customers.message">
        <ConversationPage />
      </BusinessPermissionGate>
    );
  }
  return <ConversationPage />;
}

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { scope: scopeParam, businessId } = Route.useSearch();
  const scope = scopeParam ?? "customer";
  const load = useServerFn(getConversation);
  const send = useServerFn(sendChatMessage);
  const markRead = useServerFn(markChatRead);
  const cacheKey = `conversation:${scope}:${businessId ?? "customer"}:${conversationId}`;
  const cached = getNavigationCache<ConversationCache>(cacheKey)?.value;

  const [title, setTitle] = useState(() => cached?.title ?? "Chat");
  const [logo, setLogo] = useState<string | null>(() => cached?.logo ?? null);
  const [viewerRole, setViewerRole] = useState<"business" | "customer">(
    () => cached?.viewerRole ?? "customer",
  );
  const [publicBusinessId, setPublicBusinessId] = useState<string | null>(
    () => cached?.publicBusinessId ?? null,
  );
  const [customerActivity, setCustomerActivity] = useState<{
    customerId: string;
    cardId: string;
  } | null>(() => cached?.customerActivity ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => cached?.messages ?? []);
  const [loading, setLoading] = useState(() => !cached);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const snapshot = getNavigationCache<ConversationCache>(cacheKey)?.value;
    if (snapshot) {
      setTitle(snapshot.title);
      setLogo(snapshot.logo);
      setViewerRole(snapshot.viewerRole);
      setPublicBusinessId(snapshot.publicBusinessId);
      setCustomerActivity(snapshot.customerActivity);
      setMessages(snapshot.messages);
      setLoading(false);
    } else {
      setTitle("Chat");
      setLogo(null);
      setViewerRole("customer");
      setPublicBusinessId(null);
      setCustomerActivity(null);
      setMessages([]);
      setLoading(true);
    }
    load({ data: { conversationId, scope } })
      .then((result) => {
        if (!alive) return;
        // Each side sees the *other* party. A business owner looking at this
        // conversation should see the customer, not their own logo.
        const isBusinessViewer = result.viewer_role === "business";
        setTitle(isBusinessViewer ? result.customer_name ?? "Customer" : result.business.name);
        setLogo(isBusinessViewer ? result.customer_avatar_url : result.business.logo_url);
        setViewerRole(result.viewer_role);
        setPublicBusinessId(result.business.id);
        setCustomerActivity(
          isBusinessViewer && result.customer_id && result.customer_activity_card_id
            ? { customerId: result.customer_id, cardId: result.customer_activity_card_id }
            : null,
        );
        setMessages(result.messages);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));

    // Opening the conversation is what reading it means.
    void markRead({ data: { conversationId, scope } }).then(() => invalidateUnreadChatCount(scope));

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          // The user is looking at this conversation, so anything arriving now
          // has been read. Clear it before the badge ever counts it.
          void markRead({ data: { conversationId, scope } }).then(() => invalidateUnreadChatCount(scope));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, conversationId, scope]);

  useEffect(() => {
    if (loading) return;
    setNavigationCache<ConversationCache>(cacheKey, {
      title,
      logo,
      viewerRole,
      publicBusinessId,
      customerActivity,
      messages,
    });
  }, [cacheKey, customerActivity, loading, logo, messages, publicBusinessId, title, viewerRole]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading, conversationId]);

  const submit = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const result = await send({ data: { conversationId, body: text, scope } });
      setBody("");
      setMessages((prev) => (prev.some((m) => m.id === result.message.id) ? prev : [...prev, result.message]));
    } catch {
      // keep the draft so the user can retry
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const counterparty = (
    <>
      {logo ? (
        <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
          {title.slice(0, 1).toUpperCase()}
        </span>
      )}
      <h1 className="min-w-0 truncate font-display text-lg font-semibold">{title}</h1>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex min-h-[56px] w-full max-w-3xl items-center gap-3 px-3 py-3">
          <Button variant="ghost" size="icon" asChild aria-label={scope === "business" ? "Back to inbox" : "Back to chats"}>
            <Link
              to={scope === "business" ? "/business/chats" : "/chats"}
              search={scope === "business" && businessId ? { businessId } : {}}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          {scope === "customer" && publicBusinessId ? (
            <Link
              to="/b/$businessId"
              params={{ businessId: publicBusinessId }}
              className="flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Open ${title} business page`}
            >
              {counterparty}
            </Link>
          ) : scope === "business" && businessId && customerActivity ? (
            <Link
              to="/business/cards/$id/customers/$customerId"
              params={{ id: customerActivity.cardId, customerId: customerActivity.customerId }}
              search={{ businessId, from: "messages", conversationId }}
              className="flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Open ${title} customer activity`}
            >
              {counterparty}
            </Link>
          ) : (
            <div className="flex min-w-0 items-center gap-3">{counterparty}</div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-5">
        {loading ? (
          <PageLoader />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet — say hello.</p>
        ) : (
          messages.map((message) => {
            const mine = message.sender_role === viewerRole;
            return (
              <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[80%]">
                  <div
                    className={
                      "rounded-2xl px-4 py-2.5 text-sm " +
                      (mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")
                    }
                  >
                    <p data-i18n-ignore className="whitespace-pre-wrap break-words">{message.body}</p>
                  </div>
                  <p className={"mt-1 text-[10px] text-muted-foreground " + (mine ? "text-right" : "text-left")}>
                    {new Date(message.created_at).toLocaleString([], {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </main>

      <div
        className="sticky bottom-0 border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3">
          <Textarea
            ref={inputRef}
            rows={1}
            value={body}
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Write a message…"
            className="max-h-32 min-h-[44px] resize-none"
          />
          <Button onClick={submit} disabled={sending || body.trim().length === 0} size="icon" aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
