import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  countUnreadMessagesFor,
  listConversationsFor,
  loadConversation,
  markConversationRead,
  postMessage,
} from "@/lib/chats.server";
import type { ChatConversation, ChatMessage, ChatScope } from "@/lib/chats.server";

export type { ChatConversation, ChatMessage, ChatScope };

/** Callers name the side they're acting as; anything unrecognised is a customer. */
const asScope = (value: unknown): ChatScope => (value === "business" ? "business" : "customer");

export const getConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { scope?: string }) => ({ scope: asScope(data?.scope) }))
  .handler(async ({ data, context }): Promise<{ conversations: ChatConversation[] }> => {
    return { conversations: await listConversationsFor(context.userId, data.scope) };
  });

export const getUnreadChatCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { scope?: string }) => ({ scope: asScope(data?.scope) }))
  .handler(async ({ data, context }): Promise<{ count: number }> => {
    return { count: await countUnreadMessagesFor(context.userId, data.scope) };
  });

export const markChatRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string; scope?: string }) => {
    if (!data?.conversationId) throw new Error("Conversation is required");
    return { conversationId: data.conversationId, scope: asScope(data.scope) };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await markConversationRead(data.conversationId, context.userId, data.scope);
    return { ok: true };
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string; scope?: string }) => {
    if (!data?.conversationId) throw new Error("Conversation is required");
    return { conversationId: data.conversationId, scope: asScope(data.scope) };
  })
  .handler(async ({ data, context }) => loadConversation(data.conversationId, context.userId, data.scope));

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string; body: string; scope?: string }) => {
    const body = (data?.body ?? "").trim();
    if (!data?.conversationId) throw new Error("Conversation is required");
    if (!body) throw new Error("Message is required");
    if (body.length > 2000) throw new Error("Message is too long");
    return { conversationId: data.conversationId, body, scope: asScope(data.scope) };
  })
  .handler(async ({ data, context }): Promise<{ message: ChatMessage }> => {
    return { message: await postMessage(data.conversationId, context.userId, data.body, data.scope) };
  });
