/**
 * City hub pagination. Venue cards (images, badges, quotes) dominate the HTML
 * weight of a hub page, so only this many render per page; the rest are reached
 * through the numbered links below the grid. Shared so the page, its metadata
 * and the sitemap can never disagree about how many pages a hub has.
 */
export const VENUES_PER_PAGE = 24

export function totalPagesFor(venueCount: number): number {
  return Math.max(1, Math.ceil(venueCount / VENUES_PER_PAGE))
}

/** `?page=N` as a positive integer; anything else (missing, 0, NaN) is page 1. */
export function parsePageParam(page: string | undefined): number {
  return Math.max(1, parseInt(page || '1', 10) || 1)
}

/** Canonical path for a hub page: page 1 has no query string. */
export function hubPagePath(citySlug: string, page: number): string {
  return page > 1 ? `/soft-play/${citySlug}?page=${page}` : `/soft-play/${citySlug}`
}

/**
 * Page numbers to link to: always first and last, a window around the current
 * page, and nothing else — with `null` marking a gap ("…").
 */
export function pageWindow(current: number, total: number, radius = 2): (number | null)[] {
  const pages = new Set<number>([1, total])
  for (let p = current - radius; p <= current + radius; p++) if (p >= 1 && p <= total) pages.add(p)
  const sorted = [...pages].sort((a, b) => a - b)
  const out: (number | null)[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null)
    out.push(p)
  })
  return out
}
