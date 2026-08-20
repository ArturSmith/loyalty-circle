import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  countUnreadMessagesFor,
  listConversationsFor,
  loadConversation,
  markConversationRead,
  postMessage,
} from "@/lib/chats.server";
import type { ChatConversation, ChatMessage } from "@/lib/chats.server";

export type { ChatConversation, ChatMessage };

export const getConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ conversations: ChatConversation[] }> => {
    return { conversations: await listConversationsFor(context.userId) };
  });

export const getUnreadChatCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ count: number }> => {
    return { count: await countUnreadMessagesFor(context.userId) };
  });

export const markChatRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string }) => {
    if (!data?.conversationId) throw new Error("Conversation is required");
    return { conversationId: data.conversationId };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await markConversationRead(data.conversationId, context.userId);
    return { ok: true };
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string }) => {
    if (!data?.conversationId) throw new Error("Conversation is required");
    return { conversationId: data.conversationId };
  })
  .handler(async ({ data, context }) => loadConversation(data.conversationId, context.userId));

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversationId: string; body: string }) => {
    const body = (data?.body ?? "").trim();
    if (!data?.conversationId) throw new Error("Conversation is required");
    if (!body) throw new Error("Message is required");
    if (body.length > 2000) throw new Error("Message is too long");
    return { conversationId: data.conversationId, body };
  })
  .handler(async ({ data, context }): Promise<{ message: ChatMessage }> => {
    return { message: await postMessage(data.conversationId, context.userId, data.body) };
  });
