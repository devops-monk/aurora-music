/** A CSS colour ('#rrggbb' or 'rgb(r, g, b)' / 'rgba(…)') at [alpha]. */
export function withAlpha(color: string, alpha: number) {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1, 7), 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? []).map(Number)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
