/**
 * Business team management — server-only.
 *
 * Every function here is owner-gated. An admin can never invite, promote,
 * demote or revoke another admin: that is the main privilege-escalation path
 * in a multi-tenant product, so it is enforced on the server and again in RLS.
 */

import {
  DEFAULT_ADMIN_PERMISSIONS,
  OWNER_ONLY_PERMISSIONS,
  PERMISSIONS,
  entitlementsFor,
  type Permission,
} from "@/lib/plans";

export type MemberRow = {
  id: string;
  email: string;
  role: "owner" | "admin";
  permissions: Permission[];
  status: "invited" | "active" | "revoked";
  invitedAt: string;
  acceptedAt: string | null;
  /** Present only for pending invitations. */
  inviteUrl: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isYou: boolean;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Strips unknown and owner-reserved permissions. Never trust the client. */
function sanitizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [...DEFAULT_ADMIN_PERMISSIONS];
  return input.filter(
    (p): p is Permission =>
      typeof p === "string" &&
      (PERMISSIONS as readonly string[]).includes(p) &&
      !(OWNER_ONLY_PERMISSIONS as readonly string[]).includes(p),
  );
}

function inviteUrlFor(token: string): string {
  const base = process.env["PUBLIC_SITE_URL"] ?? "https://clubcarder.com";
  return `${base}/invite/${token}`;
}

/**
 * Auth has no lookup-by-email endpoint for administrators. Search every page
 * instead of just the first 200 accounts; otherwise a real user can be
 * mistaken for a new invitee as the customer base grows.
 */
async function userIdForEmail(email: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const perPage = 200;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data.users ?? [];
    const matchingUser = users.find((user) => normalizeEmail(user.email ?? "") === email);
    if (matchingUser) return matchingUser.id;
    if (users.length < perPage) return null;
  }
}

/** Resolves the business this user owns. Returns null when they own none. */
async function ownedBusinessId(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * The owner's billing state, used to enforce the administrator limit.
 * A trial is not a subscription, so the two are reported separately.
 */
async function billingStateForOwner(
  ownerId: string,
  environment: string,
): Promise<{ subscribed: boolean; tier: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_tier, status, current_period_end")
    .eq("user_id", ownerId)
    .eq("environment", environment)
    .order("created_at", { ascending: false });

  const now = Date.now();
  const active = (data as any[] | null)?.find((s) => {
    const end = s.current_period_end ? new Date(s.current_period_end).getTime() : null;
    if (["active", "trialing", "past_due"].includes(s.status)) return end === null || end > now;
    if (s.status === "canceled") return end !== null && end > now;
    return false;
  });
  return { subscribed: Boolean(active), tier: active?.plan_tier ?? null };
}

export async function listMembersForOwner(userId: string): Promise<MemberRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const businessId = await ownedBusinessId(userId);
  if (!businessId) return [];

  const { data } = await (supabaseAdmin as any)
    .from("business_members")
    .select("id, email, role, permissions, status, invited_at, accepted_at, invite_token, user_id")
    .eq("business_id", businessId)
    .order("role", { ascending: true })
    .order("invited_at", { ascending: true });

  const rows = (data as any[] | null) ?? [];

  // Attach names/avatars for members who already have an account.
  const userIds = rows.map((r) => r.user_id).filter(Boolean);
  const profileById = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds);
    (profiles as any[] | null)?.forEach((p) => profileById.set(p.id, p));
  }

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    permissions: sanitizePermissions(r.permissions),
    status: r.status,
    invitedAt: r.invited_at,
    acceptedAt: r.accepted_at,
    // Only pending invitations expose a token — never leak a live one.
    inviteUrl: r.status === "invited" ? inviteUrlFor(r.invite_token) : null,
    displayName: profileById.get(r.user_id)?.display_name ?? null,
    avatarUrl: profileById.get(r.user_id)?.avatar_url ?? null,
    isYou: r.user_id === userId,
  }));
}

export type InviteResult =
  | { status: "invited"; member: MemberRow; emailSent: boolean; accessGranted: boolean }
  | { status: "error"; message: string };

export async function inviteMemberAsOwner(
  userId: string,
  input: { email: string; permissions?: unknown },
  environment: string,
): Promise<InviteResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const businessId = await ownedBusinessId(userId);
  if (!businessId) {
    return { status: "error", message: "Only a business owner can invite administrators." };
  }

  // Plan limit. Revoked members do not count, and neither does the owner —
  // the limit is about how many administrators may be added alongside them.
  const { count } = await (supabaseAdmin as any)
    .from("business_members")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("role", "admin")
    .neq("status", "revoked");

  const billing = await billingStateForOwner(userId, environment);
  const ent = entitlementsFor(
    billing.subscribed ? { kind: "subscribed", tier: billing.tier } : { kind: "trialing" },
  );
  const existingForEmail = await (supabaseAdmin as any)
    .from("business_members")
    .select("id, status")
    .eq("business_id", businessId)
    .eq("email", email)
    .maybeSingle();

  const isReinvite = Boolean(existingForEmail.data);
  const check = ent.checkLimit("administrators", count ?? 0);
  if (!check.allowed && !isReinvite) {
    return { status: "error", message: check.reason ?? "Administrator limit reached." };
  }

  // Link straight to an existing account when there is one, so the invitee can
  // simply sign in instead of chasing an email.
  let inviteeUserId: string | null = null;
  try {
    inviteeUserId = await userIdForEmail(email);
  } catch (error) {
    console.error("listUsers failed while inviting member", error);
  }

  if (inviteeUserId === userId) {
    return { status: "error", message: "You already own this business." };
  }

  const permissions = sanitizePermissions(input.permissions);
  const activatedAt = new Date().toISOString();

  // Deliberately not an upsert. The uniqueness rule is a functional index on
  // (business_id, lower(email)), and Postgres cannot match ON CONFLICT
  // (business_id, email) to it — every invitation failed with "no unique or
  // exclusion constraint matching the ON CONFLICT specification".
  const existingId = (existingForEmail.data as { id?: string } | null)?.id ?? null;
  const invitation = {
    business_id: businessId,
    email,
    user_id: inviteeUserId,
    role: "admin",
    permissions,
    // An account we can identify by email has already proved ownership of that
    // mailbox. Grant access immediately; requiring them to click an invite
    // link left their membership permanently invisible to the business UI.
    status: inviteeUserId ? "active" : "invited",
    invited_by: userId,
    invited_at: activatedAt,
    accepted_at: inviteeUserId ? activatedAt : null,
  };
  const columns =
    "id, email, role, permissions, status, invited_at, accepted_at, invite_token, user_id";

  const { data: upserted, error } = existingId
    ? await (supabaseAdmin as any)
        .from("business_members")
        .update(invitation)
        .eq("id", existingId)
        .select(columns)
        .single()
    : await (supabaseAdmin as any)
        .from("business_members")
        .insert(invitation)
        .select(columns)
        .single();

  if (error || !upserted) {
    return { status: "error", message: error?.message ?? "Could not create the invitation." };
  }

  // The app has no outbound mailer of its own; Supabase Auth sends this one.
  // It only works for addresses without an account yet, so a copyable invite
  // link is always returned as the dependable path.
  let emailSent = false;
  if (!inviteeUserId) {
    try {
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: inviteUrlFor(upserted.invite_token),
      });
      emailSent = !inviteError;
      if (inviteError) console.error("inviteUserByEmail failed", inviteError);
    } catch (e) {
      console.error("inviteUserByEmail threw", e);
    }
  }

  return {
    status: "invited",
    emailSent,
    accessGranted: Boolean(inviteeUserId),
    member: {
      id: upserted.id,
      email: upserted.email,
      role: upserted.role,
      permissions: sanitizePermissions(upserted.permissions),
      status: upserted.status,
      invitedAt: upserted.invited_at,
      acceptedAt: upserted.accepted_at,
      inviteUrl: upserted.status === "invited" ? inviteUrlFor(upserted.invite_token) : null,
      displayName: null,
      avatarUrl: null,
      isYou: false,
    },
  };
}

export async function updateMemberAsOwner(
  userId: string,
  input: { memberId: string; permissions: unknown },
): Promise<{ ok: boolean; message?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const businessId = await ownedBusinessId(userId);
  if (!businessId) return { ok: false, message: "Only a business owner can change permissions." };

  const { data: member } = await (supabaseAdmin as any)
    .from("business_members")
    .select("id, role, business_id")
    .eq("id", input.memberId)
    .maybeSingle();

  if (!member || member.business_id !== businessId) {
    return { ok: false, message: "Member not found." };
  }
  if (member.role === "owner") {
    return { ok: false, message: "The owner's permissions cannot be changed." };
  }

  const { error } = await (supabaseAdmin as any)
    .from("business_members")
    .update({ permissions: sanitizePermissions(input.permissions) })
    .eq("id", input.memberId);

  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function revokeMemberAsOwner(
  userId: string,
  memberId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const businessId = await ownedBusinessId(userId);
  if (!businessId) return { ok: false, message: "Only a business owner can remove access." };

  const { data: member } = await (supabaseAdmin as any)
    .from("business_members")
    .select("id, role, business_id")
    .eq("id", memberId)
    .maybeSingle();

  if (!member || member.business_id !== businessId) {
    return { ok: false, message: "Member not found." };
  }
  if (member.role === "owner") {
    return { ok: false, message: "The owner cannot be removed from their own business." };
  }

  // Delete rather than mark revoked: re-inviting later should feel clean, and
  // the unique index is on (business_id, email).
  const { error } = await (supabaseAdmin as any)
    .from("business_members")
    .delete()
    .eq("id", memberId);

  return error ? { ok: false, message: error.message } : { ok: true };
}

export type AcceptResult =
  | { status: "accepted"; businessName: string }
  | { status: "error"; message: string };

export async function acceptInviteAsUser(
  userId: string,
  userEmail: string | null,
  token: string,
): Promise<AcceptResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: member } = await (supabaseAdmin as any)
    .from("business_members")
    .select("id, business_id, email, status, user_id")
    .eq("invite_token", token)
    .maybeSingle();

  if (!member) return { status: "error", message: "This invitation link is not valid." };
  if (member.status === "revoked") {
    return { status: "error", message: "This invitation has been revoked." };
  }

  // The invite is addressed to a specific mailbox. Accepting it from a
  // different account would let a forwarded link grant the wrong person access.
  const signedInEmail = normalizeEmail(userEmail ?? "");
  if (member.user_id && member.user_id !== userId) {
    return { status: "error", message: "This invitation belongs to a different account." };
  }
  if (!member.user_id && signedInEmail !== normalizeEmail(member.email)) {
    return {
      status: "error",
      message: `This invitation was sent to ${member.email}. Sign in with that address to accept it.`,
    };
  }

  const { error } = await (supabaseAdmin as any)
    .from("business_members")
    .update({ user_id: userId, status: "active", accepted_at: new Date().toISOString() })
    .eq("id", member.id);

  if (error) return { status: "error", message: error.message };

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("name")
    .eq("id", member.business_id)
    .maybeSingle();

  return { status: "accepted", businessName: (biz as { name?: string } | null)?.name ?? "the business" };
}
