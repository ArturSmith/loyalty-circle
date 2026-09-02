package com.clubcarder.app;

import static org.junit.Assert.*;
import org.junit.Test;

public class NativeSessionStoreTest {
    @Test public void keyMatchesNativeLoginAndSupabasePreferences() {
        assertEquals("sb-project-ref-auth-token", NativeSessionStore.storageKey("https://project-ref.supabase.co"));
        assertEquals("sb-clubcarder-auth-token", NativeSessionStore.storageKey(""));
        assertEquals("sb-clubcarder-auth-token", NativeSessionStore.storageKey("not a URL"));
    }

    @Test public void bothTokensAreNeededForSessionRestoration() {
        assertTrue(NativeSessionStore.hasTokens("saved-access", "saved-refresh"));
        assertFalse(NativeSessionStore.hasTokens(null, "saved-refresh"));
        assertFalse(NativeSessionStore.hasTokens("saved-access", null));
        assertFalse(NativeSessionStore.hasTokens(" ", "saved-refresh"));
        assertFalse(NativeSessionStore.hasTokens("saved-access", ""));
        assertFalse(NativeSessionStore.hasTokens(42, "saved-refresh"));
    }
}
