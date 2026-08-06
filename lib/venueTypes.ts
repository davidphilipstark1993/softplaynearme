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
