// Order matters: globals before anything that touches Buffer, and
// window.aurora before the renderer, whose modules read it as they load.
import './globals'
import { bridge, warmUp } from './bridge'

window.aurora = bridge
document.documentElement.classList.add(`is-${window.aurora.platform}`)
// iOS draws the WebView under the status bar and home indicator; with
// viewport-fit=cover it reports their sizes, which the layout pads for.
// (Android keeps its WebView clear of the bars instead; see index.html.)
if (window.aurora.platform === 'ios') {
  const viewport = document.querySelector('meta[name=viewport]')
  viewport?.setAttribute('content', `${viewport.getAttribute('content')}, viewport-fit=cover`)
}

await import('../renderer/src/main')
// Android's media notification is a native service; iOS gets lock-screen
// controls from WebKit's Media Session support, which the engine feeds.
if (window.aurora.platform === 'android') await import('./playback')
await import('./navigation')
warmUp()
if (import.meta.env.VITE_AURORA_SELFTEST === '1') await import('./selftest')
