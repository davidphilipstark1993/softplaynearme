// Search results cut descriptions at roughly 155-160 characters. Longer text is
// trimmed back to the last whole word with an ellipsis, so a snippet never ends
// mid-word. Text already within the limit is returned untouched.
export const META_DESCRIPTION_MAX = 155

export function trimMeta(text: string, max?: number): string
export function trimMeta(text: string | null | undefined, max?: number): string | undefined
export function trimMeta(text: string | null | undefined, max = META_DESCRIPTION_MAX): string | undefined {
  if (!text) return undefined
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-\u2013\u2014]+$/, '')
  return `${base}\u2026`
}
