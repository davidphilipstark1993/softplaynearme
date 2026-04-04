/**
 * City hero images — single source of truth used by:
 *   - Homepage city grid
 *   - City page Open Graph meta
 *   - Blog post Open Graph meta (matched by post.city)
 *
 * All images are high-quality Unsplash shots licensed for free use.
 * Add entries here; they propagate automatically to every consumer.
 */

export const CITY_IMAGES: Record<string, string> = {
  hull:         'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1200&q=80',
  york:         'https://images.unsplash.com/photo-1624119841587-fb82e55f45f0?auto=format&fit=crop&w=1200&q=80',
  leeds:        'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=80',
  sheffield:    'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
  brighton:     'https://images.unsplash.com/photo-1559599238-308793637427?auto=format&fit=crop&w=1200&q=80',
  bournemouth:  'https://images.unsplash.com/photo-1455729552865-3658a5d39692?auto=format&fit=crop&w=1200&q=80',
  manchester:   'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
  birmingham:   'https://images.unsplash.com/photo-1589656966895-2f33e7653819?auto=format&fit=crop&w=1200&q=80',
  liverpool:    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
  bristol:      'https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?auto=format&fit=crop&w=1200&q=80',
  nottingham:   'https://images.unsplash.com/photo-1568495248636-6432b97bd949?auto=format&fit=crop&w=1200&q=80',
  newcastle:    'https://images.unsplash.com/photo-1600718374662-0483d2b9da44?auto=format&fit=crop&w=1200&q=80',
  edinburgh:    'https://images.unsplash.com/photo-1506377585622-bedcbb027afc?auto=format&fit=crop&w=1200&q=80',
  glasgow:      'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
  norwich:      'https://images.unsplash.com/photo-1576400883215-7083980b6674?auto=format&fit=crop&w=1200&q=80',
  colchester:   'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80',
  huddersfield: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
  beverley:     'https://images.unsplash.com/photo-1624119841587-fb82e55f45f0?auto=format&fit=crop&w=1200&q=80',
  bridlington:  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  stirling:     'https://images.unsplash.com/photo-1506377585622-bedcbb027afc?auto=format&fit=crop&w=1200&q=80',
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
