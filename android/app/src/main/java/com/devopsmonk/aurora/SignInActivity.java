package com.devopsmonk.aurora;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Google sign-in for YouTube Music, the Android twin of the desktop's
 * src/main/auth.ts and BitChord's YtMusicLoginScreen: Google's real sign-in
 * page in a WebView (so 2-step verification and passkeys work), and once it
 * lands back on music.youtube.com with a SAPISID cookie, that cookie jar is
 * the session, handed back to the app as a Cookie header.
 */
public class SignInActivity extends Activity {
    static final String EXTRA_COOKIE = "cookie";
    private static final String MUSIC_ORIGIN = "https://music.youtube.com";
    private static final String LOGIN_URL = "https://accounts.google.com/ServiceLogin"
            + "?ltmpl=music&service=youtube&passive=true"
            + "&continue=https%3A%2F%2Fmusic.youtube.com%2F";

    private WebView web;
    private boolean finished;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int pad = dp(12);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setFitsSystemWindows(true);
        root.setBackgroundColor(Color.WHITE);

        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(pad, pad / 2, pad, pad / 2);
        TextView title = new TextView(this);
        title.setText("Sign in to YouTube Music");
        title.setTextColor(Color.BLACK);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        Button cancel = new Button(this);
        cancel.setText("Cancel");
        cancel.setOnClickListener(v -> done(null));
        bar.addView(cancel);
        root.addView(bar);

        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (url != null && url.startsWith(MUSIC_ORIGIN)) {
                    String cookies = CookieManager.getInstance().getCookie(MUSIC_ORIGIN);
                    if (cookies != null && (cookies.contains("SAPISID=") || cookies.contains("__Secure-3PAPISID="))) {
                        CookieManager.getInstance().flush();
                        done(cookies);
                    }
                }
            }
        });
        root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
        web.loadUrl(LOGIN_URL);
    }

    private void done(String cookie) {
        if (finished) return;
        finished = true;
        if (cookie == null) setResult(RESULT_CANCELED);
        else setResult(RESULT_OK, new Intent().putExtra(EXTRA_COOKIE, cookie));
        finish();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else done(null);
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }
}
