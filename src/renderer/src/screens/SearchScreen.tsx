import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ROW_ART_PX, type SearchFilter, type SearchResults, type ShelfItem } from '@shared/models'
import { Artwork, MessageState, SectionHeader, SongRow } from '../components/Common'
import { RowsSkeleton } from '../components/Skeletons'
import { PageScroll } from '../components/PageScroll'
import { ClockIcon, CloseIcon, MoreIcon, PlayGlyph, SearchIcon } from '../components/Icons'
import { useUi } from '../store/ui'
import { usePlayer } from '../store/player'
import { openItem, openItemMenu } from '../lib/actions'

const FILTERS: { key: SearchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'songs', label: 'Songs' },
  { key: 'videos', label: 'Videos' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
  { key: 'playlists', label: 'Playlists' },
]

const RECENTS_KEY = 'aurora.recentSearches'
const MAX_RECENTS = 12

function loadRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]')
  } catch {
    return []
  }
}
function saveRecents(list: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)))
  } catch {
    /* a convenience only */
  }
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** `SearchScreen.kt`: a pill field, typeahead while typing, recent searches when empty, filtered results on submit. */
export function SearchScreen() {
  const input = useUi((s) => s.searchQuery)
  const [submitted, setSubmitted] = useState('')
  const [filter, setFilter] = useState<SearchFilter>('all')
  const [recents, setRecents] = useState(loadRecents)
  const [focused, setFocused] = useState(false)
  const fieldRef = useRef<HTMLInputElement>(null)
  const typed = useDebounced(input, 180)

  useEffect(() => {
    fieldRef.current?.focus()
    const onFocusSearch = () => fieldRef.current?.focus()
    window.addEventListener('aurora:focus-search', onFocusSearch)
    return () => window.removeEventListener('aurora:focus-search', onFocusSearch)
  }, [])

  const suggestions = useQuery({
    queryKey: ['suggest', typed],
    queryFn: () => window.aurora.suggestions(typed),
    enabled: typed.trim().length > 0 && typed !== submitted,
    staleTime: 60_000,
  })

  const results = useInfiniteQuery({
    queryKey: ['search', submitted, filter],
    queryFn: ({ pageParam }): Promise<SearchResults> =>
      pageParam === 0 ? window.aurora.search(submitted, filter) : window.aurora.searchMore(),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasContinuation && filter !== 'all' ? pages.length : undefined),
    enabled: submitted.trim().length > 0,
  })

  const submit = (q: string) => {
    const query = q.trim()
    if (!query) return
    useUi.getState().setSearchQuery(query)
    setSubmitted(query)
    fieldRef.current?.blur()
    const next = [query, ...recents.filter((r) => r.toLowerCase() !== query.toLowerCase())]
    setRecents(next)
    saveRecents(next)
  }

  const showSuggestions = focused && input.trim() && input !== submitted
  const pages = results.data?.pages ?? []
  const top = pages[0]?.top
  const songs = pages.flatMap((p) => p.songs)
  const items = pages.flatMap((p) => p.items)

  return (
    <PageScroll
      id="search"
      onEndReached={() => results.hasNextPage && !results.isFetchingNextPage && results.fetchNextPage()}
    >
      <h1 className="page-title">Search</h1>
      <form
        className="search-field-wrap"
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
      >
        <div className="pill-field">
          <SearchIcon size={18} />
          <input
            ref={fieldRef}
            value={input}
            placeholder="Artists, songs, albums…"
            onChange={(e) => useUi.getState().setSearchQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            spellCheck={false}
          />
          {input && (
            <button
              type="button"
              className="pill-field-clear"
              aria-label="Clear"
              onClick={() => {
                useUi.getState().setSearchQuery('')
                setSubmitted('')
                fieldRef.current?.focus()
              }}
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>
      </form>

      {showSuggestions ? (
        <div className="suggestions">
          <SuggestionRow text={`Search "${input.trim()}"`} onClick={() => submit(input)} icon={<SearchIcon size={18} />} />
          {suggestions.data?.map((s, i) =>
            s.item ? (
              <BrowseRow key={i} item={s.item} onClick={() => openItem(s.item!, 'Search')} />
            ) : (
              <SuggestionRow key={i} text={s.text} onClick={() => submit(s.text)} icon={<SearchIcon size={18} />} />
            ),
          )}
        </div>
      ) : !submitted ? (
        recents.length > 0 && (
          <section className="shelf">
            <SectionHeader
              title="Recent Searches"
              trailing={
                <button
                  className="text-button"
                  onClick={() => {
                    setRecents([])
                    saveRecents([])
                  }}
                >
                  Clear
                </button>
              }
            />
            {recents.map((r) => (
              <SuggestionRow key={r} text={r} onClick={() => submit(r)} icon={<ClockIcon size={18} />} />
            ))}
          </section>
        )
      ) : (
        <>
          <div className="filter-pills">
            {FILTERS.map((f) => (
              <button key={f.key} className={`filter-pill ${f.key === filter ? 'is-selected' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          {results.isPending ? (
            <RowsSkeleton />
          ) : results.isError ? (
            <MessageState message="Search failed." action="Retry" onAction={() => results.refetch()} />
          ) : !songs.length && !items.length && !top ? (
            <MessageState message={`No results for "${submitted}"`} />
          ) : (
            <div className="search-results">
              {top && filter === 'all' && <TopResult item={top} />}
              {songs.length > 0 && (
                <section>
                  {filter === 'all' && <SectionHeader title="Songs" />}
                  {songs.map((song, i) => (
                    <SongRow
                      key={song.videoId + i}
                      song={song}
                      onPlay={() => usePlayer.getState().playRadio(song, 'Search')}
                    />
                  ))}
                </section>
              )}
              {items.length > 0 && (
                <section>
                  {filter === 'all' && <SectionHeader title="Albums, Artists & Playlists" />}
                  {items.map((item, i) => (
                    <BrowseRow key={(item.browseId ?? '') + i} item={item} onClick={() => openItem(item, 'Search')} />
                  ))}
                </section>
              )}
              {results.isFetchingNextPage && <RowsSkeleton count={4} />}
            </div>
          )}
        </>
      )}
    </PageScroll>
  )
}

function SuggestionRow({ text, onClick, icon }: { text: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button className="suggestion-row" onClick={onClick}>
      <span className="suggestion-icon">{icon}</span>
      <span className="ellipsis">{text}</span>
    </button>
  )
}

const TYPE_LABEL: Record<string, string> = { album: 'Album', artist: 'Artist', playlist: 'Playlist', song: 'Song', video: 'Video', other: '' }

/** `BrowseRow` from SearchScreen.kt: artists get a round thumbnail. */
export function BrowseRow({ item, onClick }: { item: ShelfItem; onClick: () => void }) {
  return (
    <div
      className="song-row browse-row"
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        openItemMenu(item, { x: e.clientX, y: e.clientY })
      }}
      role="button"
      tabIndex={0}
    >
      <Artwork url={item.thumbnailUrl} px={ROW_ART_PX} radius={8} round={item.type === 'artist'} className="song-row-art" />
      <div className="song-row-text">
        <div className="song-row-title ellipsis">{item.title}</div>
        <div className="song-row-subtitle ellipsis">{item.subtitle || TYPE_LABEL[item.type]}</div>
      </div>
    </div>
  )
}

/** `TopResultCard` from SearchScreen.kt. */
function TopResult({ item }: { item: ShelfItem }) {
  return (
    <div className="top-result">
      <div className="top-result-label">Top result</div>
      <div className="top-result-row" onClick={() => openItem(item, 'Search')} role="button" tabIndex={0}>
        <Artwork url={item.thumbnailUrl} px={ROW_ART_PX} radius={10} round={item.type === 'artist'} className="top-result-art" />
        <div className="top-result-text">
          <div className="top-result-title">{item.title}</div>
          <div className="top-result-subtitle ellipsis">{item.subtitle}</div>
        </div>
        <button
          className="icon-button"
          aria-label="More"
          onClick={(e) => {
            e.stopPropagation()
            openItemMenu(item, { x: e.clientX, y: e.clientY })
          }}
        >
          <MoreIcon size={20} />
        </button>
      </div>
      <div className="top-result-actions">
        <button className="outlined-button" onClick={() => openItem(item, 'Search')}>
          <PlayGlyph size={20} /> {item.song || item.videoId ? 'Play' : 'Open'}
        </button>
      </div>
    </div>
  )
}
