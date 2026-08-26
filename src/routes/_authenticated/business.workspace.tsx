import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Send, Users } from "lucide-react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTeamMembers, getTeamThread, sendTeamMessage } from "@/utils/team-chat.functions";
import { toast } from "sonner";

type Member = { id: string; name: string | null; avatarUrl: string | null; role: "owner" | "admin" };
type Message = { id: string; body: string; createdAt: string; senderId: string };

export const Route = createFileRoute("/_authenticated/business/workspace")({
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: TeamChat,
});

function TeamChat() {
  const { businessId } = Route.useSearch(); const navigate = useNavigate();
  const membersFn = useServerFn(getTeamMembers), threadFn = useServerFn(getTeamThread), sendFn = useServerFn(sendTeamMessage);
  const [members, setMembers] = useState<Member[]>([]), [messages, setMessages] = useState<Message[]>([]), [threadId, setThreadId] = useState<string | null>(null), [selected, setSelected] = useState<string | null>(null), [draft, setDraft] = useState("");
  useEffect(() => { void membersFn({ data: { businessId } }).then(setMembers); }, [businessId, membersFn]);
  useEffect(() => { void threadFn({ data: { businessId, memberId: selected ?? undefined } }).then((r) => { setThreadId(r.threadId); setMessages(r.messages); }); }, [businessId, selected, threadFn]);
  const send = async (e: React.FormEvent) => { e.preventDefault(); if (!threadId || !draft.trim()) return; try { const m = await sendFn({ data: { threadId, body: draft } }); setMessages((v) => [...v, m]); setDraft(""); } catch (error) { toast.error(error instanceof Error ? error.message : "Message could not be sent."); } };
  return <div className="flex min-h-screen flex-col bg-background">
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur"><div className="mx-auto flex min-h-14 max-w-3xl items-center gap-3 px-5 py-3"><BackButton label="Back to dashboard" onClick={() => navigate({ to: "/business", search: { businessId } })} /><h1 className="font-display text-2xl font-semibold">Team</h1></div></header>
    <div className="border-b border-border px-5 py-3"><div className="mx-auto flex max-w-3xl gap-3 overflow-x-auto"><Tile group active={!selected} label="Group Chat" role="Team" onClick={() => setSelected(null)} icon={<Users className="h-5 w-5" />} />{members.map((m) => <Tile key={m.id} active={selected === m.id} label={m.name ?? "Member"} role={m.role} image={m.avatarUrl} onClick={() => setSelected(m.id)} />)}</div></div>
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-5"><div className="flex-1 space-y-3">{messages.length ? messages.map((m) => <div key={m.id} className="max-w-[80%] rounded-2xl bg-secondary px-4 py-2 text-sm">{m.body}</div>) : <p className="py-12 text-center text-sm text-muted-foreground">Start the conversation.</p>}</div><form onSubmit={send} className="mt-4 flex gap-2 border-t border-border pt-4"><Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" /><Button type="submit" size="icon" disabled={!draft.trim()}><Send className="h-4 w-4" /></Button></form></main>
  </div>;
}
function Tile({ group = false, active, label, role, image, icon, onClick }: { group?: boolean; active: boolean; label: string; role: string; image?: string | null; icon?: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className={`${group ? "w-28" : "w-20"} shrink-0 rounded-xl p-2 text-center ${active ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}><span className="mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-secondary">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : icon ?? label.slice(0, 1)}</span><span className="mt-1 block whitespace-nowrap text-xs font-medium">{label}</span><span className="block text-[10px] uppercase text-muted-foreground">{role}</span></button>; }
