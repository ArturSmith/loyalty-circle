/**
 * Wallet pass telemetry — server-only.
 *
 * What Apple and Google actually give us is narrow: a pass was saved, or a pass
 * was removed. Neither platform reveals identity, email, or "the user looked at
 * their pass". Everything richer (stamps, redemptions) already comes from our
 * own scanning flow, so this module deliberately stays small.
 */

export type WalletPlatform = "google" | "apple";
export type WalletEvent = "created" | "saved" | "deleted";

/**
 * Records a wallet lifecycle event. Never throws — telemetry must not be able
 * to break pass creation or a platform callback.
 */
export async function recordWalletPassEvent(input: {
  cardInstanceId: string;
  templateId?: string | null;
  platform: WalletPlatform;
  event: WalletEvent;
  objectId?: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let templateId = input.templateId ?? null;
    if (!templateId) {
      const { data } = await supabaseAdmin
        .from("card_instances")
        .select("template_id")
        .eq("id", input.cardInstanceId)
        .maybeSingle();
      templateId = (data as { template_id?: string } | null)?.template_id ?? null;
    }

    // `wallet_pass_events` is not in the generated Supabase types yet — the
    // types are regenerated separately from migrations.
    await (supabaseAdmin as any).from("wallet_pass_events").upsert(
      {
        card_instance_id: input.cardInstanceId,
        template_id: templateId,
        platform: input.platform,
        event: input.event,
        object_id: input.objectId ?? null,
        created_at: new Date().toISOString(),
      } as any,
      { onConflict: "card_instance_id,platform,event" },
    );
  } catch (error) {
    console.error("recordWalletPassEvent failed", error);
  }
}

/**
 * Google Wallet object ids are built as `<issuerId>.obj<uuid-without-dashes>`
 * (see `objectIdFor` in googleWallet.server.ts). This reverses that so a
 * callback can be mapped back to a card instance.
 */
export function instanceIdFromGoogleObjectId(objectId: string): string | null {
  const marker = objectId.lastIndexOf(".obj");
  if (marker === -1) return null;
  const hex = objectId.slice(marker + 4);
  if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ]
    .join("-")
    .toLowerCase();
}
