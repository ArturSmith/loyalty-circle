import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  ChevronRight,
  CreditCard,
  HelpCircle,
  LogOut,
  Mail,
  MessageCircle,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { z } from "zod";
import { BackButton } from "@/components/BackButton";
import { ScreenLoader } from "@/components/Spinner";
import { TabScreen } from "@/components/TabScreen";
import { useBusinessPermissions } from "@/hooks/useBusinessPermissions";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { supabase } from "@/integrations/supabase/client";
import { postSignOutDestination } from "@/lib/post-sign-out";

export const Route = createFileRoute("/_authenticated/business/menu")({
  head: () => ({ meta: [{ title: "Menu — ClubCarder" }] }),
  validateSearch: z.object({ businessId: z.string().uuid() }),
  component: BusinessMenu,
});

const menuItemClassName =
  "flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function MenuItemContent({
  icon: Icon,
  label,
  count = 0,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
}) {
  return (
    <>
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{label}</span>
      {count > 0 && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-none text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );
}

function BusinessMenu() {
  const navigate = useNavigate();
  const { businessId } = Route.useSearch();
  const permissions = useBusinessPermissions(businessId);
  const unreadChats = useUnreadChatCount("business");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: postSignOutDestination(), replace: true });
  };

  if (permissions.loading) return <ScreenLoader />;
  if (!permissions.role) return <Navigate to="/workspace" replace />;

  const canEditSettings =
    permissions.isOwner || permissions.hasAny(["locations.manage", "marketplace.manage"]);

  return (
    <TabScreen
      title="Menu"
      backAction={
        <BackButton
          label="Back to business dashboard"
          onClick={() => navigate({ to: "/business", search: { businessId } })}
        />
      }
      contentClassName="flex-1 px-5 py-6"
    >
      <nav aria-label="Menu" className="mx-auto w-full max-w-2xl space-y-4">
        <div className="rounded-2xl border border-border bg-card p-2">
          <Link to="/business/team" search={{ businessId }} className={menuItemClassName}>
            <MenuItemContent icon={Users} label="My team" />
          </Link>
          {permissions.has("customers.message") && (
            <Link to="/business/chats" search={{ businessId }} className={menuItemClassName}>
              <MenuItemContent icon={MessageCircle} label="Messages" count={unreadChats} />
            </Link>
          )}
          {permissions.has("analytics.view") && (
            <Link to="/business/analytics" search={{ businessId }} className={menuItemClassName}>
              <MenuItemContent icon={BarChart3} label="Analytics" />
            </Link>
          )}
          {canEditSettings && (
            <Link to="/business/edit" search={{ businessId }} className={menuItemClassName}>
              <MenuItemContent icon={Settings} label="Edit business info" />
            </Link>
          )}
          {permissions.isOwner && (
            <Link to="/settings/billing" className={menuItemClassName}>
              <MenuItemContent icon={CreditCard} label="Billing & plan" />
            </Link>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-2">
          <Link to="/wallet" className={menuItemClassName}>
            <MenuItemContent icon={Wallet} label="My wallet" />
          </Link>
          <Link to="/help" className={menuItemClassName}>
            <MenuItemContent icon={HelpCircle} label="Help" />
          </Link>
          <Link to="/contact" className={menuItemClassName}>
            <MenuItemContent icon={Mail} label="Contact us" />
          </Link>
          <button type="button" onClick={signOut} className={menuItemClassName}>
            <MenuItemContent icon={LogOut} label="Sign out" />
          </button>
        </div>
      </nav>
    </TabScreen>
  );
}
