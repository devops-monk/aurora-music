import type { SVGProps } from 'react'

/**
 * BitChord's icon family (`ui/icons/BitChordIcons.kt`), path for path: thick
 * 2.2px strokes with round caps and joins on a 24px grid. The transport glyphs
 * are BitChord's `ic_player_*` vector drawables on their 960 grid.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const STROKE = 2.2

function Stroke({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => (
  <Stroke {...p} strokeWidth={1.7}>
    <path fill="currentColor" d="M12 4.05 19.75 11.35V19.65H14.95V15.6H9.05V19.65H4.25V11.35Z" />
  </Stroke>
)

export const SearchIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4.6 11a6.4 6.4 0 1 1 12.8 0a6.4 6.4 0 1 1-12.8 0M15.9 15.9 20.4 20.4" />
  </Stroke>
)

export const ExploreIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3.4 12a8.6 8.6 0 1 1 17.2 0a8.6 8.6 0 1 1-17.2 0M15.4 8.6 13.6 13.6 8.6 15.4 10.4 10.4Z" />
  </Stroke>
)

export const LibraryIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4.6 4.8v14.4M9.2 4.8v14.4M13.8 4.8v14.4M17.2 5.6l3.4 13.3" />
  </Stroke>
)

export const ShuffleIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3.4 7.4H7l9.6 9.2h4M18.1 14.1l2.5 2.5-2.5 2.5M3.4 16.6H7l2.8-2.7M13.9 10.1l2.7-2.7h4M18.1 4.9l2.5 2.5-2.5 2.5" />
  </Stroke>
)

export const RepeatIcon = ({ one, ...p }: IconProps & { one?: boolean }) => (
  <Stroke {...p}>
    <path d="M8.6 7.6h6.8a4.4 4.4 0 0 1 0 8.8H8.6a4.4 4.4 0 0 1 0-8.8ZM13.5 5.7l1.9 1.9-1.9 1.9M10.5 14.5l-1.9 1.9 1.9 1.9" />
    {one && (
      <text x="12" y="13.9" fontSize="6.4" fontWeight="800" textAnchor="middle" fill="currentColor" stroke="none">
        1
      </text>
    )}
  </Stroke>
)

export const InfinityIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 12C10.1 9.1 8.7 8 7.1 8a4 4 0 0 0 0 8C8.7 16 10.1 14.9 12 12c1.9-2.9 3.3-4 4.9-4a4 4 0 0 1 0 8c-1.6 0-3-1.1-4.9-4" />
  </Stroke>
)

export const MusicNoteIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path
      fill="currentColor"
      stroke="none"
      d="M4.2 17.7a2.9 2.5 0 1 1 5.8 0a2.9 2.5 0 1 1-5.8 0ZM14.2 15.9a2.9 2.5 0 1 1 5.8 0a2.9 2.5 0 1 1-5.8 0Z"
    />
    <path d="M10 17.7v-11M20 15.9v-11M10 6.7l10-1.8" />
  </Stroke>
)

export const LyricsIcon = (p: IconProps) => (
  <Stroke {...p} strokeWidth={2}>
    <path d="M6 3.5h12q3 0 3 3V15q0 3-3 3h-8l-4 3v-3q-3 0-3-3V6.5q0-3 3-3Z" />
    <path
      fill="currentColor"
      stroke="none"
      d="M7.6 8h3v3.1q0 2.1-2.5 2.6v-1.4q1.2-.3 1.2-1.3H7.6ZM12.8 8h3v3.1q0 2.1-2.5 2.6v-1.4q1.2-.3 1.2-1.3h-1.7Z"
    />
  </Stroke>
)

export const QueueIcon = (p: IconProps) => (
  <Stroke {...p} strokeWidth={2}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path fill="currentColor" stroke="none" d="M4.35 6a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 1 1 2.5 0ZM4.35 12a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 1 1 2.5 0ZM4.35 18a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 1 1 2.5 0Z" />
  </Stroke>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9.5 6.2 15.3 12l-5.8 5.8" />
  </Stroke>
)

export const ChevronLeftIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M14.5 6.2 8.7 12l5.8 5.8" />
  </Stroke>
)

export const ChevronDownIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M6.2 9.5 12 15.3l5.8-5.8" />
  </Stroke>
)

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Stroke {...p}>
    <path
      fill={filled ? 'currentColor' : 'none'}
      d="M12 20s-8.8-5.4-8.8-11.1a4.5 4.5 0 0 1 8.8-1.5 4.5 4.5 0 0 1 8.8 1.5C20.8 14.6 12 20 12 20Z"
    />
  </Stroke>
)

export const PlusIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
)

export const CheckIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m5 12.8 4.6 4.6L19 6.9" />
  </Stroke>
)

export const DownloadIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5M4.5 18h15" />
  </Stroke>
)

export const FolderIcon = (p: IconProps) => (
  <Stroke {...p} strokeWidth={2}>
    <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
  </Stroke>
)

export const ClockIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3.4 12a8.6 8.6 0 1 1 17.2 0a8.6 8.6 0 1 1-17.2 0M12 7.4V12l3.4 1.8" />
  </Stroke>
)

export const CloseIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Stroke>
)

export const MoreIcon = ({ size = 24, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <circle cx="5.5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="18.5" cy="12" r="1.9" />
  </svg>
)

export const GearIcon = (p: IconProps) => (
  <Stroke {...p} strokeWidth={1.9}>
    <path d="M12 8.9a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2Z" />
    <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4Z" />
  </Stroke>
)

export const PersonIcon = (p: IconProps) => (
  <Stroke {...p} strokeWidth={1.9}>
    <path d="M12 4.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6ZM4.6 20c.8-3.6 3.8-5.6 7.4-5.6s6.6 2 7.4 5.6" />
  </Stroke>
)

export const RadioIcon = (p: IconProps) => (
  <Stroke {...p} strokeWidth={2}>
    <path d="M10 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0ZM7.1 7.1a7 7 0 0 0 0 9.8M16.9 7.1a7 7 0 0 1 0 9.8M4.2 4.2a11 11 0 0 0 0 15.6M19.8 4.2a11 11 0 0 1 0 15.6" />
  </Stroke>
)

export const ShareIcon = (p: IconProps) => (
  <Stroke {...p} strokeWidth={2}>
    <path d="M12 3.5v11M8 7.5l4-4 4 4M6 11H5v9h14v-9h-1" />
  </Stroke>
)

export const PlayNextIcon = (p: IconProps) => (
  <Stroke {...p} strokeWidth={2}>
    <path d="M4 6h10M4 12h10M4 18h6" />
    <path fill="currentColor" d="M15.5 14.5v6l5-3Z" />
  </Stroke>
)

export const VolumeDownIcon = (p: IconProps) => (
  <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M5 9.5h3l4-3.5v12l-4-3.5H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
    <path d="M15.2 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export const VolumeUpIcon = (p: IconProps) => (
  <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M3 9.5h3l4-3.5v12l-4-3.5H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
    <path d="M13.2 9a4 4 0 0 1 0 6M16.2 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

// ---- Transport (the player's own drawables, 960 grid) ----------------------

export const PlayGlyph = ({ size = 24, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 960 960" fill="currentColor" aria-hidden {...p}>
    <path d="M320 687V273q0-17 12-28.5t28-11.5q5 0 10.5 1.5T381 239l326 207q9 6 13.5 15t4.5 19q0 10-4.5 19T707 514L381 721q-5 3-10.5 4.5T360 727q-16 0-28-11.5T320 687Z" />
  </svg>
)

export const PauseGlyph = ({ size = 24, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 960 960" fill="currentColor" aria-hidden {...p}>
    <path d="M595 720q-33 0-56.5-23.5T515 640V320q0-33 23.5-56.5T595 240q33 0 56.5 23.5T675 320v320q0 33-23.5 56.5T595 720Zm-230 0q-33 0-56.5-23.5T285 640V320q0-33 23.5-56.5T365 240q33 0 56.5 23.5T445 320v320q0 33-23.5 56.5T365 720Z" />
  </svg>
)

export const NextGlyph = ({ size = 40, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 960 960" fill="currentColor" stroke="currentColor" strokeWidth="60" strokeLinejoin="round" strokeLinecap="round" aria-hidden {...p}>
    <path d="M85.93 732.51V227.49L455.49 480Zm419.25 0V227.49L874.74 480Z" />
  </svg>
)

export const PreviousGlyph = ({ size = 40, ...p }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 960 960" fill="currentColor" stroke="currentColor" strokeWidth="60" strokeLinejoin="round" strokeLinecap="round" aria-hidden {...p}>
    <path d="M872.74 732.51 503.18 480l369.56-252.51Zm-415.92 0L87.26 480l369.56-252.51Z" />
  </svg>
)

/** Material's rounded play/pause/skip, which the mini player uses at 32px. */
export const MiniPlay = ({ size = 32 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 0 0 0-1.69L9.54 5.98A.998.998 0 0 0 8 6.82z" />
  </svg>
)
export const MiniPause = ({ size = 32 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z" />
  </svg>
)
export const MiniNext = ({ size = 32 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="m7.58 16.89 5.77-4.07c.56-.4.56-1.24 0-1.63L7.58 7.11C6.91 6.65 6 7.12 6 7.93v8.14c0 .81.91 1.28 1.58.82zM16 7v10c0 .55.45 1 1 1s1-.45 1-1V7c0-.55-.45-1-1-1s-1 .45-1 1z" />
  </svg>
)
export const EqualizerIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className="eq-bars">
    <rect x="4" y="10" width="3" height="10" rx="1.5" />
    <rect x="10.5" y="4" width="3" height="16" rx="1.5" />
    <rect x="17" y="8" width="3" height="12" rx="1.5" />
  </svg>
)
