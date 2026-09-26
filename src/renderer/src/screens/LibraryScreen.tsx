import { useQuery } from '@tanstack/react-query'
import type { ShelfItem } from '@shared/models'
import { MessageState, SectionHeader, ShelfCard } from '../components/Common'
import { FeedSkeleton } from '../components/Skeletons'
import { PageScroll } from '../components/PageScroll'
import { useUi } from '../store/ui'
import { signIn } from '../lib/account'

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
