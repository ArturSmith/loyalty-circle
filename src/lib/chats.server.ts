/** Server-only chat helpers: conversations between a customer and a business. */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthenticatedClient = SupabaseClient<Database>;

export type ChatBusiness = {
  id: string;
  name: string;
  logo_url: string | null;
};

export type ChatMessage = {
  id: string;
  body: string;
  sender_role: "business" | "customer";
  created_at: string;
};

export type ChatConversation = {
  id: string;
  business: ChatBusiness;
  last_message_at: string;
  last_message: string | null;
  viewer_role: "business" | "customer";
  /** Populated only in the "business" scope — the other party's identity. */
  customer_name: string | null;
  customer_avatar_url: string | null;
  unread_count: number;
};

const DEFAULT_WELCOME = (name: string) =>
  `Welcome to ${name}! Thanks for adding our loyalty card — message us here any time.`;

/** Whether the user may act as this business in customer conversations. */
async function canUseBusinessMessages(
  supabase: AuthenticatedClient,
  userId: string,
  businessId: string,
  ownerId?: string,
): Promise<boolean> {
  let resolvedOwnerId = ownerId;
  if (!resolvedOwnerId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", businessId)
      .maybeSingle();
    resolvedOwnerId = business?.owner_id;
  }
  if (resolvedOwnerId === userId) return true;

  const { data: membership } = await (supabase as any)
    .from("business_members")
    .select("role, permissions")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const member = membership as { role?: string; permissions?: string[] } | null;
  return member?.role === "owner" || (member?.permissions ?? []).includes("customers.message");
}

/**
 * Opens (or reuses) the conversation between a customer and a business and posts
 * the business welcome message on first contact. Never throws into the caller's
 * flow: adding a card must succeed even if chat setup fails.
 */
export async function openWelcomeConversation(businessId: string, customerId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, owner_id, welcome_message")
      .eq("id", businessId)
      .maybeSingle();

    if (!business || business.owner_id === customerId) return null;

    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await supabaseAdmin
      .from("conversations")
      .insert({ business_id: businessId, customer_id: customerId })
      .select("id")
      .single();

    if (error || !created) {
      console.error("openWelcomeConversation: insert conversation failed", error);
      return null;
    }

    const body = (business.welcome_message ?? "").trim() || DEFAULT_WELCOME(business.name);
    const { error: messageError } = await supabaseAdmin.from("chat_messages").insert({
      conversation_id: created.id,
      sender_id: business.owner_id,
      sender_role: "business",
      body,
    });
    if (messageError) console.error("openWelcomeConversation: welcome message failed", messageError);

    return created.id;
  } catch (error) {
    console.error("openWelcomeConversation error", error);
    return null;
  }
}

/**
 * Which side of the conversation the caller is acting as.
 *
 * A conversation belongs to a business and a customer, never to a business
 * *owner* personally. Someone who runs a café is also a customer elsewhere, and
 * the two roles must not bleed into each other: their personal Chats tab should
 * never show café enquiries, and the café inbox should never show the cards they
 * collect. Every read is therefore scoped explicitly rather than inferred.
 */
export type ChatScope = "customer" | "business";

export async function listConversationsFor(
  userId: string,
  scope: ChatScope = "customer",
  businessId?: string,
  supabase?: AuthenticatedClient,
): Promise<ChatConversation[]> {
  if (!supabase) throw new Error("Authenticated database client is required");

  let query = supabase
    .from("conversations")
    .select(
      "id, business_id, customer_id, last_message_at, customer_last_read_at, business_last_read_at, business:businesses(id, name, logo_url)",
    );

  if (scope === "customer") {
    query = query.eq("customer_id", userId);
  } else {
    if (businessId) {
      const { data: business } = await supabase.from("businesses").select("owner_id").eq("id", businessId).maybeSingle();
      if (!business || !await canUseBusinessMessages(supabase, userId, businessId, business.owner_id)) return [];
      query = query.eq("business_id", businessId);
    } else {
      const [{ data: ownedBusinesses }, { data: memberships }] = await Promise.all([
        supabase.from("businesses").select("id").eq("owner_id", userId),
        (supabase as any)
          .from("business_members")
          .select("business_id, role, permissions")
          .eq("user_id", userId)
          .eq("status", "active"),
      ]);
      const permittedIds = new Set((ownedBusinesses ?? []).map((b: { id: string }) => b.id));
      (memberships as { business_id: string; role?: string; permissions?: string[] }[] | null ?? []).forEach((member) => {
        if (member.role === "owner" || (member.permissions ?? []).includes("customers.message")) {
          permittedIds.add(member.business_id);
        }
      });
      if (permittedIds.size === 0) return [];
      query = query.in("business_id", [...permittedIds]);
    }
  }

  const { data: rows, error } = await query.order("last_message_at", { ascending: false });

  if (error) throw error;
  const conversations = (rows ?? []) as any[];
  if (conversations.length === 0) return [];

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("conversation_id, body, created_at, sender_role")
    .in("conversation_id", conversations.map((c) => c.id))
    .order("created_at", { ascending: false });

  const lastByConversation = new Map<string, string>();
  (messages ?? []).forEach((m: any) => {
    if (!lastByConversation.has(m.conversation_id)) lastByConversation.set(m.conversation_id, m.body);
  });

  // Unread = arrived after this side last looked, and sent by the *other* side.
  // Your own messages are never unread to you.
  const readAtByConversation = new Map<string, { role: ChatScope; readAt: number }>();
  conversations.forEach((c) => {
    const readAt = scope === "customer" ? c.customer_last_read_at : c.business_last_read_at;
    readAtByConversation.set(c.id, { role: scope, readAt: readAt ? new Date(readAt).getTime() : 0 });
  });

  const unreadByConversation = new Map<string, number>();
  (messages ?? []).forEach((m: any) => {
    const meta = readAtByConversation.get(m.conversation_id);
    if (!meta) return;
    if (m.sender_role === meta.role) return;
    if (new Date(m.created_at).getTime() <= meta.readAt) return;
    unreadByConversation.set(m.conversation_id, (unreadByConversation.get(m.conversation_id) ?? 0) + 1);
  });

  const nameById = new Map<string, string | null>();
  const avatarById = new Map<string, string | null>();
  if (scope === "business") {
    const customerIds = Array.from(new Set(conversations.map((c) => c.customer_id)));
    if (customerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", customerIds);
      (profiles ?? []).forEach((p: any) => {
        nameById.set(p.id, p.display_name);
        avatarById.set(p.id, p.avatar_url);
      });
    }
  }

  return conversations
    .filter((c) => c.business)
    .map((c) => ({
      id: c.id,
      business: c.business as ChatBusiness,
      last_message_at: c.last_message_at,
      last_message: lastByConversation.get(c.id) ?? null,
      viewer_role: scope,
      customer_name: scope === "business" ? nameById.get(c.customer_id) ?? null : null,
      customer_avatar_url: scope === "business" ? avatarById.get(c.customer_id) ?? null : null,
      unread_count: unreadByConversation.get(c.id) ?? 0,
    }));
}

/** Total unread messages across the conversations in one scope. */
export async function countUnreadMessagesFor(
  userId: string,
  scope: ChatScope = "customer",
  supabase?: AuthenticatedClient,
): Promise<number> {
  const conversations = await listConversationsFor(userId, scope, undefined, supabase);
  return conversations.reduce((total, c) => total + c.unread_count, 0);
}

export async function loadConversation(
  conversationId: string,
  userId: string,
  scope: ChatScope = "customer",
  supabase?: AuthenticatedClient,
) {
  if (!supabase) throw new Error("Authenticated database client is required");

  const { data: row, error } = await supabase
    .from("conversations")
    .select("id, business_id, customer_id, business:businesses(id, name, logo_url, owner_id)")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  const conversation = row as any;
  if (!conversation || !conversation.business) throw new Error("Conversation not found");

  // Access is granted by the requested scope alone. An owner opening a
  // conversation from their personal Chats tab is not acting as the business, so
  // asking as a customer for a conversation you merely own is a miss.
  const isCustomer = scope === "customer" && conversation.customer_id === userId;
  const isBusinessMember = scope === "business" && await canUseBusinessMessages(
    supabase,
    userId,
    conversation.business_id,
    conversation.business.owner_id,
  );
  if (!isCustomer && !isBusinessMember) throw new Error("Conversation not found");

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, body, sender_role, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  let customerName: string | null = null;
  let customerAvatarUrl: string | null = null;
  let customerActivityCardId: string | null = null;
  if (isBusinessMember) {
    const [{ data: profile }, { data: latestActivity }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", conversation.customer_id)
        .maybeSingle(),
      supabase
        .from("card_events")
        .select("template_id")
        .eq("business_id", conversation.business_id)
        .eq("customer_id", conversation.customer_id)
        .not("template_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    customerName = profile?.display_name ?? null;
    customerAvatarUrl = profile?.avatar_url ?? null;
    customerActivityCardId = latestActivity?.template_id ?? null;
  }

  return {
    id: conversation.id,
    business: {
      id: conversation.business.id,
      name: conversation.business.name,
      logo_url: conversation.business.logo_url,
    } as ChatBusiness,
    viewer_role: (isCustomer ? "customer" : "business") as "customer" | "business",
    customer_id: isBusinessMember ? conversation.customer_id as string : null,
    customer_name: customerName,
    customer_avatar_url: customerAvatarUrl,
    customer_activity_card_id: customerActivityCardId,
    messages: (messages ?? []) as ChatMessage[],
  };
}

/**
 * Marks the viewer's side of a conversation as read. Opening a conversation is
 * what "reading" means here, so this is called on load rather than being left to
 * the caller to remember.
 */
export async function markConversationRead(
  conversationId: string,
  scope: ChatScope = "customer",
  supabase?: AuthenticatedClient,
): Promise<void> {
  if (!supabase) throw new Error("Authenticated database client is required");

  // Conversation UPDATE is not granted to app users. The RPC updates only the
  // caller's requested side after checking customer/staff access in PostgreSQL.
  const { error } = await supabase.rpc("mark_conversation_read", {
    _conversation_id: conversationId,
    _scope: scope,
  });
  if (error) throw error;
}

export async function postMessage(
  conversationId: string,
  userId: string,
  body: string,
  scope: ChatScope = "customer",
  supabase?: AuthenticatedClient,
): Promise<ChatMessage> {
  if (!supabase) throw new Error("Authenticated database client is required");
  if (scope !== "business") throw new Error("Only the business can send messages in this conversation");

  const { data: row, error } = await supabase
    .from("conversations")
    .select("id, business_id, customer_id, business:businesses(owner_id)")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  const conversation = row as any;
  if (!conversation) throw new Error("Conversation not found");

  const isBusinessMember = await canUseBusinessMessages(
    supabase,
    userId,
    conversation.business_id,
    conversation.business?.owner_id,
  );
  if (!isBusinessMember) throw new Error("Conversation not found");

  const { data: created, error: insertError } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      sender_role: "business",
      body,
    })
    .select("id, body, sender_role, created_at")
    .single();

  if (insertError) throw insertError;
  return created as ChatMessage;
}
