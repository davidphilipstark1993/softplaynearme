/**
 * Single source of truth for where adverts can appear. Imported by the public
 * API, the admin form and the <AdSlot> component, so adding a placement is a
 * one-line change here plus dropping an <AdSlot placement="…" /> on the page.
 */
export const PLACEMENTS = [
  {
    key: 'home_promo',
    label: 'Homepage promotional section',
    hint: 'Full-width banner below "Browse by City" on the homepage.',
    variant: 'banner',
  },
  {
    key: 'home_between',
    label: 'Homepage between sections',
    hint: 'Banner between the venue sections and the venue-owner call to action.',
    variant: 'banner',
  },
  {
    key: 'city_page',
    label: 'City landing pages',
    hint: 'Below the venue listings on /soft-play/[city] — never inside the results.',
    variant: 'banner',
  },
  {
    key: 'venue_page',
    label: 'Individual venue pages',
    hint: 'Below the venue details, above the newsletter sign-up.',
    variant: 'banner',
  },
  {
    key: 'blog_post',
    label: 'Blog and article pages',
    hint: 'After the article, before the newsletter sign-up.',
    variant: 'banner',
  },
  {
    key: 'newsletter_confirmation',
    label: 'Newsletter confirmation',
    hint: 'Shown inside the "You\'re on the list" confirmation after someone subscribes.',
    variant: 'card',
  },
] as const

export type PlacementKey = (typeof PLACEMENTS)[number]['key']
export type AdVariant = 'banner' | 'card'

/** Stored in ads.placements to mean "every placement, including future ones". */
export const ALL_PLACEMENTS = 'all'

export const PLACEMENT_KEYS: string[] = PLACEMENTS.map((p) => p.key)

export function isPlacementKey(value: string): value is PlacementKey {
  return PLACEMENT_KEYS.includes(value)
}

export function placementLabel(key: string): string {
  if (key === ALL_PLACEMENTS) return 'Everywhere'
  return PLACEMENTS.find((p) => p.key === key)?.label ?? key
}

/** Placements where city targeting (ads.city_slugs) is meaningful. */
export const CITY_TARGETABLE: string[] = ['city_page', 'venue_page']

/** Artwork is cropped to this on upload so cards never shift when images load. */
export const AD_IMAGE_WIDTH = 1280
export const AD_IMAGE_HEIGHT = 720
