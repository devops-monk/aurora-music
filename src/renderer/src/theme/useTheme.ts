import { useEffect, useSyncExternalStore } from 'react'
import { useSettings } from '../store/settings'

const media = window.matchMedia('(prefers-color-scheme: dark)')
const subscribe = (cb: () => void) => {
  media.addEventListener('change', cb)
  return () => media.removeEventListener('change', cb)
}

export function useIsDark(): boolean {
  const theme = useSettings((s) => s.theme)
  const systemDark = useSyncExternalStore(subscribe, () => media.matches)
  return theme === 'system' ? systemDark : theme === 'dark'
}

/** Puts the resolved theme and motion preference on <html>, and tells the OS caption buttons. */
export function useApplyTheme() {
  const dark = useIsDark()
  const reduce = useSettings((s) => s.reduceAnimation)
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    window.aurora.setTitleBarTheme(dark)
  }, [dark])
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduce)
  }, [reduce])
}
