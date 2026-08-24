import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AcceptResult, InviteResult, MemberRow } from "@/lib/members.server";

export type { MemberRow, InviteResult, AcceptResult };

/** Everyone on the team, as seen by the owner. */
export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberRow[]> => {
    const { listMembersForOwner } = await import("@/lib/members.server");
    return listMembersForOwner(context.userId);
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; permissions?: string[]; environment?: string }) => ({
    email: String(data?.email ?? ""),
    permissions: Array.isArray(data?.permissions) ? data.permissions : undefined,
    environment: data?.environment === "sandbox" ? "sandbox" : "live",
  }))
  .handler(async ({ data, context }): Promise<InviteResult> => {
    const { inviteMemberAsOwner } = await import("@/lib/members.server");
    return inviteMemberAsOwner(
      context.userId,
      { email: data.email, permissions: data.permissions },
      data.environment,
    );
  });

export const updateMemberPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { memberId: string; permissions: string[] }) => ({
    memberId: String(data?.memberId ?? ""),
    permissions: Array.isArray(data?.permissions) ? data.permissions : [],
  }))
  .handler(async ({ data, context }) => {
    const { updateMemberAsOwner } = await import("@/lib/members.server");
    return updateMemberAsOwner(context.userId, data);
  });

export const revokeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { memberId: string }) => ({ memberId: String(data?.memberId ?? "") }))
  .handler(async ({ data, context }) => {
    const { revokeMemberAsOwner } = await import("@/lib/members.server");
    return revokeMemberAsOwner(context.userId, data.memberId);
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => ({ token: String(data?.token ?? "") }))
  .handler(async ({ data, context }): Promise<AcceptResult> => {
    const { acceptInviteAsUser } = await import("@/lib/members.server");
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    return acceptInviteAsUser(context.userId, email, data.token);
  });
