/**
 * Returns the default landing path for a signed-in user.
 * Everyone lands on `/wallet`; the business dashboard is only reached
 * through the explicit business menu/CTA, not automatically.
 */
export async function getDefaultHome(_userId?: string | null): Promise<"/wallet"> {
  return "/wallet";
}
