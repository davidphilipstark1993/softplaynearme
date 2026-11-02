import { isSoftPlayVenueType } from './venueTypes'

/**
 * Venue <title>, e.g. `Party and Play, Birmingham: Soft Play Hours & Reviews`.
 * A complete title (the page opts out of the "| Soft Play Near Me" template), kept to
 * about 60 characters. "Hours", "Prices" and "Reviews" appear only when the venue's
 * record actually holds that data.
 */
export const MAX_VENUE_TITLE = 60

export interface VenueTitleInput {
  name: string
  town: string
  venueType?: string | null
  hasHours?: boolean
  hasPrice?: boolean
  hasReviews?: boolean
}

export function buildVenueTitle(v: VenueTitleInput): string {
  const where = v.town && !v.name.toLowerCase().includes(v.town.toLowerCase()) ? `${v.name}, ${v.town}` : v.name
  const kind = isSoftPlayVenueType(v.venueType) ? 'Soft Play' : 'Family Fun'
  const parts = [v.hasHours && 'Hours', v.hasPrice && 'Prices', v.hasReviews && 'Reviews'].filter(Boolean) as string[]
  for (const n of [parts.length, Math.min(parts.length, 2), 1, 0]) {
    const picked = parts.slice(0, n)
    const tail = picked.length ? `${kind} ${picked.join(' & ')}` : `${kind} Info`
    const title = `${where}: ${tail}`
    if (title.length <= MAX_VENUE_TITLE) return title
  }
  const short = `${where} | ${kind}`
  return short.length <= MAX_VENUE_TITLE ? short : where
}

/**
 * Stored seo_title values written by the old bulk SEO pass are the same boilerplate on every
 * row ("X | Children's Soft Play Centre, Town") and, with the site suffix, run to ~88 chars.
 * Those are replaced by buildVenueTitle(); a hand-written title is kept.
 */
export function isBoilerplateSeoTitle(t: string | null | undefined): boolean {
  if (!t) return false
  return /\|\s*(Children['’]s Soft Play Centre,|Soft Play & Kids['’] Activities in)/i.test(t)
}
