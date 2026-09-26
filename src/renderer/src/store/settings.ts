import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings } from '@shared/api'

interface SettingsState extends Settings {
  loaded: boolean
  load(): Promise<void>
  update(patch: Partial<Settings>): void
}

export const useSettings = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    const s = await window.aurora.getSettings()
    set({ ...s, loaded: true })
  },
  update(patch) {
    set(patch)
    window.aurora.setSettings(patch)
  },
}))
