import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { ScreenLoader } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { useBusinessPermissions } from "@/hooks/useBusinessPermissions";
import type { Permission } from "@/lib/plans";

export function BusinessPermissionGate({
  businessId,
  permission,
  anyOf,
  allOf,
  children,
}: {
  businessId: string;
  permission?: Permission;
  anyOf?: readonly Permission[];
  allOf?: readonly Permission[];
  children: ReactNode;
}) {
  const access = useBusinessPermissions(businessId);
  if (access.loading) return <ScreenLoader />;

  const allowed = permission
    ? access.has(permission)
    : anyOf
      ? access.hasAny(anyOf)
      : allOf
        ? allOf.every(access.has)
        : access.role !== null;
  if (allowed) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <LockKeyhole className="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold">Permission required</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The business owner has not granted you access to this feature. Ask the owner to update your
        permissions.
      </p>
      <Button asChild className="mt-6">
        <Link to="/business" search={{ businessId }}>
          Back to dashboard
        </Link>
      </Button>
    </div>
  );
}
