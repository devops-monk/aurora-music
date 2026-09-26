import { create } from 'zustand'
import type { Account } from '@shared/models'

export type Tab = 'home' | 'explore' | 'library' | 'search'

export type Page =
  | { kind: 'detail'; browseId: string; title?: string }
  | { kind: 'mood'; browseId: string; params?: string | null; title: string }
  | { kind: 'songs'; title: string; browseId: string }
  | { kind: 'settings' }

export interface ContextMenuState {
  x: number
  y: number
  items: { label: string; icon?: React.ReactNode; onSelect: () => void; destructive?: boolean }[]
}

interface UiState {
  tab: Tab
  /** A pushed-page stack per tab, as in BitChord's per-tab navigation. */
  stacks: Record<Tab, Page[]>
  /** Whether the current page has scrolled far enough to collapse the tab bar. */
  scrolled: boolean
  account: Account | null
  accountLoaded: boolean
  menu: ContextMenuState | null
  toast: { id: number; text: string } | null
  searchQuery: string
  fullscreen: boolean

  setTab(tab: Tab): void
  push(page: Page): void
  pop(): void
  setScrolled(scrolled: boolean): void
  setAccount(account: Account | null): void
  openMenu(menu: ContextMenuState): void
  closeMenu(): void
  showToast(text: string): void
  setSearchQuery(q: string): void
}

export const useUi = create<UiState>((set, get) => ({
  tab: 'home',
  stacks: { home: [], explore: [], library: [], search: [] },
  scrolled: false,
  account: null,
  accountLoaded: false,
  menu: null,
  toast: null,
  searchQuery: '',
  fullscreen: false,

  setTab(tab) {
    const s = get()
    // Re-selecting the current tab pops back to its root, as on Android.
    if (s.tab === tab) set({ stacks: { ...s.stacks, [tab]: [] }, scrolled: false })
    else set({ tab, scrolled: false })
  },
  push(page) {
    const s = get()
    set({ stacks: { ...s.stacks, [s.tab]: [...s.stacks[s.tab], page] }, scrolled: false, menu: null })
  },
  pop() {
    const s = get()
    const stack = s.stacks[s.tab]
    if (stack.length) set({ stacks: { ...s.stacks, [s.tab]: stack.slice(0, -1) }, scrolled: false })
  },
  setScrolled(scrolled) {
    if (get().scrolled !== scrolled) set({ scrolled })
  },
  setAccount(account) {
    set({ account, accountLoaded: true })
  },
  openMenu(menu) {
    set({ menu })
  },
  closeMenu() {
    set({ menu: null })
  },
  showToast(text) {
    const id = Date.now()
    set({ toast: { id, text } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 2600)
  },
  setSearchQuery(searchQuery) {
    set({ searchQuery })
  },
}))

export const currentPage = (s: UiState): Page | null => {
  const stack = s.stacks[s.tab]
  return stack[stack.length - 1] ?? null
}
