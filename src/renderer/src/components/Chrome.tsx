import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ROW_ART_PX } from '@shared/models'
import { currentPage, useUi, type Tab } from '../store/ui'
import { usePlayer } from '../store/player'
import { useSettings } from '../store/settings'
import { next, togglePlay } from '../audio/engine'
import { Artwork, ExplicitBadge, Spinner } from './Common'
import {
  ChevronLeftIcon,
  ExploreIcon,
  GearIcon,
  HomeIcon,
  LibraryIcon,
  MiniNext,
  MiniPause,
  MiniPlay,
  PersonIcon,
  SearchIcon,
} from './Icons'
import { AppMark } from './AppMark'

const spring = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.9 }

/**
 * `FrostedTopBar.kt`: 52px, app mark or back button on the leading end, the
 * account avatar on the trailing end. Clear over the page until it scrolls,
 * then frosted glass with a hairline. It doubles as the window's drag region,
 * and keeps clear of the OS window buttons on either side.
 */
export function TopBar({ title, overArtwork }: { title?: string; overArtwork?: boolean }) {
  const scrolled = useUi((s) => s.scrolled)
  const hasBack = useUi((s) => s.stacks[s.tab].length > 0)
  const account = useUi((s) => s.account)
  const page = useUi(currentPage)
  const fullscreen = useUi((s) => s.fullscreen)
  const frosted = scrolled && !overArtwork
  return (
    <header
      className={`top-bar platform-${window.aurora.platform} ${frosted ? 'is-frosted' : ''} ${fullscreen ? 'is-fullscreen' : ''}`}
    >
      <div className="top-bar-leading">
        {hasBack ? (
          <button className="glass-circle no-drag" aria-label="Back" onClick={() => useUi.getState().pop()}>
            <ChevronLeftIcon size={22} />
          </button>
        ) : (
          <div className="glass-capsule app-mark-capsule">
            <AppMark size={22} />
            <span className="app-mark-word">Aurora</span>
          </div>
        )}
      </div>
      <div className="top-bar-title" style={{ opacity: frosted && title ? 1 : 0 }}>
        {title}
      </div>
      <div className="top-bar-trailing">
        {page?.kind !== 'settings' && (
          <button
            className="glass-circle no-drag"
            aria-label="Settings"
            onClick={() => useUi.getState().push({ kind: 'settings' })}
          >
            <GearIcon size={20} />
          </button>
        )}
        <button
          className="avatar-button no-drag"
          aria-label={account ? account.name : 'Sign in'}
          title={account ? account.name : 'Sign in'}
          onClick={() => useUi.getState().push({ kind: 'settings' })}
        >
          {account?.thumbnailUrl ? <img src={account.thumbnailUrl} alt="" /> : <PersonIcon size={18} />}
        </button>
      </div>
    </header>
  )
}

const TABS: { key: Exclude<Tab, 'search'>; label: string; Icon: typeof HomeIcon }[] = [
  { key: 'home', label: 'Home', Icon: HomeIcon },
  { key: 'explore', label: 'Explore', Icon: ExploreIcon },
  { key: 'library', label: 'Library', Icon: LibraryIcon },
]

/**
 * `GlassNavBar.kt` + the vendored `FloatingTabBar`: a glass pill of tabs and a
 * separate round Search button, with the mini player riding above as the
 * "expanded accessory". Scrolling down collapses it inline (iOS 26): the pill
 * shrinks to the selected tab, and the mini player slides in between.
 */
export function BottomBar() {
  const tab = useUi((s) => s.tab)
  const scrolled = useUi((s) => s.scrolled)
  const hasSong = usePlayer((s) => s.songs.length > 0)
  const inline = scrolled && hasSong
  const pillRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const pill = pillRef.current
    const el = pill?.querySelector<HTMLElement>(`[data-tab="${tab}"]`)
    if (!pill || !el || inline) return setIndicator(null)
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [tab, inline])

  return (
    <div className="bottom-bar">
      <LayoutGroup>
        <AnimatePresence initial={false}>
          {hasSong && !inline && (
            <motion.div
              key="expanded-accessory"
              className="accessory-row"
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={spring}
            >
              <MiniPlayer inline={false} />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div className="tab-row" layout transition={spring}>
          <motion.div className="glass-pill tab-pill" ref={pillRef} layout transition={spring}>
            {indicator && tab !== 'search' && (
              <motion.div
                className="tab-indicator"
                initial={false}
                animate={{ left: indicator.left, width: indicator.width }}
                transition={spring}
              />
            )}
            {TABS.filter((t) => !inline || t.key === tab || (tab === 'search' && t.key === 'home')).map(({ key, label, Icon }) => (
              <motion.button
                layout="position"
                key={key}
                data-tab={key}
                className={`tab ${tab === key ? 'is-selected' : ''} ${inline ? 'is-inline' : ''}`}
                onClick={() => useUi.getState().setTab(key)}
                aria-label={label}
                transition={spring}
              >
                <Icon size={25} />
                {!inline && <span className="tab-label">{label}</span>}
              </motion.button>
            ))}
          </motion.div>
          <AnimatePresence initial={false}>
            {inline && (
              <motion.div
                key="inline-accessory"
                className="inline-accessory"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={spring}
              >
                <MiniPlayer inline />
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            layout
            transition={spring}
            className={`glass-circle search-tab ${tab === 'search' ? 'is-selected' : ''}`}
            aria-label="Search"
            onClick={() => useUi.getState().setTab('search')}
          >
            <SearchIcon size={25} />
          </motion.button>
        </motion.div>
      </LayoutGroup>
    </div>
  )
}

/** `MiniPlayer.kt` / `GlassNowPlaying`: 40px art (32 inline), title, artist, play and skip. */
function MiniPlayer({ inline }: { inline: boolean }) {
  const song = usePlayer((s) => s.current())
  const isPlaying = usePlayer((s) => s.isPlaying)
  const isLoading = usePlayer((s) => s.isLoading)
  const progress = usePlayer((s) => (s.durationMs > 0 ? s.positionMs / s.durationMs : 0))
  if (!song) return null
  const glyph = inline ? 24 : 32
  return (
    <div
      className={`glass-pill mini-player ${inline ? 'is-inline' : ''}`}
      onClick={() => usePlayer.getState().openNowPlaying()}
      role="button"
      tabIndex={0}
    >
      <Artwork url={song.thumbnailUrl} px={ROW_ART_PX} radius={inline ? 6 : 8} className="mini-art" />
      <div className="mini-text">
        <div className="mini-title">
          <span className="ellipsis">{song.title}</span>
          {song.explicit && <ExplicitBadge />}
        </div>
        {!inline && <div className="mini-artist ellipsis">{song.artist}</div>}
      </div>
      <div className="mini-controls" onClick={(e) => e.stopPropagation()}>
        <button className="mini-glyph" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
          {isLoading ? <Spinner size={inline ? 18 : 22} /> : isPlaying ? <MiniPause size={glyph} /> : <MiniPlay size={glyph} />}
        </button>
        <button className="mini-glyph" aria-label="Next" onClick={next}>
          <MiniNext size={glyph} />
        </button>
      </div>
      <div className="mini-progress" style={{ transform: `scaleX(${progress})` }} />
    </div>
  )
}

/** A right-click menu styled as BitChord's glass action sheet. */
export function ContextMenu() {
  const menu = useUi((s) => s.menu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!menu || !ref.current) return setPos(null)
    const { width, height } = ref.current.getBoundingClientRect()
    setPos({
      left: Math.min(menu.x, window.innerWidth - width - 8),
      top: Math.min(menu.y, window.innerHeight - height - 8),
    })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const close = () => useUi.getState().closeMenu()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  return (
    <AnimatePresence>
      {menu && (
        <motion.div
          className="menu-scrim"
          onMouseDown={() => useUi.getState().closeMenu()}
          onContextMenu={(e) => {
            e.preventDefault()
            useUi.getState().closeMenu()
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          <motion.div
            ref={ref}
            className="context-menu glass-panel"
            style={{ left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? 'visible' : 'hidden' }}
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 700, damping: 40 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {menu.items.map((item) => (
              <button
                key={item.label}
                className={`menu-item ${item.destructive ? 'is-destructive' : ''}`}
                onClick={() => {
                  useUi.getState().closeMenu()
                  item.onSelect()
                }}
              >
                <span>{item.label}</span>
                {item.icon && <span className="menu-icon">{item.icon}</span>}
              </button>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Toast() {
  const toast = useUi((s) => s.toast)
  const reduce = useSettings((s) => s.reduceAnimation)
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          className="toast glass-pill"
          initial={{ opacity: 0, y: reduce ? 0 : -16, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: reduce ? 0 : -16, x: '-50%' }}
          transition={spring}
        >
          {toast.text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
