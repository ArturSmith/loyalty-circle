import { supabase } from "@/integrations/supabase/client";

export const AVATAR_BUCKET = "avatars";

/**
 * Profile avatars are stored either as an external URL (legacy / OAuth pictures)
 * or as a path inside the private `avatars` bucket (`<user-id>/<file>`).
 * This resolves either form into something an <img> can render.
 */
export async function resolveAvatarUrl(value?: string | null): Promise<string | null> {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(value, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function resolveAvatarUrls(values: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(values.filter(Boolean) as string[])).map(async (v) => {
      const url = await resolveAvatarUrl(v);
      if (url) out.set(v, url);
    }),
  );
  return out;
}

export function initialsFrom(name?: string | null, email?: string | null): string {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
