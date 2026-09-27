package com.devopsmonk.aurora;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Aurora's own native pieces: BotGuard for stream tokens, and the playback service.
        registerPlugin(BotGuardPlugin.class);
        registerPlugin(PlaybackPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
