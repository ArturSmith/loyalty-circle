import { Link } from "@tanstack/react-router";
import { useDesktopLayout } from "@/hooks/useDesktopLayout";
import { useProfile } from "@/hooks/useProfile";
import { initialsFrom } from "@/lib/avatar";
import { CustomerQrCard } from "@/components/CustomerQrCard";

export function DesktopAccountTools() {
  const desktop = useDesktopLayout();
  return desktop ? <AccountTools /> : null;
}

function AccountTools() {
  const { profile } = useProfile();
  if (!profile) return null;
  return (
    <div className="pointer-events-auto mt-auto w-full space-y-4 border-t border-border pt-5">
      <CustomerQrCard userId={profile.id} qrToken={profile.customerQrToken} compact />
      <Link to="/profile" className="flex min-w-0 items-center gap-3 rounded-xl p-2 hover:bg-muted">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : initialsFrom(profile.displayName, profile.email)}
        </span>
        <span className="truncate text-sm font-semibold">{profile.displayName || "Profile"}</span>
      </Link>
    </div>
  );
}
