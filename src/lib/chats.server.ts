/** Server-only chat helpers (admin client): conversations between a customer and a business. */

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
  customer_name: string | null;
  unread_count: number;
};

const DEFAULT_WELCOME = (name: string) =>
  `Welcome to ${name}! Thanks for adding our loyalty card — message us here any time.`;

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

export async function listConversationsFor(userId: string): Promise<ChatConversation[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: ownedBusinesses } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId);
  const ownedIds = (ownedBusinesses ?? []).map((b: { id: string }) => b.id);

  const filters = [`customer_id.eq.${userId}`];
  if (ownedIds.length > 0) filters.push(`business_id.in.(${ownedIds.join(",")})`);

  const { data: rows, error } = await supabaseAdmin
    .from("conversations")
    .select(
      "id, business_id, customer_id, last_message_at, customer_last_read_at, business_last_read_at, business:businesses(id, name, logo_url)",
    )
    .or(filters.join(","))
    .order("last_message_at", { ascending: false });

  if (error) throw error;
  const conversations = (rows ?? []) as any[];
  if (conversations.length === 0) return [];

  const { data: messages } = await supabaseAdmin
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
  const readAtByConversation = new Map<string, { role: "business" | "customer"; readAt: number }>();
  conversations.forEach((c) => {
    const role = c.customer_id === userId ? ("customer" as const) : ("business" as const);
    const readAt = role === "customer" ? c.customer_last_read_at : c.business_last_read_at;
    readAtByConversation.set(c.id, { role, readAt: readAt ? new Date(readAt).getTime() : 0 });
  });

  const unreadByConversation = new Map<string, number>();
  (messages ?? []).forEach((m: any) => {
    const meta = readAtByConversation.get(m.conversation_id);
    if (!meta) return;
    if (m.sender_role === meta.role) return;
    if (new Date(m.created_at).getTime() <= meta.readAt) return;
    unreadByConversation.set(m.conversation_id, (unreadByConversation.get(m.conversation_id) ?? 0) + 1);
  });

  const customerIds = Array.from(
    new Set(conversations.filter((c) => c.customer_id !== userId).map((c) => c.customer_id)),
  );
  const nameById = new Map<string, string | null>();
  if (customerIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", customerIds);
    (profiles ?? []).forEach((p: any) => nameById.set(p.id, p.display_name));
  }

  return conversations
    .filter((c) => c.business)
    .map((c) => ({
      id: c.id,
      business: c.business as ChatBusiness,
      last_message_at: c.last_message_at,
      last_message: lastByConversation.get(c.id) ?? null,
      viewer_role: c.customer_id === userId ? ("customer" as const) : ("business" as const),
      customer_name: c.customer_id === userId ? null : nameById.get(c.customer_id) ?? null,
      unread_count: unreadByConversation.get(c.id) ?? 0,
    }));
}

/** Total unread messages across every conversation the user takes part in. */
export async function countUnreadMessagesFor(userId: string): Promise<number> {
  const conversations = await listConversationsFor(userId);
  return conversations.reduce((total, c) => total + c.unread_count, 0);
}

export async function loadConversation(conversationId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row, error } = await supabaseAdmin
    .from("conversations")
    .select("id, business_id, customer_id, business:businesses(id, name, logo_url, owner_id)")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  const conversation = row as any;
  if (!conversation || !conversation.business) throw new Error("Conversation not found");

  const isCustomer = conversation.customer_id === userId;
  const isOwner = conversation.business.owner_id === userId;
  if (!isCustomer && !isOwner) throw new Error("Conversation not found");

  const { data: messages } = await supabaseAdmin
    .from("chat_messages")
    .select("id, body, sender_role, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  let customerName: string | null = null;
  if (isOwner) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", conversation.customer_id)
      .maybeSingle();
    customerName = profile?.display_name ?? null;
  }

  return {
    id: conversation.id,
    business: {
      id: conversation.business.id,
      name: conversation.business.name,
      logo_url: conversation.business.logo_url,
    } as ChatBusiness,
    viewer_role: (isCustomer ? "customer" : "business") as "customer" | "business",
    customer_name: customerName,
    messages: (messages ?? []) as ChatMessage[],
  };
}

/**
 * Marks the viewer's side of a conversation as read. Opening a conversation is
 * what "reading" means here, so this is called on load rather than being left to
 * the caller to remember.
 */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row } = await supabaseAdmin
    .from("conversations")
    .select("id, customer_id, business:businesses(owner_id)")
    .eq("id", conversationId)
    .maybeSingle();

  const conversation = row as any;
  if (!conversation) return;

  const isCustomer = conversation.customer_id === userId;
  const isOwner = conversation.business?.owner_id === userId;
  if (!isCustomer && !isOwner) return;

  await supabaseAdmin
    .from("conversations")
    .update(
      isCustomer
        ? ({ customer_last_read_at: new Date().toISOString() } as any)
        : ({ business_last_read_at: new Date().toISOString() } as any),
    )
    .eq("id", conversationId);
}

export async function postMessage(conversationId: string, userId: string, body: string): Promise<ChatMessage> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row, error } = await supabaseAdmin
    .from("conversations")
    .select("id, customer_id, business:businesses(owner_id)")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  const conversation = row as any;
  if (!conversation) throw new Error("Conversation not found");

  const isCustomer = conversation.customer_id === userId;
  const isOwner = conversation.business?.owner_id === userId;
  if (!isCustomer && !isOwner) throw new Error("Conversation not found");

  const { data: created, error: insertError } = await supabaseAdmin
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      sender_role: isCustomer ? "customer" : "business",
      body,
    })
    .select("id, body, sender_role, created_at")
    .single();

  if (insertError) throw insertError;
  return created as ChatMessage;
}
