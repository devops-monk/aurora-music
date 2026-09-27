/**
 * The Android build (src/mobile) doesn't have the desktop-only features yet:
 * downloads, local folders, Listen Together, Discord,
 * scrobbling, and the Web Audio effects (equaliser, crossfade, normalising).
 * Screens hide those entry points on Android rather than offer dead buttons.
 */
export const IS_ANDROID = window.aurora.platform === 'android'
