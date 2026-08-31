package com.clubcarder.app;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private boolean nativeAuthOpen;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Bridge bridge = getBridge();
        WebView webView = bridge.getWebView();
        webView.addJavascriptInterface(new AuthNavigationBridge(), "ClubCarderNativeAuth");
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
}
