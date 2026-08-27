import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Users } from "lucide-react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { businessId } = Route.useSearch(); const navigate = useNavigate();
  const membersFn = useServerFn(getTeamMembers), threadFn = useServerFn(getTeamThread), sendFn = useServerFn(sendTeamMessage);
  const [members, setMembers] = useState<Member[]>([]), [messages, setMessages] = useState<Message[]>([]), [threadId, setThreadId] = useState<string | null>(null), [selected, setSelected] = useState<string | null>(null), [draft, setDraft] = useState(""), [threadLoading, setThreadLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { void membersFn({ data: { businessId } }).then(setMembers); }, [businessId, membersFn]);
  useEffect(() => { setThreadLoading(true); setMessages([]); void threadFn({ data: { businessId, memberId: selected ?? undefined } }).then((r) => { setThreadId(r.threadId); setMessages(r.messages); }).catch(() => toast.error("Could not load this conversation.")).finally(() => setThreadLoading(false)); }, [businessId, selected, threadFn]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, selected, threadLoading]);
  const send = async (e: React.FormEvent) => { e.preventDefault(); if (!threadId || !draft.trim()) return; try { const m = await sendFn({ data: { threadId, body: draft } }); setMessages((v) => [...v, m]); setDraft(""); } catch (error) { toast.error(error instanceof Error ? error.message : "Message could not be sent."); } };
  return <div className="relative flex h-dvh min-h-screen flex-col overflow-hidden bg-background">
    <header className="z-30 shrink-0 border-b border-border bg-card/95 backdrop-blur"><div className="mx-auto flex min-h-14 max-w-3xl items-center gap-3 px-5 py-3"><BackButton label="Back to dashboard" onClick={() => navigate({ to: "/business", search: { businessId } })} /><h1 className="font-display text-2xl font-semibold">Team</h1></div></header>
    <div className="z-20 shrink-0 border-b border-border bg-background px-5 py-3"><div className="mx-auto flex max-w-3xl gap-3 overflow-x-auto"><Tile group active={!selected} label="Group Chat" role="Team" onClick={() => setSelected(null)} icon={<Users className="h-5 w-5" />} />{members.map((m) => <Tile key={m.id} active={selected === m.id} label={m.name ?? "Member"} role={m.role} image={m.avatarUrl} onClick={() => setSelected(m.id)} />)}</div></div>
    <main className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-5 py-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))]"><div className="space-y-4">{threadLoading ? <div className="flex h-32 items-center justify-center"><Spinner label="Loading conversation…" /></div> : messages.length ? messages.map((m) => <article key={m.id} className={`flex items-end gap-2 ${m.isMine ? "justify-end" : ""}`}><div className={`max-w-[80%] ${m.isMine ? "order-1" : ""}`}><div className={`mb-1 flex items-baseline gap-2 text-xs ${m.isMine ? "justify-end" : ""}`}><span className="font-semibold">{m.senderName ?? "Team member"}</span></div><div className={`rounded-2xl px-4 py-2.5 text-sm ${m.isMine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary"}`}>{m.body}</div><time className={`mt-1 block text-[10px] text-muted-foreground ${m.isMine ? "text-right" : "text-left"}`}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>{!m.isMine && <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold">{m.senderAvatarUrl ? <img src={m.senderAvatarUrl} alt="" className="h-full w-full object-cover" /> : (m.senderName ?? "?").slice(0, 1).toUpperCase()}</div>}</article>) : <p className="py-12 text-center text-sm text-muted-foreground">Start the conversation.</p>}<div ref={messagesEndRef} /></div></main>
    <form onSubmit={send} className="absolute inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur"><div className="mx-auto flex w-full max-w-3xl gap-2 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"><Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" /><Button type="submit" size="icon" disabled={threadLoading || !draft.trim()}><Send className="h-4 w-4" /></Button></div></form>
  </div>;
}
function Tile({ group = false, active, label, role, image, icon, onClick }: { group?: boolean; active: boolean; label: string; role: string; image?: string | null; icon?: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className={`${group ? "w-28" : "w-20"} shrink-0 rounded-xl p-2 text-center ${active ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}><span className="mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-secondary">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : icon ?? label.slice(0, 1)}</span><span className="mt-1 block whitespace-nowrap text-xs font-medium">{label}</span><span className="block text-[10px] uppercase text-muted-foreground">{role}</span></button>; }
