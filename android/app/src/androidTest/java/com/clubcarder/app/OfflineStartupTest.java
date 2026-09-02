package com.clubcarder.app;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.view.View;
import android.view.accessibility.AccessibilityNodeInfo;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Run only on a disposable emulator: this suite toggles its network state. */
@RunWith(AndroidJUnit4.class)
public class OfflineStartupTest {
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private final Context context = instrumentation.getTargetContext();
    private SharedPreferences preferences;
    private String key;
    private String originalSession;
    private Activity login;
    private static final String EXPIRED_SESSION = "{\"access_token\":\"offline-test-access\",\"refresh_token\":\"offline-test-refresh\",\"expires_at\":1}";

    @Before public void offline() throws Exception {
        assumeTrue("Disposable emulator only", Build.HARDWARE.equals("ranchu") || Build.HARDWARE.equals("goldfish"));
        preferences = context.getSharedPreferences(NativeSessionStore.PREFERENCES, Context.MODE_PRIVATE);
        key = NativeSessionStore.storageKey(BuildConfig.SUPABASE_URL);
        originalSession = preferences.getString(key, null);
        shell("svc wifi disable"); shell("svc data disable");
        waitForNetwork(false);
    }

    @After public void restore() throws Exception {
        if (preferences == null) return;
        if (login != null) instrumentation.runOnMainSync(() -> login.finishAffinity());
        if (originalSession == null) preferences.edit().remove(key).commit();
        else preferences.edit().putString(key, originalSession).commit();
        shell("svc wifi enable"); shell("svc data enable");
    }

    @Test public void signedOutLaunchOpensNativeLoginWithoutAWebRequest() throws Exception {
        preferences.edit().remove(key).commit();
        Instrumentation.ActivityMonitor monitor = instrumentation.addMonitor(LoginActivity.class.getName(), null, false);
        try {
            context.startActivity(new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            login = instrumentation.waitForMonitorWithTimeout(monitor, 5000);
            assertNotNull("Native login must open without waiting for /auth", login);
            assertNotNull(waitForText(context.getString(R.string.auth_welcome_title)));
            screenshot("offline-login.png");
            AccessibilityNodeInfo submit = waitForText(context.getString(R.string.auth_continue));
            click(submit);
            assertNotNull(waitForText(context.getString(R.string.auth_network_error)));
            assertNull(preferences.getString(key, null));
        } finally { instrumentation.removeMonitor(monitor); }
    }

    @Test public void expiredSessionStaysOfflineAndRetryCanRecover() throws Exception {
        preferences.edit().putString(key, EXPIRED_SESSION).commit();
        assertTrue(NativeSessionStore.hasSavedSession(context));
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            assertNotNull(waitForText(context.getString(R.string.app_offline_title)));
            screenshot("offline-saved-session.png");
            scenario.onActivity(activity -> {
                assertNotNull(activity.getBridge());
                assertEquals(View.INVISIBLE, activity.getBridge().getWebView().getVisibility());
            });
            click(waitForText(context.getString(R.string.app_retry)));
            assertNotNull(waitForText(context.getString(R.string.app_offline_title)));
            assertEquals(EXPIRED_SESSION, preferences.getString(key, null));

            // Serve the retry entirely in-process. No real account, login or server is used.
            scenario.onActivity(activity -> {
                WebView web = activity.getBridge().getWebView();
                WebViewClient original = web.getWebViewClient();
                web.setWebViewClient(new WebViewClient() {
                    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        // The production router can change the path before the
                        // initial document finishes loading.
                        byte[] html = "<html><body><script>history.replaceState({}, '', '/wallet')</script>Offline retry recovered</body></html>".getBytes(StandardCharsets.UTF_8);
                        return new WebResourceResponse("text/html", "UTF-8", new ByteArrayInputStream(html));
                    }
                    @Override public void onPageStarted(WebView view, String url, Bitmap icon) { original.onPageStarted(view, url, icon); }
                    @Override public void onPageFinished(WebView view, String url) { original.onPageFinished(view, url); }
                });
            });
            shell("svc wifi enable"); waitForNetwork(true);
            click(waitForText(context.getString(R.string.app_retry)));
            assertNotNull(waitForText("Offline retry recovered"));
            scenario.onActivity(activity -> assertEquals(View.VISIBLE, activity.getBridge().getWebView().getVisibility()));
            assertEquals(EXPIRED_SESSION, preferences.getString(key, null));
        }
    }

    @Test public void malformedAndMissingSessionsDoNotEraseStoredData() {
        for (String value : new String[] { "invalid json", "{}", "{\"access_token\":\"token\"}" }) {
            preferences.edit().putString(key, value).commit();
            assertFalse(NativeSessionStore.hasSavedSession(context));
            assertEquals(value, preferences.getString(key, null));
        }
    }

    private void shell(String command) throws Exception {
        try (ParcelFileDescriptor output = instrumentation.getUiAutomation().executeShellCommand(command);
             ParcelFileDescriptor.AutoCloseInputStream input = new ParcelFileDescriptor.AutoCloseInputStream(output)) {
            byte[] buffer = new byte[1024];
            while (input.read(buffer) != -1) { /* Drain command output, never session data. */ }
        }
    }

    private void screenshot(String name) throws Exception {
        instrumentation.waitForIdleSync();
        instrumentation.getUiAutomation().waitForIdle(500, 5000);
        Bitmap image = instrumentation.getUiAutomation().takeScreenshot();
        assertNotNull(image);
        try (FileOutputStream output = new FileOutputStream(new File(context.getCacheDir(), name))) {
            image.compress(Bitmap.CompressFormat.PNG, 100, output);
        } finally { image.recycle(); }
    }

    private void waitForNetwork(boolean online) {
        long deadline = SystemClock.uptimeMillis() + 20000;
        while (NativeConnectivity.isOnline(context) != online && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(100);
        assertEquals("Emulator network state", online, NativeConnectivity.isOnline(context));
    }

    private AccessibilityNodeInfo waitForText(String text) {
        long deadline = SystemClock.uptimeMillis() + 10000;
        while (SystemClock.uptimeMillis() < deadline) {
            AccessibilityNodeInfo root = instrumentation.getUiAutomation().getRootInActiveWindow();
            AccessibilityNodeInfo match = findText(root, text);
            if (match != null) return match;
            SystemClock.sleep(100);
        }
        fail("Text not displayed: " + text);
        return null;
    }

    private AccessibilityNodeInfo findText(AccessibilityNodeInfo node, String text) {
        if (node == null) return null;
        if (node.getText() != null && node.getText().toString().equals(text)) return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo match = findText(node.getChild(i), text);
            if (match != null) return match;
        }
        return null;
    }

    private void click(AccessibilityNodeInfo node) {
        while (node != null && !node.isClickable()) node = node.getParent();
        assertNotNull("Clickable control", node);
        assertTrue(node.performAction(AccessibilityNodeInfo.ACTION_CLICK));
    }
}
