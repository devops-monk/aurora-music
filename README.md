# aurora-music

**Aurora Music**: an Apple Music-style YouTube Music client for **macOS, Windows and Linux**.

Built with Electron + React + TypeScript, so the interface renders identically on every OS: frosted-glass bars, an iOS-style floating tab bar with a mini player, artwork-tinted album and artist pages, an animated mesh-gradient Now Playing screen, and word-synced Apple Music-style lyrics.

## Features
- Home, Explore (new releases, charts, moods & genres), Search (typeahead, filters, top result), Library
- Album, playlist and artist pages painted in the artwork's own colours
- Gapless playback, radio autoplay, shuffle/repeat, drag-to-reorder queue, volume normalisation
- Word-synced lyrics (BetterLyrics TTML → LRCLIB → YouTube Music), click a line to seek
- Sign in with Google for your library and likes (session encrypted with the OS keychain)
- Media keys and OS now-playing integration (macOS Now Playing, Windows SMTC, Linux MPRIS)
- Dark / light / system theme, reduce-animation option
- Keyboard: `Space` play/pause · `←/→` seek 5s · `⌘/Ctrl+←/→` previous/next · `⌘/Ctrl+F` search · `⌘/Ctrl+L` lyrics · `Esc` close player

## Download
Installers for every OS are attached to each [GitHub Release](https://github.com/devops-monk/aurora-music/releases):
`.dmg`/`.zip` (macOS universal), `.exe` setup + portable (Windows), `.AppImage`/`.deb`/`.rpm` (Linux).

Builds are unsigned for now. On macOS, right-click the app and choose **Open** the first time.

## Develop
```sh
npm install
npm run dev          # hot-reloading app
npm test             # unit tests
npm run typecheck
npm run build:mac    # or build:win / build:linux → release/<version>/
```

## Releasing
Push a tag and the pipeline builds on macOS, Windows and Linux runners, then publishes one GitHub Release with every installer:
```sh
npm version patch && git push --follow-tags
```
Or run the **Build & Release** workflow manually with a version such as `v0.1.1`.

## Layout
```
src/main       Electron main: YouTube Music client (youtubei.js), PO tokens, stream protocol, lyrics, sign-in
src/preload    the typed window.aurora bridge
src/shared     models, IPC contract, lyric parsers
src/renderer   React UI: screens, player, components, design tokens
```
See `PLAN.md` for the design and architecture plan and `NOTICE.md` for credits.

## Disclaimer
Aurora Music is an independent client, not affiliated with YouTube or Google. It does not host any media. Use it in line with your local laws and YouTube's terms.
