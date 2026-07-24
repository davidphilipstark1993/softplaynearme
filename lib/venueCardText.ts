/**
 * What a venue card shows instead of the generic AI-written description
 * paragraph (which can carry rotating boilerplate that asserts facts we
 * don't actually have for that specific venue — sock policies, etc. See
 * reports/data-quality-audit.md Phase 3). A card should only show facts we
 * actually hold: a genuine review quote if we have one, otherwise nothing —
 * the facility tags, rating, and address already carry the real signal.
 */
export function getCardQuote(reviewSnippet: string | null | undefined): string | null {
  if (!reviewSnippet) return null
  const trimmed = reviewSnippet.trim()
  // Guard against short/fragment snippets that don't read as a real quote
  if (trimmed.length < 15 || !/\w{3,}/.test(trimmed)) return null
  return trimmed.replace(/^["']|["']$/g, '')
}

export function formatLastVerified(lastVerifiedAt: string | Date | null | undefined): string | null {
  if (!lastVerifiedAt) return null
  const date = new Date(lastVerifiedAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
