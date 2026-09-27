package com.devopsmonk.aurora;

import android.annotation.SuppressLint;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * A hidden WebView at https://www.youtube.com/ for BotGuard, which only runs
 * in a real browser at YouTube's origin. The JavaScript side (src/mobile/
 * potoken.ts) loads po_token.html into it and evaluates expressions; each
 * result, awaited if it is a promise, comes back as JSON through a
 * JavascriptInterface, since evaluateJavascript can't wait for promises.
 * NewPipe's PoTokenWebView does the same.
 */
@CapacitorPlugin(name = "BotGuard")
public class BotGuardPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<Integer, PluginCall> pending = new ConcurrentHashMap<>();
    private final AtomicInteger ids = new AtomicInteger();
    private WebView web;

    private class Bridge {
        @JavascriptInterface
        public void resolve(int id, String json) {
            PluginCall call = pending.remove(id);
            if (call == null) return;
            JSObject out = new JSObject();
            out.put("json", json == null ? "null" : json);
            call.resolve(out);
        }

        @JavascriptInterface
        public void reject(int id, String message) {
            PluginCall call = pending.remove(id);
            if (call != null) call.reject(message);
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @PluginMethod
    public void load(PluginCall call) {
        String html = call.getString("html");
        String baseUrl = call.getString("baseUrl", "https://www.youtube.com/");
        if (html == null) {
            call.reject("html is required");
            return;
        }
        main.post(() -> {
            destroyWeb();
            web = new WebView(getContext());
            web.getSettings().setJavaScriptEnabled(true);
            web.getSettings().setDomStorageEnabled(true);
            web.addJavascriptInterface(new Bridge(), "AuroraBotGuard");
            web.setWebViewClient(new WebViewClient() {
                private boolean done;

                @Override
                public void onPageFinished(WebView view, String url) {
                    if (done) return;
                    done = true;
                    call.resolve();
                }
            });
            web.loadDataWithBaseURL(baseUrl, html, "text/html", "utf-8", null);
        });
    }

    @PluginMethod
    public void evaluate(PluginCall call) {
        String script = call.getString("script");
        if (script == null) {
            call.reject("script is required");
            return;
        }
        int id = ids.incrementAndGet();
        pending.put(id, call);
        String wrapped = "(function(){try{Promise.resolve(" + script + ")"
                + ".then(function(v){AuroraBotGuard.resolve(" + id + ",JSON.stringify(v===undefined?null:v))})"
                + ".catch(function(e){AuroraBotGuard.reject(" + id + ",String(e&&e.message||e))})"
                + "}catch(e){AuroraBotGuard.reject(" + id + ",String(e&&e.message||e))}})()";
        main.post(() -> {
            if (web == null) {
                pending.remove(id);
                call.reject("BotGuard page not loaded");
                return;
            }
            web.evaluateJavascript(wrapped, null);
        });
    }

    @PluginMethod
    public void close(PluginCall call) {
        main.post(() -> {
            destroyWeb();
            call.resolve();
        });
    }

    private void destroyWeb() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        for (PluginCall call : pending.values()) call.reject("BotGuard page closed");
        pending.clear();
    }

    @Override
    protected void handleOnDestroy() {
        main.post(this::destroyWeb);
    }
}
