/**
 * The Aurora Music mark: three aurora ribbons rising out of a night sky, which
 * double as a sound wave. The same drawing is rendered to the app icons by
 * scripts/make-icons.mjs, from resources/logo.svg.
 */
export function AppMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden>
      <defs>
        <linearGradient id="am-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1030" />
          <stop offset="1" stopColor="#1B0B2E" />
        </linearGradient>
        <linearGradient id="am-a" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#2AF5B8" />
          <stop offset="1" stopColor="#2AF5B8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="am-b" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#5B8CFF" />
          <stop offset="1" stopColor="#B06BFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="am-c" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FF5FA2" />
          <stop offset="1" stopColor="#FF5FA2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="228" fill="url(#am-sky)" />
      <path d="M236 800C236 560 300 360 360 200c40 170 50 380 30 600Z" fill="url(#am-a)" />
      <path d="M430 800c0-290 60-520 130-660 50 210 60 440 30 660Z" fill="url(#am-b)" />
      <path d="M640 800c-10-220 40-400 110-520 40 170 40 350 20 520Z" fill="url(#am-c)" />
      <rect x="196" y="784" width="632" height="40" rx="20" fill="#fff" opacity="0.92" />
    </svg>
  )
}
