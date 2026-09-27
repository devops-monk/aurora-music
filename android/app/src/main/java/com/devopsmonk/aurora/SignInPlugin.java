package com.devopsmonk.aurora;

import android.app.Activity;
import android.content.Intent;
import android.webkit.CookieManager;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Opens SignInActivity and returns the YouTube Music session as a Cookie header (or null if cancelled). */
@CapacitorPlugin(name = "SignIn")
public class SignInPlugin extends Plugin {

    @PluginMethod
    public void signIn(PluginCall call) {
        startActivityForResult(call, new Intent(getContext(), SignInActivity.class), "signInResult");
    }

    @ActivityCallback
    private void signInResult(PluginCall call, ActivityResult result) {
        JSObject out = new JSObject();
        Intent data = result.getData();
        String cookie = result.getResultCode() == Activity.RESULT_OK && data != null
                ? data.getStringExtra(SignInActivity.EXTRA_COOKIE)
                : null;
        out.put("cookie", cookie);
        call.resolve(out);
    }

    /** Forgets the Google session, so the next sign-in starts fresh. */
    @PluginMethod
    public void signOut(PluginCall call) {
        CookieManager manager = CookieManager.getInstance();
        manager.removeAllCookies(ignored -> {
            manager.flush();
            call.resolve();
        });
    }
}
