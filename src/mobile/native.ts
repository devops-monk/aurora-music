import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/**
 * The two native pieces the phone needs that a WebView can't do itself.
 * Their Java halves live in android/app/src/main/java/com/devopsmonk/aurora.
 */

/** A hidden WebView at www.youtube.com for BotGuard (see potoken.ts). */
export interface BotGuardPlugin {
  load(options: { html: string; baseUrl: string }): Promise<void>
  /** Runs `script` as an expression, awaits it if it's a promise, and returns it as JSON. */
  evaluate(options: { script: string }): Promise<{ json: string }>
  close(): Promise<void>
}

export interface NowPlayingInfo {
  title: string
  artist: string
  album?: string | null
  artworkUrl?: string | null
  playing: boolean
  positionMs: number
  durationMs: number
}

export type PlaybackAction = 'play' | 'pause' | 'next' | 'previous' | 'stop' | 'seek'

/** A foreground service with a media notification, so music keeps playing with the screen off. */
export interface PlaybackPlugin {
  update(info: NowPlayingInfo): Promise<void>
  stop(): Promise<void>
  addListener(
    event: 'action',
    cb: (e: { action: PlaybackAction; positionMs?: number }) => void,
  ): Promise<PluginListenerHandle>
}

/** Google's sign-in page in a native screen; resolves with the YouTube Music cookies, or null if cancelled. */
export interface SignInPlugin {
  signIn(): Promise<{ cookie: string | null }>
  signOut(): Promise<void>
}

export const BotGuard = registerPlugin<BotGuardPlugin>('BotGuard')
export const SignIn = registerPlugin<SignInPlugin>('SignIn')
export const Playback = registerPlugin<PlaybackPlugin>('Playback')
