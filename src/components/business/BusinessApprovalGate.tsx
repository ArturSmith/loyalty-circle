import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ScreenLoader } from "@/components/Spinner";
import { getNavigationCache, setNavigationCache } from "@/lib/navigationCache";

/** Pending businesses must not open operational routes through a saved URL. */
export function BusinessApprovalGate({
  businessId,
  children,
}: {
  businessId?: string;
  children: ReactNode;
}) {
  const key = `business-approval:${businessId}`;
  const [result, setResult] = useState<{ key: string; accepted: boolean } | null>(() => {
    const cached = getNavigationCache<boolean>(key);
    return cached ? { key, accepted: cached.value } : null;
  });
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    setError(false);
    void (async () => {
      const { data, error: loadError } = await supabase
        .from("businesses")
        .select("accepted_by_platform")
        .eq("id", businessId)
        .maybeSingle();
      if (cancelled) return;
      if (loadError || !data) {
        setError(true);
        return;
      }
      setNavigationCache(key, data.accepted_by_platform);
      setResult({ key, accepted: data.accepted_by_platform });
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, key]);
  if (!businessId) return children;
  if (error)
    return (
      <div className="p-6 text-center">
        <p role="alert">Could not load this business.</p>
        <Link to="/workspace" className="mt-4 inline-block text-primary">
          Back to workspace
        </Link>
      </div>
    );
  if (!result || result.key !== key) return <ScreenLoader />;
  if (!result.accepted) return <Navigate to="/business/review" search={{ businessId }} replace />;
  return children;
}
