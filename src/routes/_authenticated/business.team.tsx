import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScreenLoader, Spinner } from "@/components/Spinner";
import { toast } from "sonner";
import { ChevronLeft, Copy, Check, Mail, Shield, Trash2, UserPlus } from "lucide-react";
import {
  listMembers,
  inviteMember,
  updateMemberPermissions,
  revokeMember,
  type MemberRow,
} from "@/utils/members.functions";
import {
  DEFAULT_ADMIN_PERMISSIONS,
  OWNER_ONLY_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_LABELS,
  type Permission,
} from "@/lib/plans";
import { useEntitlements } from "@/hooks/useEntitlements";
import { getPaddleEnvironment } from "@/lib/paddle";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/business/team")({
  head: () => ({ meta: [{ title: "Team — ClubCarder Business" }] }),
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: TeamPage,
});

/** Permissions an admin can actually be granted. */
const ASSIGNABLE: Permission[] = PERMISSIONS.filter(
  (p) => !(OWNER_ONLY_PERMISSIONS as readonly string[]).includes(p),
);

function StatusPill({ status }: { status: MemberRow["status"] }) {
  const styles: Record<MemberRow["status"], string> = {
    active: "bg-emerald-500/10 text-emerald-600",
    invited: "bg-amber-500/10 text-amber-600",
    revoked: "bg-muted text-muted-foreground",
  };
  const labels: Record<MemberRow["status"], string> = {
    active: "Active",
    invited: "Pending",
    revoked: "Revoked",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function TeamPage() {
  const { businessId } = Route.useSearch();
  const load = useServerFn(listMembers);
  const invite = useServerFn(inviteMember);
  const updatePerms = useServerFn(updateMemberPermissions);
  const revoke = useServerFn(revokeMember);
  const ent = useEntitlements();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([...DEFAULT_ADMIN_PERMISSIONS]);
  const [inviting, setInviting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setIsOwner(false); return; }
      const { data: business } = await supabase
        .from("businesses")
        .select("owner_id")
        .eq("id", businessId)
        .maybeSingle();
      setIsOwner(business?.owner_id === auth.user.id);
    })();
  }, [businessId]);

  const refresh = useCallback(async () => {
    try {
      setMembers(await load({ data: { businessId } }));
    } catch (error) {
      toast.error("Couldn't load your team", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [businessId, load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const limit = ent.check("administrators");

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const result = await invite({
        data: { businessId, email, permissions, environment: getPaddleEnvironment() },
      });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      setEmail("");
      setPermissions([...DEFAULT_ADMIN_PERMISSIONS]);
      await refresh();
      ent.refetch();
      toast.success(
        result.accessGranted ? "Administrator added" : result.emailSent ? "Invitation sent" : "Invitation created",
        {
          description: result.accessGranted || result.emailSent
            ? undefined
            : "Copy the invite link and send it to them yourself.",
        },
      );
    } catch (error) {
      toast.error("Couldn't send the invitation", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setInviting(false);
    }
  };

  const togglePermission = (list: Permission[], p: Permission): Permission[] =>
    list.includes(p) ? list.filter((x) => x !== p) : [...list, p];

  const saveMemberPermissions = async (member: MemberRow, next: Permission[]) => {
    setSavingId(member.id);
    // Optimistic: the checkbox should not lag behind the pointer.
    setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, permissions: next } : m)));
    try {
      const result = await updatePerms({ data: { businessId, memberId: member.id, permissions: next } });
      if (!result.ok) {
        toast.error(result.message ?? "Couldn't update permissions");
        await refresh();
      }
    } catch (error) {
      toast.error("Couldn't update permissions", {
        description: error instanceof Error ? error.message : undefined,
      });
      await refresh();
    } finally {
      setSavingId(null);
    }
  };

  const removeMember = async (member: MemberRow) => {
    if (!confirm(`Remove ${member.email}'s access to this business?`)) return;
    try {
      const result = await revoke({ data: { businessId, memberId: member.id } });
      if (!result.ok) {
        toast.error(result.message ?? "Couldn't remove access");
        return;
      }
      await refresh();
      ent.refetch();
      toast.success("Access removed");
    } catch (error) {
      toast.error("Couldn't remove access", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const copyInvite = async (member: MemberRow) => {
    if (!member.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(member.inviteUrl);
      setCopiedId(member.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  if (loading || isOwner === null) return <ScreenLoader />;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/business" search={{ businessId }}>
          <Button variant="ghost" size="icon" aria-label="Back to dashboard" className="rounded-full glass-panel">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Team</h1>
        <div className="w-9" />
      </header>

      <div className="flex-1 px-6 py-4 pb-16 max-w-2xl mx-auto w-full">
        {!isOwner ? (
          <div className="rounded-2xl border-2 border-ink/10 bg-card p-5 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <p className="mt-2">
              Only the business owner can manage administrators. You can see your own access on your
              profile.
            </p>
          </div>
        ) : (
          <>
            {/* Invite */}
            <section className="rounded-2xl border-2 border-ink/10 bg-card p-5">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-lg">Invite an administrator</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {limit.limit === null
                  ? `${limit.used} on your team — unlimited on ${ent.plan.name}.`
                  : ent.isTrial
                    ? `${limit.used} of ${limit.limit} used. Your free trial includes the ${ent.plan.name} plan.`
                    : `${limit.used} of ${limit.limit} used on your ${ent.plan.name} plan.`}
              </p>

              <form onSubmit={submitInvite} className="mt-4">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  aria-label="Administrator email address"
                  disabled={!limit.allowed}
                />

                <fieldset className="mt-4" disabled={!limit.allowed}>
                  <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Permissions
                  </legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {ASSIGNABLE.map((p) => (
                      <label key={p} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={permissions.includes(p)}
                          onChange={() => setPermissions((prev) => togglePermission(prev, p))}
                        />
                        <span className="text-muted-foreground">{PERMISSION_LABELS[p]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {!limit.allowed ? (
                  <div className="mt-4 rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
                    {limit.reason}{" "}
                    <Link to="/pricing" className="text-primary underline">
                      See plans
                    </Link>
                  </div>
                ) : null}

                <Button type="submit" disabled={inviting || !limit.allowed} className="mt-5 h-11 w-full">
                  {inviting ? <Spinner size={16} label={null} /> : <Mail className="h-4 w-4" />}
                  {inviting ? "Sending…" : "Send invitation"}
                </Button>
              </form>
            </section>

            {/* Members */}
            <section className="mt-6 space-y-3">
              {members.map((member) => (
                <div key={member.id} className="rounded-2xl border-2 border-ink/10 bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium truncate">
                          {member.displayName ?? member.email}
                        </span>
                        <StatusPill status={member.status} />
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {member.role}
                        </span>
                      </div>
                      {member.displayName ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{member.email}</p>
                      ) : null}
                    </div>

                    {member.role !== "owner" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${member.email}`}
                        onClick={() => removeMember(member)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>

                  {member.inviteUrl ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-secondary/60 p-2.5">
                      <code className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                        {member.inviteUrl}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyInvite(member)}
                        aria-label="Copy invitation link"
                      >
                        {copiedId === member.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  ) : null}

                  {member.role === "owner" ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      The owner has full access, including billing.
                    </p>
                  ) : (
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Permissions
                        </span>
                        {savingId === member.id ? <Spinner size={12} label={null} /> : null}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {ASSIGNABLE.map((p) => (
                          <label key={p} className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={member.permissions.includes(p)}
                              onChange={() =>
                                saveMemberPermissions(
                                  member,
                                  togglePermission(member.permissions, p),
                                )
                              }
                            />
                            <span className="text-muted-foreground">{PERMISSION_LABELS[p]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
