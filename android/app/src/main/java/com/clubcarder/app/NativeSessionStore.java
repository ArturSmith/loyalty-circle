package com.clubcarder.app;

import android.content.Context;
import org.json.JSONException;
import org.json.JSONObject;
import java.net.URI;

/** The same durable store used by LoginActivity and the web Preferences adapter. */
final class NativeSessionStore {
    static final String PREFERENCES = "CapacitorStorage";

    static String storageKey(String supabaseUrl) {
        String project = "clubcarder";
        try {
            String host = URI.create(supabaseUrl).getHost();
            if (host != null && !host.isEmpty()) project = host.split("\\.")[0];
        } catch (IllegalArgumentException ignored) {
            // An unconfigured build can still open the local login UI.
        }
        return "sb-" + project + "-auth-token";
    }

    static boolean hasSavedSession(Context context) {
        String value = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .getString(storageKey(BuildConfig.SUPABASE_URL), null);
        if (value == null) return false;
        try {
            JSONObject session = new JSONObject(value);
            // This is a routing hint, not authentication. In particular, never
            // discard an expired access token: refresh needs an internet connection.
            return hasTokens(session.opt("access_token"), session.opt("refresh_token"));
        } catch (JSONException ignored) {
            return false;
        }
    }

    static boolean hasTokens(Object access, Object refresh) {
        return access instanceof String && !((String) access).trim().isEmpty()
            && refresh instanceof String && !((String) refresh).trim().isEmpty();
    }
}
