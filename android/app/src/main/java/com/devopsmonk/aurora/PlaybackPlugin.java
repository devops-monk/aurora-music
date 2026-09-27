package com.devopsmonk.aurora;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The JavaScript side of PlaybackService: src/mobile/playback.ts sends the
 * current track and play state here, and the notification's buttons come
 * back as "action" events.
 */
@CapacitorPlugin(name = "Playback")
public class PlaybackPlugin extends Plugin {
    private static PlaybackPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /** Called by PlaybackService for notification and lock-screen buttons. */
    static void emit(String action, Long positionMs) {
        PlaybackPlugin plugin = instance;
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        if (positionMs != null) data.put("positionMs", positionMs);
        plugin.notifyListeners("action", data, true);
    }

    @PluginMethod
    public void update(PluginCall call) {
        Intent intent = new Intent(getContext(), PlaybackService.class)
                .setAction(PlaybackService.ACTION_UPDATE)
                .putExtra("title", call.getString("title", ""))
                .putExtra("artist", call.getString("artist", ""))
                .putExtra("album", call.getString("album", ""))
                .putExtra("artworkUrl", call.getString("artworkUrl"))
                .putExtra("playing", Boolean.TRUE.equals(call.getBoolean("playing", false)))
                .putExtra("positionMs", call.getDouble("positionMs", 0.0).longValue())
                .putExtra("durationMs", call.getDouble("durationMs", 0.0).longValue());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
        else getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), PlaybackService.class));
        call.resolve();
    }
}
