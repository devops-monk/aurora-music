import { useQuery } from '@tanstack/react-query'
import type { ShelfItem } from '@shared/models'
import { MessageState, SectionHeader, ShelfCard } from '../components/Common'
import { FeedSkeleton } from '../components/Skeletons'
import { PageScroll } from '../components/PageScroll'
import { useUi } from '../store/ui'
import { signIn } from '../lib/account'
import { DownloadIcon, FolderIcon } from '../components/Icons'
import { useDownloads } from '../store/downloads'
import { ChevronRightIcon } from '../components/Icons'
import { monthLabel } from './ReplayScreen'
import { IS_MOBILE } from '../lib/platform'

/** `ReplayBanner` from LibraryScreen.kt: this month's minutes, opening Replay. */
function ReplayBanner() {
  const q = useQuery({ queryKey: ['replay', 'banner'], queryFn: () => window.aurora.replay(), staleTime: 60_000 })
  const data = q.data
  return (
    <button className="replay-banner" onClick={() => useUi.getState().push({ kind: 'replay' })}>
      <div className="replay-banner-mark">R</div>
      <div className="replay-banner-text">
        <b>Your Replay</b>
        <span>
          {data && data.plays > 0
            ? `${data.minutes.toLocaleString()} minutes in ${monthLabel(data.month, false)} · top song: ${data.topSongs[0]?.title ?? ''}`
            : 'Your month in music, counted as you listen'}
        </span>
      </div>
      <ChevronRightIcon size={20} />
    </button>
  )
}

/** `ServiceCard` from HomeScreen.kt: a gradient tile for an on-device collection. */
function ServiceCard({ title, subtitle, colors, icon, onClick }: { title: string; subtitle: string; colors: [string, string]; icon: React.ReactNode; onClick: () => void }) {
  return (
    <div className="shelf-card service-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="service-card-art" style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}>
        {icon}
      </div>
      <div className="shelf-card-title ellipsis">{title}</div>
      <div className="shelf-card-subtitle ellipsis">{subtitle}</div>
    </div>
  )
}

function OnThisComputer() {
  const done = useDownloads((s) => s.list.filter((e) => e.state === 'done').length)
  return (
    <section className="shelf">
      <SectionHeader title="On This Computer" />
      <div className="library-grid">
        <ServiceCard
          title="Downloads"
          subtitle={`${done} song${done === 1 ? '' : 's'}`}
          colors={['#1E3C72', '#2A5298']}
          icon={<DownloadIcon size={40} />}
          onClick={() => useUi.getState().push({ kind: 'downloads' })}
        />
        <ServiceCard
          title="Local Music"
          subtitle="Audio files on this computer"
          colors={['#134E5E', '#71B280']}
          icon={<FolderIcon size={40} />}
          onClick={() => useUi.getState().push({ kind: 'local' })}
        />
      </div>
    </section>
  )
}

const LIKED: ShelfItem = {
  title: 'Liked Music',
  subtitle: 'Auto playlist',
  thumbnailUrl: 'https://www.gstatic.com/youtube/media/ytm/images/pbg/liked-music-@576.png',
  browseId: 'VLLM',
  type: 'playlist',
}

function Grid({ title, items }: { title: string; items: ShelfItem[] }) {
  if (!items.length) return null
  return (
    <section className="shelf">
      <SectionHeader title={title} />
      <div className="library-grid">
        {items.map((item, i) => (
          <ShelfCard key={(item.browseId ?? '') + i} item={item} />
        ))}
      </div>
    </section>
  )
}

/** `LibraryScreen.kt`: the signed-in library as grids of playlists, albums and artists. */
export function LibraryScreen() {
  const account = useUi((s) => s.account)
  const accountLoaded = useUi((s) => s.accountLoaded)
  const q = useQuery({
    queryKey: ['library', account?.name],
    queryFn: () => window.aurora.library(),
    enabled: !!account,
  })
  return (
    <PageScroll id="library">
      <h1 className="page-title">Library</h1>
      <ReplayBanner />
      {!IS_MOBILE && <OnThisComputer />}
      {!accountLoaded ? null : !account ? (
        <MessageState
          message="Sign in to see your playlists, albums and artists from YouTube Music."
          action="Sign in"
          onAction={signIn}
        />
      ) : q.isPending ? (
        <FeedSkeleton />
      ) : q.isError ? (
        <MessageState message="Couldn't load your library." action="Retry" onAction={() => q.refetch()} />
      ) : (
        <>
          <Grid title="Playlists" items={[LIKED, ...q.data.playlists.filter((p) => p.browseId !== 'VLLM')]} />
          <Grid title="Albums" items={q.data.albums} />
          <Grid title="Artists" items={q.data.artists} />
        </>
      )}
    </PageScroll>
  )
}
