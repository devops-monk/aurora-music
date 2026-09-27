import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Hls from 'hls.js'
import type { MotionArtwork } from '@shared/api'
import { useSettings } from '../store/settings'
import { IS_ANDROID } from '../lib/platform'

/**
 * Apple Music motion artwork (BitChord's canvas), laid over a sleeve that is
 * already showing the still cover. The video stays invisible until frames are
 * decoded, so a slow or failed clip simply leaves the still in place.
 * Muted and looping; it follows `playing` so a paused song's cover sits still.
 */
export function MotionCover({ lookup, playing = true }: { lookup: MotionLookup | null; playing?: boolean }) {
  const enabled = useSettings((s) => s.animatedCovers && !s.reduceAnimation)
  const key = lookup && (lookup.kind === 'song' ? [lookup.title, lookup.artist, lookup.album] : [lookup.album, lookup.artist])
  const q = useQuery({
    queryKey: ['motion', lookup?.kind, ...(key ?? [])],
    queryFn: (): Promise<MotionArtwork | null> =>
      lookup!.kind === 'song'
        ? window.aurora.motionForSong(lookup!.title, lookup!.artist, lookup!.album ?? null)
        : window.aurora.motionForAlbum(lookup!.album, lookup!.artist),
    enabled: enabled && !!lookup,
    staleTime: Infinity,
  })
  const art = enabled ? q.data : null
  return art ? <MotionVideo key={art.url} art={art} playing={playing} /> : null
}

export type MotionLookup =
  | { kind: 'song'; title: string; artist: string; album?: string | null }
  | { kind: 'album'; album: string; artist: string }

function MotionVideo({ art, playing }: { art: MotionArtwork; playing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const video = ref.current!
    const urls = [art.url, art.fallbackUrl].filter((u): u is string => !!u)
    let hls: Hls | null = null
    let dead = false
    const load = (i: number) => {
      hls?.destroy()
      hls = null
      if (dead || i >= urls.length) return
      // Android's WebView plays HLS itself, and hls.js can't fetch video
      // segments through its native-HTTP fetch; the desktop's Chromium claims
      // native HLS but rejects these URLs, so it uses hls.js.
      const native = video.canPlayType('application/vnd.apple.mpegurl')
      if (IS_ANDROID && native) {
        video.onerror = () => load(i + 1)
        video.src = urls[i]
      } else if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: false, capLevelToPlayerSize: true, maxBufferLength: 10 })
        hls.on(Hls.Events.ERROR, (_e, data) => data.fatal && load(i + 1))
        hls.loadSource(urls[i])
        hls.attachMedia(video)
      } else if (native) {
        video.onerror = () => load(i + 1)
        video.src = urls[i]
      }
    }
    load(0)
    return () => {
      dead = true
      hls?.destroy()
      video.removeAttribute('src')
    }
  }, [art])

  useEffect(() => {
    const video = ref.current!
    if (playing) video.play().catch(() => {})
    else video.pause()
  }, [playing, shown])

  return (
    <video
      ref={ref}
      className="motion-cover"
      muted
      loop
      playsInline
      autoPlay={playing}
      onLoadedData={(e) => e.currentTarget.videoWidth > 0 && setShown(true)}
      // A clip that can't be decoded (no hardware decoder, say) leaves the still cover showing.
      onError={() => setShown(false)}
      style={{ opacity: shown ? 1 : 0 }}
    />
  )
}
