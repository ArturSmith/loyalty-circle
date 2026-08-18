import { isNativeApp } from "@/lib/native";

/**
 * Where to land someone after they sign out.
 *
 * On the web the landing page is the right answer — it's the marketing pitch and
 * the way back in. In the installed app there's nothing to pitch, and `/` only
 * bounces to `/auth` anyway; going there directly avoids a visible flash of the
 * landing page before the redirect catches up.
 */
export function postSignOutDestination(): "/auth" | "/" {
  return isNativeApp() ? "/auth" : "/";
}
