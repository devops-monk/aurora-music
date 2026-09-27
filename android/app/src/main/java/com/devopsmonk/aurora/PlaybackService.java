package com.devopsmonk.aurora;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * A foreground "media playback" service with a MediaSession: the
 * notification and lock-screen controls, and the reason Android keeps the
 * app (and the WebView playing the audio) alive with the screen off.
 * Playback itself stays in the WebView; this only mirrors it.
 */
public class PlaybackService extends Service {
    static final String ACTION_UPDATE = "com.devopsmonk.aurora.UPDATE";
    private static final String ACTION_BUTTON = "com.devopsmonk.aurora.BUTTON";
    private static final String CHANNEL = "playback";
    private static final int NOTIFICATION_ID = 1;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private MediaSessionCompat session;
    private String title = "", artist = "", album = "", artworkUrl;
    private boolean playing;
    private long positionMs, durationMs;
    private Bitmap artwork;
    private String artworkFor;

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Playback", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        session = new MediaSessionCompat(this, "Aurora Music");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { PlaybackPlugin.emit("play", null); }
            @Override public void onPause() { PlaybackPlugin.emit("pause", null); }
            @Override public void onSkipToNext() { PlaybackPlugin.emit("next", null); }
            @Override public void onSkipToPrevious() { PlaybackPlugin.emit("previous", null); }
            @Override public void onStop() { PlaybackPlugin.emit("stop", null); }
            @Override public void onSeekTo(long pos) { PlaybackPlugin.emit("seek", pos); }
        });
        session.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_BUTTON.equals(intent.getAction())) {
            PlaybackPlugin.emit(intent.getStringExtra("button"), null);
        } else if (intent != null && ACTION_UPDATE.equals(intent.getAction())) {
            title = intent.getStringExtra("title");
            artist = intent.getStringExtra("artist");
            album = intent.getStringExtra("album");
            artworkUrl = intent.getStringExtra("artworkUrl");
            playing = intent.getBooleanExtra("playing", false);
            positionMs = intent.getLongExtra("positionMs", 0);
            durationMs = intent.getLongExtra("durationMs", 0);
            if (artworkUrl != null && !artworkUrl.equals(artworkFor)) loadArtwork(artworkUrl);
        }
        publish();
        return START_NOT_STICKY;
    }

    private void publish() {
        MediaMetadataCompat.Builder meta = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);
        if (artwork != null) meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork);
        session.setMetadata(meta.build());
        session.setPlaybackState(new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
                        | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                        | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_SEEK_TO
                        | PlaybackStateCompat.ACTION_STOP)
                .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                        positionMs, playing ? 1f : 0f)
                .build());

        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent content = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_aurora)
                .setContentTitle(title)
                .setContentText(artist)
                .setLargeIcon(artwork)
                .setContentIntent(content)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(playing)
                .addAction(android.R.drawable.ic_media_previous, "Previous", button("previous", 1))
                .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                        playing ? "Pause" : "Play", button(playing ? "pause" : "play", 2))
                .addAction(android.R.drawable.ic_media_next, "Next", button("next", 3))
                .setStyle(new MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2))
                .build();

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);
        // Paused: keep the notification, but let Android reclaim the service if it needs to.
        if (!playing) ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH);
    }

    private PendingIntent button(String name, int requestCode) {
        Intent intent = new Intent(this, PlaybackService.class).setAction(ACTION_BUTTON).putExtra("button", name);
        return PendingIntent.getService(this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void loadArtwork(String url) {
        artworkFor = url;
        io.execute(() -> {
            Bitmap bitmap = null;
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                try (InputStream in = conn.getInputStream()) {
                    bitmap = BitmapFactory.decodeStream(in);
                }
            } catch (Exception ignored) {
                // No artwork is fine; the notification shows without it.
            }
            Bitmap result = bitmap;
            main.post(() -> {
                if (!url.equals(artworkFor)) return;
                artwork = result;
                publish();
            });
        });
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (!playing) stopSelf();
    }

    @Override
    public void onDestroy() {
        session.release();
        io.shutdownNow();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
