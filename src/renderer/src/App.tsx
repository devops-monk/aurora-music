import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query'
import { loadAccount } from './lib/account'
import { currentPage, useUi, type Page, type Tab } from './store/ui'
import { usePlayer } from './store/player'
import { useSettings } from './store/settings'
import { useApplyTheme } from './theme/useTheme'
import { getPositionMs, next, previous, restoreQueue, seekTo, togglePlay } from './audio/engine'
import { BottomBar, ContextMenu, Toast, TopBar } from './components/Chrome'
import { HomeScreen } from './screens/HomeScreen'
import { ExploreScreen, MoodScreen } from './screens/ExploreScreen'
import { LibraryScreen } from './screens/LibraryScreen'
import { SearchScreen } from './screens/SearchScreen'
import { DetailScreen } from './screens/DetailScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { EqualizerScreen } from './screens/EqualizerScreen'
import { DownloadsScreen, LocalMusicScreen } from './screens/OfflineScreens'
import { startDownloadsSync } from './store/downloads'
import { NowPlaying } from './player/NowPlaying'

function Root({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'home':
      return <HomeScreen />
    case 'explore':
      return <ExploreScreen />
    case 'library':
      return <LibraryScreen />
    case 'search':
      return <SearchScreen />
  }
}

function PageView({ page }: { page: Page }) {
  switch (page.kind) {
    case 'detail':
    case 'songs':
      return <DetailScreen browseId={page.browseId} />
    case 'mood':
      return <MoodScreen browseId={page.browseId} params={page.params} title={page.title} />
    case 'settings':
      return <SettingsScreen />
    case 'equalizer':
      return <EqualizerScreen />
    case 'downloads':
      return <DownloadsScreen />
    case 'local':
      return <LocalMusicScreen />
  }
}

const TAB_TITLES: Record<Tab, string> = { home: 'Home', explore: 'Explore', library: 'Library', search: 'Search' }

function pageTitle(tab: Tab, page: Page | null) {
  if (!page) return TAB_TITLES[tab]
  if (page.kind === 'settings') return 'Settings'
  if (page.kind === 'equalizer') return 'Equalizer'
  if (page.kind === 'downloads') return 'Downloads'
  if (page.kind === 'local') return 'Local Music'
  return page.title ?? ''
}

/** Desktop keyboard: space to play/pause, arrows to seek, ⌘/Ctrl+F to search, ⌘/Ctrl+L for lyrics. */
function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        usePlayer.getState().closeNowPlaying()
        useUi.getState().setTab('search')
        setTimeout(() => window.dispatchEvent(new Event('aurora:focus-search')), 0)
        return
      }
      if (mod && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        const p = usePlayer.getState()
        if (!p.nowPlayingOpen) p.openNowPlaying('lyrics')
        else p.setPane('lyrics')
        return
      }
      if (typing) return
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'ArrowRight' && !mod) {
        seekTo(getPositionMs() + 5000)
      } else if (e.key === 'ArrowLeft' && !mod) {
        seekTo(getPositionMs() - 5000)
      } else if ((e.key === 'Backspace' || (e.key === '[' && mod)) && !usePlayer.getState().nowPlayingOpen) {
        useUi.getState().pop()
      }
    }
    window.addEventListener('keydown', onKey)
    const offKey = window.aurora.onMediaKey((key) => (key === 'play-pause' ? togglePlay() : key === 'next' ? next() : previous()))
    const offFs = window.aurora.onFullscreen((fullscreen) => useUi.setState({ fullscreen }))
    // Mouse back button.
    const onMouse = (e: MouseEvent) => e.button === 3 && useUi.getState().pop()
    window.addEventListener('mouseup', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onMouse)
      offKey()
      offFs()
    }
  }, [])
}

export function App() {
  useApplyTheme()
  useKeyboard()
  const tab = useUi((s) => s.tab)
  const page = useUi(currentPage)
  const depth = useUi((s) => s.stacks[s.tab].length)
  const reduce = useSettings((s) => s.reduceAnimation)

  useEffect(() => {
    useSettings.getState().load().then(() => usePlayer.getState().setVolume(useSettings.getState().volume))
    loadAccount()
    restoreQueue()
    return startDownloadsSync()
  }, [])

  // Persist the volume, but not on every pixel of a drag.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    return usePlayer.subscribe((s, prev) => {
      if (s.volume === prev.volume) return
      clearTimeout(t)
      t = setTimeout(() => useSettings.getState().update({ volume: s.volume }), 400)
    })
  }, [])

  const key = `${tab}:${depth}:${page ? JSON.stringify(page) : ''}`
  const overArtwork = page?.kind === 'detail'

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <TopBar title={pageTitle(tab, page)} overArtwork={overArtwork} />
        <main className="content">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={key}
              className="page"
              initial={reduce ? false : { opacity: 0, x: page ? 24 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            >
              {page ? <PageView page={page} /> : <Root tab={tab} />}
            </motion.div>
          </AnimatePresence>
        </main>
        <BottomBar />
        <NowPlaying />
        <ContextMenu />
        <Toast />
      </div>
    </QueryClientProvider>
  )
}
