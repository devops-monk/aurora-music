// Order matters: globals before anything that touches Buffer, and
// window.aurora before the renderer, whose modules read it as they load.
import './globals'
import { bridge, warmUp } from './bridge'

window.aurora = bridge
document.documentElement.classList.add('is-android')

await import('../renderer/src/main')
await import('./playback')
warmUp()
