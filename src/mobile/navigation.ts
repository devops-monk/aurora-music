import { App } from '@capacitor/app'
import { useUi } from '@renderer/store/ui'
import { usePlayer } from '@renderer/store/player'

/**
 * Android's back gesture walks Aurora's own navigation: an open menu, then
 * Now Playing, then the current tab's pages, then back to Home. On Home it
 * sends the app to the background, so the music keeps playing instead of
 * the app closing.
 */
App.addListener('backButton', () => {
  const ui = useUi.getState()
  if (ui.menu) return ui.closeMenu()
  const player = usePlayer.getState()
  if (player.nowPlayingOpen) return player.closeNowPlaying()
  if (ui.stacks[ui.tab].length) return ui.pop()
  if (ui.tab !== 'home') return ui.setTab('home')
  App.minimizeApp()
})
