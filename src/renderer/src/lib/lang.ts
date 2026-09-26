import { useSettings } from '../store/settings'

/** The app's language: the one chosen in Settings, else the system's. */
export function appLanguage(): string {
  const chosen = useSettings.getState().language
  return (chosen || navigator.language || 'en').split('-')[0].toLowerCase()
}

/** The language lyrics translate into. */
export function lyricsTarget(): string {
  return useSettings.getState().lyricsTranslateTo || appLanguage()
}

/** "fr" → "French", in the app's own language. */
export function languageName(code: string, inLanguage = appLanguage()): string {
  try {
    const name = new Intl.DisplayNames([inLanguage], { type: 'language' }).of(code)
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code
  } catch {
    return code
  }
}

/** Languages offered for lyrics translation. */
export const TRANSLATION_LANGUAGES = [
  'ar', 'bn', 'zh', 'nl', 'en', 'fil', 'fr', 'de', 'el', 'he', 'hi', 'id', 'it', 'ja', 'ko', 'ms', 'fa', 'pl', 'pt', 'pa',
  'ro', 'ru', 'es', 'sv', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'vi',
]
