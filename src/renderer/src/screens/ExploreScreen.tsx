import { useQuery } from '@tanstack/react-query'
import type { MoodGenre, MoodSection } from '@shared/models'
import { MessageState, SectionHeader, Shelf } from '../components/Common'
import { FeedSkeleton } from '../components/Skeletons'
import { PageScroll } from '../components/PageScroll'
import { useUi } from '../store/ui'

/** `moodColor` from ExploreScreen.kt, down to Java's `String.hashCode`, so a mood keeps its colour across apps. */
const MOOD_COLORS = ['#E64A19', '#EC0B65', '#8664AC', '#6B4EFF', '#BE6100', '#233C78', '#4D97E5', '#AA267E']

function javaHashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

export function moodColor(title: string): string {
  return MOOD_COLORS[(javaHashCode(title) & 0x7fffffff) % 8]
}

function darker(hex: string, f = 0.68) {
  const n = parseInt(hex.slice(1), 16)
  const c = (shift: number) => Math.round(((n >> shift) & 0xff) * f)
  return `rgb(${c(16)}, ${c(8)}, ${c(0)})`
}

function MoodCard({ mood }: { mood: MoodGenre }) {
  const color = moodColor(mood.title)
  return (
    <button
      className="mood-card"
      style={{ background: `linear-gradient(135deg, ${color}, ${darker(color)})` }}
      onClick={() => useUi.getState().push({ kind: 'mood', browseId: mood.browseId, params: mood.params, title: mood.title })}
    >
      <span className="mood-card-title">{mood.title}</span>
      <span className="mood-card-sleeve" />
    </button>
  )
}

function MoodGrid({ section }: { section: MoodSection }) {
  return (
    <section className="shelf">
      <SectionHeader title={section.title} />
      <div className="mood-grid">
        {section.items.map((m) => (
          <MoodCard key={m.browseId + (m.params ?? '')} mood={m} />
        ))}
      </div>
    </section>
  )
}

/** `ExploreScreen.kt`: the new-release and chart shelves, then the mood and genre grids. */
export function ExploreScreen() {
  const q = useQuery({ queryKey: ['explore'], queryFn: () => window.aurora.explore(), staleTime: 30 * 60_000 })
  return (
    <PageScroll id="explore">
      <h1 className="page-title">Explore</h1>
      {q.isPending ? (
        <FeedSkeleton />
      ) : q.isError ? (
        <MessageState message="Couldn't load Explore." action="Retry" onAction={() => q.refetch()} />
      ) : (
        <>
          {q.data.shelves.map((shelf, i) => (
            <Shelf key={shelf.title + i} shelf={shelf} />
          ))}
          {q.data.moodSections.map((section) => (
            <MoodGrid key={section.title} section={section} />
          ))}
        </>
      )}
    </PageScroll>
  )
}

/** A mood or genre page: its shelves of playlists. */
export function MoodScreen({ browseId, params, title }: { browseId: string; params?: string | null; title: string }) {
  const q = useQuery({ queryKey: ['mood', browseId, params], queryFn: () => window.aurora.moodPage(browseId, params) })
  return (
    <PageScroll id={`mood:${browseId}:${params}`}>
      <h1 className="page-title">{title}</h1>
      {q.isPending ? (
        <FeedSkeleton />
      ) : q.isError ? (
        <MessageState message="Couldn't load this page." action="Retry" onAction={() => q.refetch()} />
      ) : (
        q.data.map((shelf, i) => <Shelf key={shelf.title + i} shelf={shelf} />)
      )}
    </PageScroll>
  )
}
