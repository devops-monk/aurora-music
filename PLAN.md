# Aurora Music: plan (macOS · Windows · Linux)

## Context
`BitChord/` is an Android YouTube Music client (Kotlin + Jetpack Compose, ~119k LOC, GPLv3) with a deliberately **Apple Music look**: SF Pro Display, heavy tight type, pure black/white surfaces, frosted-glass bars (Haze), an iOS 26-style floating tab bar with a mini-player accessory, artwork-driven page tints (`ArtworkPalette`), an animated mesh-gradient Now Playing backdrop, and Apple-style word-synced lyrics.
The user wants a desktop app for all three OSes with an **identical UI**, called **Aurora Music**. It will live in a **sibling folder**, `/Users/abhaypratapsingh/Documents/Personal/music/aurora-music/`, and ship a **core MVP first**.
Fonts: native SF Pro on macOS and **Inter** on Windows/Linux, because SF Pro's license only covers Apple platforms.

## Stack decision: Electron + React + TypeScript (not Tauri)
- **Identical rendering everywhere.** Electron ships the same Chromium on every OS. Tauri uses WebKitGTK on Linux and WKWebView on macOS, and both have weak `backdrop-filter` performance and missing codecs (Opus/WebM). The frosted glass and the audio would differ from one OS to the next.
- **YouTube Music backend in JS already exists.** `youtubei.js` (LuanRT) implements InnerTube, WEB_REMIX, signature/`n` deciphering and visitor data. That is the same job `Innertube.kt`, `StreamResolver.kt` and NewPipe do on Android. It runs in Electron's Node main process.
- Chromium `<audio>` plus Web Audio plays Opus/WebM and AAC natively and gives us EQ and crossfade later. `navigator.mediaSession` hooks into macOS Now Playing, Windows SMTC and Linux MPRIS for free.
- Tooling: `electron-vite`, React 19, TypeScript, Zustand (player/UI state), TanStack Query (feeds/pages), Framer Motion (springs matching Compose), `electron-builder` (packaging).
- License: GPLv3 (it is a derivative of BitChord). Credit BitChord in About.

## Project layout (`music/aurora-music/`)
```
PLAN.md                      ← copy of this plan
package.json, electron.vite.config.ts, electron-builder.yml, tsconfig*.json
build/                       icons (icns/ico/png from BitChord/Logo.png), entitlements.mac.plist
src/main/                    Electron main (Node)
  index.ts                   window creation, per-OS chrome, single-instance, deep links
  ytm/client.ts              youtubei.js wrapper: home, explore, library, search, browse, next, lyrics
  ytm/parse.ts               raw InnerTube → shared models (mirrors InnertubeParser.kt)
  ytm/stream.ts              best-audio format pick + decipher (mirrors StreamChoice.kt)
  protocol.ts                `aurora://stream/<videoId>` custom protocol: Range-aware proxy of the googlevideo URL
  auth.ts                    Google sign-in BrowserWindow → cookies → safeStorage (mirrors AuthStore/WebSession)
  lyrics/{lrclib,youtube,betterlyrics}.ts   (ports of data/lyrics/*)
  settings.ts                electron-store JSON settings (subset of AppSettings.kt)
  ipc.ts                     typed IPC handlers
src/preload/index.ts         contextBridge → `window.aurora` typed API
src/shared/models.ts         Song, Album, Artist, Playlist, Shelf, HomeFeed (ports of data/model/Models.kt)
src/renderer/
  styles/tokens.css          colour/type/radius/spacing tokens (from Theme.kt + Common.kt)
  theme/palette.ts           ArtworkPalette port (node-vibrant quantise → page tint/accent/text)
  components/                GlassSurface, FloatingTabBar, MiniPlayer, FrostedTopBar, SongRow, ShelfCard,
                             HeroCard, Shelf, SectionHeader, PillTextField, Skeletons, Sheet, ContextMenu, Icons
  player/                    NowPlaying, ArtworkMesh (WebGL), Scrubber, Transport, VolumeRow, Lyrics, Queue
  screens/                   Home, Explore, Library, Search, Detail (album/playlist/artist), Settings, SignIn
  audio/engine.ts            <audio> + Web Audio graph, queue, gapless preload, mediaSession
  store/                     player.ts, ui.ts, library.ts (Zustand)
  fonts/                     Inter variable (OFL) for win/linux
.github/workflows/release.yml  matrix build: macos (dmg universal), windows (nsis+portable), ubuntu (AppImage/deb/rpm)
```

## Design fidelity: translating Compose to CSS
Source of truth for each element (read these while implementing):
| Element | Android source | Desktop implementation |
|---|---|---|
| Colours, type scale | `ui/theme/Theme.kt` | `tokens.css`: dark bg `#000`, surface `#0D0D0F`, surfaceVariant `#1C1C1E`, onSurfaceVariant `#8E8E93`, outline `#2C2C2E`; light equivalents; accent red `#FA2D48`. Type: 34/800/-0.8, 30/800/-0.7, 22/700/-0.4, 20/700/-0.3, 16/600/-0.2, 16/400, 14/400, 12/600, 11/600. `font-family: -apple-system, "SF Pro Display", "Inter", sans-serif` |
| Gutters and sizes | `ui/components/Common.kt` | PAGE_GUTTER 10px, row art 52px r8 with 1px hairline border, shelf card 150px, hero card ≤320px, floating bar ≤440px, library grid min 140px / gap 12 |
| Frosted glass | `OptimizedHaze.kt`, `FrostedTopBar.kt`, `LiquidGlass.kt` | `GlassSurface`: `backdrop-filter: blur(24px) saturate(180%)` + tinted translucent fill + inner highlight stroke; top bar gets a progressive fade mask (`TopFadeBlur.kt`) |
| Floating tab bar + mini player | `floatingtabbar/FloatingTabBar.kt`, `GlassNavBar.kt`, `MiniPlayer.kt` | Centered pill (Home/Explore/Library) + separate circular Search button; sliding selection pill (spring); mini-player accessory above the bar (40px art, 32px glyphs in 40px slots); collapses to inline on scroll-down |
| Page tint | `ui/theme/ArtworkPalette.kt` | Same algorithm: quantise artwork → background/wash/elevated/accent/onBackground/variant/divider, theme-aware, 300ms crossfade, cached per URL |
| Detail pages | `ui/screens/DetailScreen.kt` | Sleeve 12px radius, header drop 44px, 320px blur merge band from artwork into tint, pill buttons r12 (Play / Shuffle) |
| Now Playing | `ui/player/NowPlayingScreen.kt`, `LandscapePlayer.kt`, `PlayerControls.kt`, `ArtworkMeshBackdrop.kt` | Full-window sheet sliding up. Desktop windows are wider than tall, so use BitChord's **landscape layout** (sleeve + lyrics/queue toggles on the left; credits/transport, lyrics or queue on the right), and the portrait layout under 560px wide. Artwork scales to 0.88 when paused (500ms cubic-bezier .215,.61,.355,1). Mesh backdrop ported to a WebGL shader using the same `meshOf` colour-grid sampling, refreshed every 3s |
| Lyrics | `ui/player/PlayerLyrics.kt`, `data/lyrics/*` (credit binimum/am-lyrics) | Word/line sync with blur-out of distant lines, scale/opacity on the active line, gradient word fill, click a line to seek |
| Icons | `ui/icons/BitChordIcons.kt` | Port the ImageVector paths to SVG React components |
| Motion | Compose springs | Framer Motion springs (stiffness/damping taken from source) + "Reduce animation" setting |

Desktop-only additions (the same visual language, nothing new-looking): hover states, right-click context menus styled like `SongActionsSheet`, keyboard shortcuts (Space, ←/→ seek, ⌘/Ctrl+F search, ⌘/Ctrl+L lyrics), and a resizable window with a 900×600 minimum.
Window chrome: macOS uses `titleBarStyle: 'hiddenInset'` + `vibrancy: 'under-window'` (native traffic lights). Windows uses a frameless window with `titleBarOverlay` (native min/max/close) + `backgroundMaterial: 'mica'`. Linux uses a frameless window with `titleBarOverlay`. The in-app UI stays identical; only the OS window buttons differ.

## Status (v0.1.0)
Done: phases 1–6 (scaffold, design system, data layer, playback, screens, Now Playing + lyrics), plus 7 (Google sign-in) and 8 (packaging + CI release pipeline).
Verified: typecheck, 23 unit tests, packaged macOS app streams full tracks (PO-token path) and loads Home, and Linux AppImage and Windows portable cross-build.
Stream findings (Sept 2026): WEB/TV clients are SABR-only; IOS/MWEB/YTMUSIC return plain URLs but 403 after ~1 MB without a PO token. YTMUSIC + a video-id-bound PO token on both the player request and `pot=` serves the whole file.

## Implementation phases (MVP = 1–6)
1. **Scaffold.** electron-vite React-TS app; secure window (contextIsolation, sandbox, CSP); per-OS chrome; icons generated from `BitChord/Logo.png`; Inter bundled; `tokens.css`; `PLAN.md` copied into the project.
2. **Design system.** GlassSurface, Icons, SongRow, ShelfCard, HeroCard, Shelf, SectionHeader, Skeletons (`Skeletons.kt`), FrostedTopBar, FloatingTabBar + MiniPlayer, PillTextField, Sheet/Dialog, ContextMenu, dark/light/system theme.
3. **Data layer.** youtubei.js client in main process, parsers → shared models, typed IPC, TanStack Query caching. Features: home feed (with continuation), explore (new releases/charts/moods), search (suggestions + filtered results + paging), album/playlist/artist browse, `next` (up-next/radio).
4. **Playback.** `aurora://stream` Range proxy; audio engine (queue, next/prev, shuffle/repeat, seek, volume, gapless preload of the next track, autoplay from `next` radio like `Autoplay.kt`); mediaSession metadata + media keys; last-played queue persisted and restored.
5. **Screens.** Home, Explore, Library (signed-in: playlists/albums/artists/liked; signed-out: local recents), Search, Detail (album/playlist/artist) with ArtworkPalette tinting, Settings (theme, reduce animation, audio quality, lyrics sources, account, about).
6. **Now Playing and lyrics.** Mesh backdrop, landscape and portrait layouts, scrubber with elapsed/remaining, quality label, volume, queue view (drag-to-reorder, remove), lyrics (LrcLib → YouTube → BetterLyrics TTML word-sync) with the Apple-style animation.
7. **Account.** Google sign-in window → cookies + SAPISIDHASH through youtubei.js; library, like/unlike, add to playlist; encrypted with `safeStorage`.
8. **Packaging and CI.** electron-builder: mac dmg (universal, hardened runtime; notarisation optional via env), win nsis + portable, linux AppImage/deb/rpm; GitHub Actions release matrix; auto-update via electron-updater (GitHub releases).

Later phases (not in this build): downloads with tagging, Discord RPC (`@xhayper/discord-rpc`, local IPC), Last.fm/ListenBrainz scrobbling, crossfade/EQ (Web Audio), Listen Together (reuses `BitChord/backend` Go server protocol), local music folders, animated canvas artwork, Replay stats, and translations (reuse `res/values-*/strings.xml`).

## Verification
- `npm run dev` launches the app; I check each screen against the Android source constants (above) in dark and light themes, and at 900px, 1280px and 1920px widths, driving the app via the `run` skill with screenshots.
- Functional: search "Daft Punk" → open artist → album → play; seek, next/prev, queue reorder; lyrics sync and click-to-seek; media keys; restart restores queue; sign in → Library shows playlists.
- `npm run typecheck && npm run lint && npm test` (vitest unit tests for parsers, palette, lyric parsing/sync, queue logic; ports of `LrcLibTest`, `WordSyncTest`, `QueueBuilderTest` cases).
- `npm run build:mac` produces a working `.dmg` locally. Windows and Linux artefacts are built by the CI matrix, because they can't be cross-built fully on this Mac.
