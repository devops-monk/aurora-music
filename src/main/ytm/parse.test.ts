import { describe, expect, it } from 'vitest'
import { shelfItemOf } from './parse'

/** youtubei.js Text nodes stringify to their text. */
const text = (value: string) => ({ text: value, toString: () => value })

describe('shelfItemOf', () => {
  const episode = (extra: object = {}) => ({
    type: 'MusicTwoRowItem',
    title: text('Shayad (From "Love Aaj Kal")'),
    subtitle: text('3 min 10 sec • Arijit Singh'),
    endpoint: { payload: { browseId: 'MPEDMJyKN-8UncM' } },
    ...extra,
  })

  it('plays an episode-style music video instead of opening an empty page', () => {
    const item = shelfItemOf(episode())
    expect(item?.videoId).toBe('MJyKN-8UncM')
    expect(item?.browseId).toBeUndefined()
    expect(item?.song?.artist).toBe('Arijit Singh')
  })

  it("prefers the card's own play button when it has one", () => {
    const item = shelfItemOf(episode({ thumbnail_overlay: { content: { endpoint: { payload: { videoId: 'abcdefghijk' } } } } }))
    expect(item?.videoId).toBe('abcdefghijk')
  })

  it('still opens real playlists', () => {
    const item = shelfItemOf({ type: 'MusicTwoRowItem', title: text('Uncut Bollywood'), endpoint: { payload: { browseId: 'VLRDCLAK5uy_krbBs7P2iEb30IODyVbiOXWyhZtAIX9Uk' } } })
    expect(item?.browseId).toBe('VLRDCLAK5uy_krbBs7P2iEb30IODyVbiOXWyhZtAIX9Uk')
    expect(item?.videoId).toBeUndefined()
  })
})
