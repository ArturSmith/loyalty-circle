import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const CARD_IN_USE_MESSAGE = "This card is already used by customers and cannot be edited. Create a new card instead.";

export function useCardEditability(templateId: string, enabled = true) {
  const [state, setState] = useState<{ id: string; canEdit: boolean | null; error: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setState(null);
    if (enabled) {
      void (async () => {
        try {
          const { data, error } = await supabase.rpc("card_has_customers", { _template_id: templateId });
          if (error || typeof data !== "boolean") throw error ?? new Error("Missing edit status");
          if (!cancelled) setState({ id: templateId, canEdit: !data, error: null });
        } catch {
          if (!cancelled) setState({ id: templateId, canEdit: null, error: "Could not check whether this card can be edited. Please reload and try again." });
        }
      })();
    }
    return () => { cancelled = true; };
  }, [templateId, enabled]);
  return enabled && state?.id === templateId ? state : { canEdit: null, error: null };
}
