import { useInfiniteQuery } from '@tanstack/react-query'
import type { HomeShelf } from '@shared/models'
import { MessageState, Shelf } from '../components/Common'
import { FeedSkeleton, ShelfSkeleton } from '../components/Skeletons'
import { PageScroll } from '../components/PageScroll'
import { useUi } from '../store/ui'
import { signIn } from '../lib/account'
import { MusicNoteIcon } from '../components/Icons'

/** `HomeScreen.kt`: the large title, a sign-in banner when signed out, the hero shelf, then the feed. */
export function HomeScreen() {
  const account = useUi((s) => s.account)
  const accountLoaded = useUi((s) => s.accountLoaded)
  const feed = useInfiniteQuery({
    queryKey: ['home', account?.name ?? null],
    queryFn: async ({ pageParam }): Promise<HomeShelf[]> =>
      pageParam === 0 ? (await window.aurora.home()).shelves : window.aurora.homeMore(),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length ? pages.length : undefined),
    enabled: accountLoaded,
    staleTime: 10 * 60_000,
  })
  const shelves = feed.data?.pages.flat() ?? []

  return (
    <PageScroll
      id="home"
      onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
    >
      <h1 className="page-title">Home</h1>
      {accountLoaded && !account && <SignInBanner />}
      {feed.isPending ? (
        <FeedSkeleton />
      ) : feed.isError && !shelves.length ? (
        <MessageState message="Couldn't load your home feed." action="Retry" onAction={() => feed.refetch()} />
      ) : (
        shelves.map((shelf, i) => <Shelf key={shelf.title + i} shelf={shelf} hero={i === 0 && shelf.layout === 'cards'} />)
      )}
      {feed.isFetchingNextPage && <ShelfSkeleton />}
    </PageScroll>
  )
}

/** `SignInBanner` from Common.kt. */
export function SignInBanner() {
  return (
    <div className="sign-in-banner" onClick={signIn} role="button" tabIndex={0}>
      <div className="sign-in-banner-icon">
        <MusicNoteIcon size={22} />
      </div>
      <div className="sign-in-banner-text">
        <div className="sign-in-banner-title">Sign in to YouTube Music</div>
        <div className="sign-in-banner-subtitle">Your library, likes and personalised mixes</div>
      </div>
      <span className="pill-button is-small">Sign in</span>
    </div>
  )
}
