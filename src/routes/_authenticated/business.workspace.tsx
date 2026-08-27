import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Users } from "lucide-react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/Spinner";
import { getTeamMembers, getTeamThread, sendTeamMessage } from "@/utils/team-chat.functions";
import { toast } from "sonner";

type Member = { id: string; name: string | null; avatarUrl: string | null; role: "owner" | "admin" };
type Message = { id: string; body: string; createdAt: string; senderId: string; senderName: string | null; senderAvatarUrl: string | null; isMine: boolean };

export const Route = createFileRoute("/_authenticated/business/workspace")({
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: TeamChat,
});

function TeamChat() {
  const { businessId } = Route.useSearch();
  const membersFn = useServerFn(getTeamMembers);
  const threadFn = useServerFn(getTeamThread);
  const sendFn = useServerFn(sendTeamMessage);

  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [threadLoading, setThreadLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void membersFn({ data: { businessId } }).then(setMembers);
  }, [businessId, membersFn]);

  useEffect(() => {
    setThreadLoading(true);
    setMessages([]);
    void threadFn({ data: { businessId, memberId: selected ?? undefined } })
      .then((r) => {
        setThreadId(r.threadId);
        setMessages(r.messages);
      })
      .catch(() => toast.error("Could not load this conversation."))
      .finally(() => setThreadLoading(false));
  }, [businessId, selected, threadFn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, selected, threadLoading]);

  useEffect(() => {
    if (!threadLoading) inputRef.current?.focus();
  }, [threadLoading, selected]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || !threadId || sending) return;
    setSending(true);
    try {
      const m = await sendFn({ data: { threadId, body: text } });
      setMessages((v) => (v.some((x) => x.id === m.id) ? v : [...v, m]));
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Message could not be sent.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticky top bar: header + team member selector */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <header className="mx-auto flex min-h-[56px] w-full max-w-3xl items-center gap-3 px-3 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Back to dashboard">
            <Link to="/business" search={{ businessId }}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
            <Users className="h-5 w-5" />
          </div>
          <h1 className="min-w-0 truncate font-display text-lg font-semibold">Team</h1>
        </header>

        <div className="border-t border-border px-5 py-3">
          <div className="mx-auto flex max-w-3xl gap-3 overflow-x-auto">
            <Tile group active={!selected} label="Group Chat" role="Team" onClick={() => setSelected(null)} icon={<Users className="h-5 w-5" />} />
            {members.map((m) => (
              <Tile key={m.id} active={selected === m.id} label={m.name ?? "Member"} role={m.role} image={m.avatarUrl} onClick={() => setSelected(m.id)} />
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-5">
        {threadLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner label="Loading conversation…" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.isMine;
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[80%]">
                  {!mine && (
                    <div className="mb-1 flex items-baseline gap-2 px-1 text-xs">
                      <span className="font-semibold">{m.senderName ?? "Team member"}</span>
                    </div>
                  )}
                  <div
                    className={
                      "rounded-2xl px-4 py-2.5 text-sm " +
                      (mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")
                    }
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={"mt-1 text-[10px] " + (mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {new Date(m.createdAt).toLocaleString([], {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Sticky composer */}
      <div
        className="sticky bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3"
        >
          <Textarea
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Write a message…"
            className="max-h-32 min-h-[44px] resize-none"
            disabled={!threadId}
          />
          <Button type="submit" disabled={sending || threadLoading || !draft.trim()} size="icon" aria-label="Send message">
            {sending ? <Spinner size={16} label={null} /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Tile({
  group = false,
  active,
  label,
  role,
  image,
  icon,
  onClick,
}: {
  group?: boolean;
  active: boolean;
  label: string;
  role: string;
  image?: string | null;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`${group ? "w-28" : "w-20"} shrink-0 rounded-xl p-2 text-center ${active ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}
    >
      <span className="mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-secondary">
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : icon ?? label.slice(0, 1)}
      </span>
      <span className="mt-1 block whitespace-nowrap text-xs font-medium">{label}</span>
      <span className="block text-[10px] uppercase text-muted-foreground">{role}</span>
    </button>
  );
}
