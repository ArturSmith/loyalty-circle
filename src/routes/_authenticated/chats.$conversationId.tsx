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

// Which side the reader is acting as. Carried in the URL so the same screen can
// serve a customer's chat and a business inbox thread without guessing — and so
// that a shared or bookmarked link keeps its meaning.
const searchSchema = z
  .object({ scope: z.enum(["customer", "business"]).optional() })
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
  component: ConversationPage,
});

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { scope: scopeParam } = Route.useSearch();
  const scope = scopeParam ?? "customer";
  const load = useServerFn(getConversation);
  const send = useServerFn(sendChatMessage);
  const markRead = useServerFn(markChatRead);

  const [title, setTitle] = useState("Chat");
  const [logo, setLogo] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<"business" | "customer">("customer");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load({ data: { conversationId, scope } })
      .then((result) => {
        if (!alive) return;
        setTitle(result.viewer_role === "business" ? result.customer_name ?? "Customer" : result.business.name);
        setLogo(result.business.logo_url);
        setViewerRole(result.viewer_role);
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
  }, [conversationId, scope]);

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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex min-h-[56px] w-full max-w-3xl items-center gap-3 px-3 py-3">
          <Button variant="ghost" size="icon" asChild aria-label={scope === "business" ? "Back to inbox" : "Back to chats"}>
            <Link to={scope === "business" ? "/business/chats" : "/chats"}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          {logo ? <img src={logo} alt="" className="h-9 w-9 rounded-full object-cover" /> : null}
          <h1 className="min-w-0 truncate font-display text-lg font-semibold">{title}</h1>
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
                <div
                  className={
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm " +
                    (mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")
                  }
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p className={"mt-1 text-[10px] " + (mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
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
