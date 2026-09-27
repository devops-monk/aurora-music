package com.devopsmonk.aurora;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Aurora's own native pieces: BotGuard for stream tokens, the playback service, and Google sign-in.
        registerPlugin(BotGuardPlugin.class);
        registerPlugin(PlaybackPlugin.class);
        registerPlugin(SignInPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
