import { describe, expect, it } from 'vitest'
import { withAlpha } from './color'

describe('withAlpha', () => {
  it('handles hex and rgb() colours', () => {
    expect(withAlpha('#5b8cff', 0.5)).toBe('rgba(91, 140, 255, 0.5)')
    expect(withAlpha('rgb(91, 140, 255)', 0.66)).toBe('rgba(91, 140, 255, 0.66)')
    expect(withAlpha('rgba(10, 20, 30, 0.9)', 0)).toBe('rgba(10, 20, 30, 0)')
  })
})
