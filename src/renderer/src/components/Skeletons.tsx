/** Shimmer placeholders shaped like the content they stand in for (`Skeletons.kt`). */

export function ShelfSkeleton({ hero }: { hero?: boolean }) {
  return (
    <section className="shelf">
      <div className="section-header">
        <div className="skeleton" style={{ width: 180, height: 22, borderRadius: 6 }} />
      </div>
      <div className="hscroll" style={{ overflow: 'hidden' }}>
        {Array.from({ length: 8 }, (_, i) =>
          hero ? (
            <div key={i} className="hero-card skeleton" />
          ) : (
            <div key={i} className="shelf-card">
              <div className="skeleton" style={{ aspectRatio: '1', borderRadius: 12 }} />
              <div className="skeleton" style={{ height: 14, width: '80%', marginTop: 10, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 12, width: '55%', marginTop: 6, borderRadius: 4 }} />
            </div>
          ),
        )}
      </div>
    </section>
  )
}

export function FeedSkeleton() {
  return (
    <>
      <ShelfSkeleton hero />
      <ShelfSkeleton />
      <ShelfSkeleton />
    </>
  )
}

export function RowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="song-row" style={{ pointerEvents: 'none' }}>
          <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 8 }} />
          <div className="song-row-text">
            <div className="skeleton" style={{ height: 14, width: '42%', borderRadius: 4 }} />
            <div className="skeleton" style={{ height: 12, width: '26%', marginTop: 7, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
