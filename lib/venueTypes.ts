/**
 * Venue category types, stored in the `venue_type` DB column.
 *
 * Any venue with venue_type unset, null, or 'indoor' (the legacy default)
 * is treated as a genuine soft play centre. The non-soft-play tags below are
 * excluded from both the main city A–Z listing/count/schema
 * (app/soft-play/[city]/page.tsx) and soft-play-specific ranking modules
 * (city "Top Rated" / "Best for Toddlers") — but not deleted, since they're
 * real, visitable businesses. They're surfaced instead via the "Other family
 * activities" filter tab on each city page. See
 * scripts/migrations/phase4-01-classify-venue-types.mjs and
 * /reports/data-quality-audit.md §2 for how venues were classified.
 */
export const NON_SOFT_PLAY_VENUE_TYPES = [
  'trampoline-park',
  'play-farm',
  'park-playground',
  'family-attraction',
] as const

export type NonSoftPlayVenueType = (typeof NON_SOFT_PLAY_VENUE_TYPES)[number]

export const NON_SOFT_PLAY_VENUE_TYPE_LABELS: Record<NonSoftPlayVenueType, string> = {
  'trampoline-park': 'Trampoline park',
  'play-farm': 'Play farm',
  'park-playground': 'Park playground',
  'family-attraction': 'Family attraction',
}

export function isSoftPlayVenueType(venueType: string | null | undefined): boolean {
  if (!venueType) return true
  return !NON_SOFT_PLAY_VENUE_TYPES.includes(venueType as NonSoftPlayVenueType)
}

/**
 * venue_type values that count as "genuine soft play" for the main
 * directory — visible in the default city listing, counted in every
 * total/card/hero figure. 'pub' is here alongside the 'indoor' default
 * because pub venues with a real, verified play offering (toddler area +
 * parties, not just any pub) are legitimate, not scope creep — see
 * scripts/migrations/phase5-01-reclassify-venue-types.mjs. Keep this as the
 * single source of truth: every count (homepage hero/cards, hub heading,
 * meta descriptions) and every listing query should reference this rather
 * than repeating the `venue_type IS NULL OR venue_type = 'indoor'` condition
 * inline, which is exactly how the pub venues fell out of sync with the
 * homepage counts after being added.
 */
export const VISIBLE_VENUE_TYPES = ['indoor', 'pub'] as const

/**
 * True when a venue belongs in the main soft-play directory and may be
 * indexed / listed in the sitemap. Anything with a venue_type outside
 * VISIBLE_VENUE_TYPES (park playgrounds, farms, trampoline parks, attractions,
 * leisure centres, mobile hire, retail) stays reachable by URL but is noindex
 * and out of the sitemap, so search engines see a focused soft-play site.
 */
export function isDirectoryVenueType(venueType: string | null | undefined): boolean {
  return !venueType || (VISIBLE_VENUE_TYPES as readonly string[]).includes(venueType)
}

/** SQL fragment for `WHERE <this>` — visible venue_types only. Assumes the venues table/alias is unqualified or aliased as `v`. */
export function visibleVenueTypeSql(alias = 'v'): string {
  return `(${alias}.venue_type IS NULL OR ${alias}.venue_type IN ('${VISIBLE_VENUE_TYPES.join("','")}'))`
}
