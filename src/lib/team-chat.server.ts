export type TeamMember = { id: string; name: string | null; avatarUrl: string | null; role: "owner" | "admin" };
export type TeamMessage = { id: string; body: string; createdAt: string; senderId: string };

async function assertTeamAccess(userId: string, businessId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: business } = await supabaseAdmin.from("businesses").select("owner_id").eq("id", businessId).maybeSingle();
  const { data: member } = await (supabaseAdmin as any).from("business_members").select("id").eq("business_id", businessId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!business || (business.owner_id !== userId && !member)) throw new Error("You do not have access to this team.");
  return business;
}

export async function listTeamMembers(userId: string, businessId: string): Promise<TeamMember[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const business = await assertTeamAccess(userId, businessId);
  const { data: rows } = await (supabaseAdmin as any).from("business_members").select("user_id,role").eq("business_id", businessId).eq("status", "active");
  const ids = Array.from(new Set([business.owner_id, ...((rows ?? []).map((r: any) => r.user_id).filter(Boolean))]));
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id,display_name,avatar_url").in("id", ids);
  const profile = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  return ids.map((id) => ({ id, name: profile.get(id)?.display_name ?? null, avatarUrl: profile.get(id)?.avatar_url ?? null, role: id === business.owner_id ? "owner" : "admin" }));
}

export async function loadTeamThread(userId: string, businessId: string, memberId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await assertTeamAccess(userId, businessId);
  const thread = memberId && memberId !== userId
    ? await (supabaseAdmin as any).from("business_team_threads").upsert({ business_id: businessId, kind: "direct", member_a: [userId, memberId].sort()[0], member_b: [userId, memberId].sort()[1] }, { onConflict: "business_id,member_a,member_b" }).select("id,kind,member_a,member_b").single()
    : await (supabaseAdmin as any).from("business_team_threads").upsert({ business_id: businessId, kind: "group" }, { onConflict: "business_id" }).select("id,kind,member_a,member_b").single();
  if (thread.error || !thread.data) throw new Error("Could not open team chat.");
  const { data: messages } = await (supabaseAdmin as any).from("business_team_messages").select("id,body,created_at,sender_id").eq("thread_id", thread.data.id).order("created_at", { ascending: true });
  return { threadId: thread.data.id as string, messages: ((messages ?? []) as any[]).map((m) => ({ id: m.id, body: m.body, createdAt: m.created_at, senderId: m.sender_id })) as TeamMessage[] };
}

export async function postTeamMessage(userId: string, threadId: string, body: string): Promise<TeamMessage> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const text = body.trim(); if (!text || text.length > 2000) throw new Error("Message must be between 1 and 2000 characters.");
  const { data: thread } = await (supabaseAdmin as any).from("business_team_threads").select("business_id,kind,member_a,member_b").eq("id", threadId).maybeSingle();
  if (!thread) throw new Error("Chat not found.");
  await assertTeamAccess(userId, thread.business_id);
  if (thread.kind === "direct" && ![thread.member_a, thread.member_b].includes(userId)) throw new Error("You cannot send to this chat.");
  const { data, error } = await (supabaseAdmin as any).from("business_team_messages").insert({ thread_id: threadId, sender_id: userId, body: text }).select("id,body,created_at,sender_id").single();
  if (error) throw error;
  await (supabaseAdmin as any).from("business_team_threads").update({ last_message_at: new Date().toISOString() }).eq("id", threadId);
  return { id: data.id, body: data.body, createdAt: data.created_at, senderId: data.sender_id };
}
