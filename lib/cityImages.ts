/**
 * City hero images — single source of truth used by:
 *   - City page Open Graph meta
 *   - Blog post Open Graph meta (matched by post.city)
 * (The homepage city grid no longer uses this — see app/page.tsx, which
 * renders a deterministic gradient card instead of a photo.)
 *
 * Every entry here was fetched and visually checked against its city name
 * (Aug 2026 audit). Most of the previous list — assembled without that
 * check — turned out to be mismatched (e.g. "Birmingham" was a polar bear,
 * "Manchester" a pool villa, "Leeds" was actually London, "Glasgow" a
 * wedding photo). Rather than replace those with more unverified guesses,
 * unlisted cities fall back to DEFAULT_OG_IMAGE. Only add a city here after
 * opening the exact URL and confirming it actually shows that city.
 */

export const CITY_IMAGES: Record<string, string> = {
  york:      'https://images.unsplash.com/photo-1682346361366-4ba6b4a943f0?auto=format&fit=crop&w=1200&q=80', // verified: York Minster
  beverley:  'https://images.unsplash.com/photo-1682346361366-4ba6b4a943f0?auto=format&fit=crop&w=1200&q=80', // shares York's image (same East Yorkshire area)
  edinburgh: 'https://images.unsplash.com/photo-1506377585622-bedcbb027afc?auto=format&fit=crop&w=1200&q=80', // verified: Edinburgh skyline
  stirling:  'https://images.unsplash.com/photo-1506377585622-bedcbb027afc?auto=format&fit=crop&w=1200&q=80', // shares Edinburgh's image (same region)
}

/** Default OG image when no city-specific one exists */
export const DEFAULT_OG_IMAGE = 'https://www.softplaynearme.co.uk/opengraph-image'

/**
 * Return the best OG image URL for a given city slug.
 * Falls back to DEFAULT_OG_IMAGE if no match.
 */
export function getCityOgImage(citySlug: string): string {
  return CITY_IMAGES[citySlug.toLowerCase()] ?? DEFAULT_OG_IMAGE
}

/**
 * Return the best OG image for a blog post given the post's city name.
 * Converts "Manchester" → "manchester" for lookup.
 */
export function getBlogOgImage(cityName: string): string {
  return getCityOgImage(cityName.toLowerCase().replace(/\s+/g, '-'))
}
