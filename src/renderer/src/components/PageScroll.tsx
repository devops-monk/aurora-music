import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useUi } from '../store/ui'

/** Past this much scroll the top bar frosts and the tab bar collapses inline. */
const SCROLLED_AT = 24
/** Ask for more this close to the end, like the Android feed's `total - 3`. */
const END_REACHED_PX = 900

const positions = new Map<string, number>()

/**
 * A page's scroll container. It reports "scrolled" to the chrome, fires
 * [onEndReached] for infinite feeds, and remembers its offset per [id] so going
 * back to a page lands where it was left.
 */
export function PageScroll({
  id,
  children,
  onEndReached,
  className = '',
  style,
}: {
  id: string
  children: ReactNode
  onEndReached?: () => void
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const endRef = useRef(onEndReached)
  endRef.current = onEndReached

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = positions.get(id) ?? 0
    useUi.getState().setScrolled(el.scrollTop > SCROLLED_AT)
    const onScroll = () => {
      positions.set(id, el.scrollTop)
      useUi.getState().setScrolled(el.scrollTop > SCROLLED_AT)
      if (endRef.current && el.scrollHeight - el.scrollTop - el.clientHeight < END_REACHED_PX) endRef.current()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [id])

  return (
    <div className={`page-scroll ${className}`} ref={ref} style={style}>
      {children}
    </div>
  )
}
