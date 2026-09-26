/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Last.fm credentials, from the build environment (see README). */
  readonly MAIN_VITE_LASTFM_API_KEY?: string
  readonly MAIN_VITE_LASTFM_SECRET?: string
  /** Discord Application id for Rich Presence; Settings can override it. */
  readonly MAIN_VITE_DISCORD_CLIENT_ID?: string
}
