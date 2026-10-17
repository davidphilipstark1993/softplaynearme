// The one place venue URL slugs are made. Every importer and migration uses it.
//
// A venue's URL is /soft-play/{city}/{slug}, so the city is already in the path;
// repeating it in the slug (…/hull/ping-pong-tots-hull-hull) adds nothing and
// looks spammy. The old importers built the slug from `${name}-${city}`, so a
// venue already named "Ping Pong Tots Hull" became ping-pong-tots-hull-hull.
//
//   venueSlug('Ping Pong Tots Hull', 'hull')      -> 'ping-pong-tots'
//   venueSlug('Monkey Bizness Hull', 'hull')      -> 'monkey-bizness'
//   venueSlug('Big Fun Indoor Play Centre', 'hull') -> 'big-fun-indoor-play-centre'
//   venueSlug('Hull Adventure', 'hull')           -> 'hull-adventure'   (city inside the name is kept)

/** Paths that exist under /soft-play/{city}/ and so can never be a venue slug. */
export const RESERVED_VENUE_SLUGS = new Set(['toddler', 'birthday-parties', 'sen-friendly', 'open-now'])

/** Lowercase, non-alphanumerics -> hyphens, trimmed, capped at 100 chars. */
export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100)
    .replace(/-$/, '')
}

/** How many times `-{city}` repeats at the end of the slug (hull-hull = 2). */
export function trailingCityCount(slug, citySlug) {
  let n = 0
  let s = slug
  const suffix = `-${citySlug}`
  while (s.endsWith(suffix)) {
    n++
    s = s.slice(0, -suffix.length)
  }
  return n
}

/**
 * Remove every trailing `-{city}` from a slug. If that would leave nothing useful
 * (under 3 characters, or a reserved word), fall back to dropping only the
 * repeats (lc-swansea-swansea -> lc-swansea); a slug with a single suffix is then
 * left as it is.
 */
export function stripTrailingCity(slug, citySlug) {
  const suffix = `-${citySlug}`
  let s = slug
  while (s.endsWith(suffix)) s = s.slice(0, -suffix.length)
  if (s === slug) return slug
  if (s.length >= 3 && !RESERVED_VENUE_SLUGS.has(s)) return s
  const repeats = trailingCityCount(slug, citySlug)
  return repeats > 1 ? slug.slice(0, slug.length - (repeats - 1) * suffix.length) : slug
}

/** The slug a new venue gets: name only, never the city. */
export function venueSlug(name, citySlug) {
  return stripTrailingCity(slugify(name), citySlug)
}

/** Make `base` unique within `taken` (adds -2, -3 …) and records it. */
export function uniqueSlug(base, taken) {
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
  taken.add(slug)
  return slug
}
