import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Aurora Music on Android: the same renderer, built by vite.mobile.config.ts
 * into out/mobile, inside a Capacitor WebView.
 */
const config: CapacitorConfig = {
  appId: 'com.devopsmonk.aurora',
  appName: 'Aurora Music',
  webDir: 'out/mobile',
  // Debug builds otherwise log every native HTTP response in full; YouTube's
  // player responses are large enough that this slows playback start.
  loggingBehavior: 'none',
  android: {
    path: 'android',
    backgroundColor: '#000000',
  },
  plugins: {
    // Route fetch through the native HTTP stack: YouTube, LRCLIB and the rest
    // send no CORS headers, and the desktop app calls them from Node.
    CapacitorHttp: { enabled: true },
  },
}

export default config
