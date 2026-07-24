/**
 * Venue category types, stored in the existing `venue_type` DB column
 * (previously declared but never populated or read — default 'indoor').
 *
 * Any venue with venue_type unset, null, or 'indoor' (the legacy default)
 * is treated as a genuine soft play centre for backward compatibility.
 * Only the explicit non-soft-play tags below should be excluded from
 * soft-play-specific ranking modules (city "Top Rated" / "Best for
 * Toddlers"). See /reports/data-quality-audit.md Phase 2 for the venues
 * queued for each tag.
 */
export const NON_SOFT_PLAY_VENUE_TYPES = [
  'trampoline-park',
  'play-farm',
  'family-attraction',
] as const

export type NonSoftPlayVenueType = (typeof NON_SOFT_PLAY_VENUE_TYPES)[number]

export function isSoftPlayVenueType(venueType: string | null | undefined): boolean {
  if (!venueType) return true
  return !NON_SOFT_PLAY_VENUE_TYPES.includes(venueType as NonSoftPlayVenueType)
}
