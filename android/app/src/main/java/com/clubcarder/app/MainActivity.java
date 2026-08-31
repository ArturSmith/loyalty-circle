package com.clubcarder.app;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.view.WindowManager;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import java.util.Locale;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private boolean nativeAuthOpen;
    private boolean qrBrightnessEnabled;
    private float brightnessBeforeQr = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
    private boolean keptScreenOnBeforeQr;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Bridge bridge = getBridge();
        WebView webView = bridge.getWebView();
        publishWindowInsets(webView);
        webView.addJavascriptInterface(new AuthNavigationBridge(), "ClubCarderNativeAuth");
        webView.addJavascriptInterface(new DisplayBridge(), "ClubCarderNativeDisplay");
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.isForMainFrame() && openNativeAuthIfNeeded(request.getUrl())) return true;
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                openNativeAuthIfNeeded(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                installAuthNavigationWatcher(view);
            }
        });

        String redirect = getIntent().getStringExtra(LoginActivity.EXTRA_REDIRECT);
        if (redirect != null && redirect.startsWith("/") && !redirect.startsWith("//")) {
            webView.loadUrl("https://clubcarder.com" + redirect);
        }
    }

    private boolean openNativeAuthIfNeeded(Uri uri) {
        if (!isClubCarderAuthUri(uri)) return false;
        launchNativeAuth(uri.getQueryParameter("redirect"));
        return true;
    }

    /**
     * Mirrors the window insets into CSS custom properties.
     *
     * `env(safe-area-inset-top)` is not a substitute on Android: the WebView
     * only reports display *cutouts* there, not the status bar. From Android 15
     * every app is laid out edge to edge whether it asks to be or not, so the
     * page sits underneath the status bar while the inset it would consult
     * reads zero -- on any phone without a notch, content collides with the
     * clock. Reading the real insets and publishing them is the only reliable
     * source.
     *
     * The listener returns the insets unconsumed so Capacitor and any plugin
     * that also observes them still sees them.
     */
    private void publishWindowInsets(WebView webView) {
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            float density = view.getResources().getDisplayMetrics().density;
            if (density <= 0) density = 1f;

            // CSS pixels, matching the units the stylesheet works in.
            String script = String.format(
                Locale.US,
                "(function(s){"
                    + "s.setProperty('--android-inset-top','%.2fpx');"
                    + "s.setProperty('--android-inset-right','%.2fpx');"
                    + "s.setProperty('--android-inset-bottom','%.2fpx');"
                    + "s.setProperty('--android-inset-left','%.2fpx');"
                    + "})(document.documentElement.style);",
                insets.top / density,
                insets.right / density,
                insets.bottom / density,
                insets.left / density);
            webView.evaluateJavascript(script, null);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(webView);
    }

    @Override
    public void onResume() {
        super.onResume();
        // `nativeAuthOpen` only guards against launching twice while the login
        // screen is already in front. Being resumed means it is not, so the
        // latch has to be cleared here -- otherwise it stays stuck true for the
        // life of the process and every later visit to /auth silently falls
        // through to the web sign-in page.
        //
        // The re-check matters because a task restored from recents keeps the
        // WebView exactly where it was: still on /auth, with no navigation to
        // re-trigger shouldOverrideUrlLoading or onPageStarted.
        nativeAuthOpen = false;
        String currentUrl = getBridge().getWebView().getUrl();
        if (currentUrl != null) openNativeAuthIfNeeded(Uri.parse(currentUrl));
    }

    private boolean isClubCarderAuthUri(Uri uri) {
        return uri != null
            && "https".equalsIgnoreCase(uri.getScheme())
            && "clubcarder.com".equalsIgnoreCase(uri.getHost())
            && "/auth".equals(uri.getPath());
    }

    private void launchNativeAuth(String redirect) {
        if (nativeAuthOpen) return;
        nativeAuthOpen = true;
        Intent intent = new Intent(this, LoginActivity.class);
        if (redirect != null && redirect.startsWith("/") && !redirect.startsWith("//")) {
            intent.putExtra(LoginActivity.EXTRA_REDIRECT, redirect);
        }
        startActivity(intent);
    }

    private void installAuthNavigationWatcher(WebView webView) {
        String script = "(function(){"
            + "if(window.__clubCarderNativeAuthInstalled){window.__clubCarderCheckAuth();return;}"
            + "window.__clubCarderNativeAuthInstalled=true;"
            + "window.__clubCarderCheckAuth=function(){try{"
            + "if(location.origin==='https://clubcarder.com'&&location.pathname==='/auth'){"
            + "var redirect=new URLSearchParams(location.search).get('redirect')||'';"
            + "window.ClubCarderNativeAuth.open(redirect);}}catch(e){}};"
            + "['pushState','replaceState'].forEach(function(name){var original=history[name];"
            + "history[name]=function(){var result=original.apply(this,arguments);setTimeout(window.__clubCarderCheckAuth,0);return result;};});"
            + "addEventListener('popstate',window.__clubCarderCheckAuth);"
            + "window.__clubCarderCheckAuth();"
            + "})();";
        webView.evaluateJavascript(script, null);
    }

    private final class AuthNavigationBridge {
        @JavascriptInterface
        public void open(String redirect) {
            runOnUiThread(() -> {
                WebView webView = getBridge().getWebView();
                String currentUrl = webView.getUrl();
                if (currentUrl == null) return;
                Uri current = Uri.parse(currentUrl);
                if (isClubCarderAuthUri(current)) launchNativeAuth(redirect);
            });
        }
    }

    private void setQrBrightness(boolean enabled) {
        WindowManager.LayoutParams attributes = getWindow().getAttributes();
        if (enabled) {
            if (qrBrightnessEnabled) return;
            qrBrightnessEnabled = true;
            brightnessBeforeQr = attributes.screenBrightness;
            keptScreenOnBeforeQr = (attributes.flags & WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) != 0;
            attributes.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL;
            attributes.flags |= WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
        } else {
            if (!qrBrightnessEnabled) return;
            qrBrightnessEnabled = false;
            attributes.screenBrightness = brightnessBeforeQr;
            if (!keptScreenOnBeforeQr) {
                attributes.flags &= ~WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
            }
        }
        getWindow().setAttributes(attributes);
    }

    private final class DisplayBridge {
        @JavascriptInterface
        public void setQrBrightness(boolean enabled) {
            runOnUiThread(() -> MainActivity.this.setQrBrightness(enabled));
        }
    }

    @Override
    public void onDestroy() {
        setQrBrightness(false);
        super.onDestroy();
    }
}
