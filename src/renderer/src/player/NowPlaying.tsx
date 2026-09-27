import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { artworkAt, PLAYER_ART_PX } from '@shared/models'
import { usePlayer } from '../store/player'
import { useUi } from '../store/ui'
import { useSettings } from '../store/settings'
import { MeshBackdrop } from './MeshBackdrop'
import { PlayerActionRow, Scrubber, Transport, VolumeRow } from './Controls'
import { Lyrics } from './Lyrics'
import { QueuePane } from './QueuePane'
import { ChevronDownIcon, MusicNoteIcon } from '../components/Icons'
import { ExplicitBadge } from '../components/Common'
import { MotionCover } from '../components/MotionCover'
import { IS_MOBILE } from '../lib/platform'

/** `LANDSCAPE_PLAYER_MIN_WIDTH`: narrower than this, the player takes its portrait shape. */
const LANDSCAPE_MIN_WIDTH = 560
const ARTWORK_PAUSE_SHRINK_SCALE = 0.88

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return size
}

/**
 * `NowPlayingScreen.kt`. A window wider than it is tall gets BitChord's
 * landscape player (`LandscapePlayer.kt`): the sleeve on the left with the
 * lyrics/queue/like row under it, and on the right one of credits + transport,
 * the lyrics, or the queue. Narrow windows get the portrait player.
 */
export function NowPlaying() {
  const open = usePlayer((s) => s.nowPlayingOpen)
  const song = usePlayer((s) => s.current())
  const reduce = useSettings((s) => s.reduceAnimation)
  const transition = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 320, damping: 36, mass: 1 }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useUi.getState().menu) usePlayer.getState().closeNowPlaying()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <AnimatePresence>
      {open && song && (
        <motion.div
          className="now-playing"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={transition}
        >
          <PlayerBody />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PlayerBody() {
  const song = usePlayer((s) => s.current())!
  const isPlaying = usePlayer((s) => s.isPlaying)
  const pane = usePlayer((s) => s.pane)
  const source = usePlayer((s) => s.source)
  const { w, h } = useWindowSize()
  const landscape = w > h && w >= LANDSCAPE_MIN_WIDTH
  const [artLoaded, setArtLoaded] = useState(false)
  const art = artworkAt(song.thumbnailUrl, PLAYER_ART_PX)
  useEffect(() => setArtLoaded(false), [art])

  const sleeve = (
    <motion.div
      className="player-sleeve"
      animate={{ scale: isPlaying ? 1 : ARTWORK_PAUSE_SHRINK_SCALE }}
      transition={{ duration: 0.5, ease: [0.215, 0.61, 0.355, 1] }}
    >
      {!artLoaded && <MusicNoteIcon className="player-sleeve-placeholder" />}
      {art && <img src={art} alt="" onLoad={() => setArtLoaded(true)} style={{ opacity: artLoaded ? 1 : 0 }} />}
      <MotionCover lookup={{ kind: 'song', title: song.title, artist: song.artist, album: song.albumName }} playing={isPlaying} />
    </motion.div>
  )

  const credits = (
    <div className="player-credits">
      {source && <div className="player-source ellipsis">Playing from {source}</div>}
      <div className="player-title">
        <span className="ellipsis">{song.title}</span>
        {song.explicit && <ExplicitBadge />}
      </div>
      <button
        className="player-artist ellipsis"
        disabled={!song.artistId}
        onClick={() => {
          if (!song.artistId) return
          usePlayer.getState().closeNowPlaying()
          useUi.getState().push({ kind: 'detail', browseId: song.artistId, title: song.artist })
        }}
      >
        {song.artist}
      </button>
    </div>
  )

  const main = (
    <div className="player-main">
      {credits}
      <Scrubber />
      <Transport compact={h < 640} />
      {!IS_MOBILE && <VolumeRow />}
    </div>
  )

  const side = pane === 'lyrics' ? <Lyrics song={song} /> : pane === 'queue' ? <QueuePane /> : main

  return (
    <>
      <MeshBackdrop url={song.thumbnailUrl} playing={isPlaying} />
      <div className={`player-chrome platform-${window.aurora.platform}`}>
        <button className="player-close" aria-label="Close player" onClick={() => usePlayer.getState().closeNowPlaying()}>
          <ChevronDownIcon size={26} />
        </button>
        <div className="player-handle" onClick={() => usePlayer.getState().closeNowPlaying()} />
      </div>
      {landscape ? (
        <div className="player-landscape">
          <div className="player-left">
            <div className="player-sleeve-box">{sleeve}</div>
            <PlayerActionRow />
          </div>
          <div className="player-right">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pane}
                className="player-pane"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.22, delay: 0.09 } }}
                exit={{ opacity: 0, transition: { duration: 0.14 } }}
              >
                {side}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="player-portrait">
          {pane === 'main' ? <div className="player-sleeve-box">{sleeve}</div> : <div className="player-pane">{side}</div>}
          {pane === 'main' && main}
          <PlayerActionRow />
        </div>
      )}
    </>
  )
}
