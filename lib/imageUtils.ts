/**
 * Scraped venue photo URLs that are never renderable, so render sites should
 * treat them the same as "no photo" rather than pass them to next/image:
 *  - `gps-cs-s` is Google's session-scoped Maps photo path; it 403s once the
 *    scrape session expires (confirmed: 719 venues affected as of Aug 2026).
 *  - `streetviewpixels-pa.googleapis.com` panoids likewise expire (404).
 *  - `result-no-thumbnail` / `default_user.png` aren't photos at all — they're
 *    Google's own "no photo available" placeholder assets, scraped as if they
 *    were real images.
 *  - literal "nan" strings leak in from the CSV/scrape pipeline (see
 *    lib/sanitize.ts for the same pattern on address fields).
 * Google's stable `lh3.googleusercontent.com/p/AF1Qip...` place-photo
 * references are NOT in this list — those 200 in spot checks and should
 * still render.
 */
const UNRENDERABLE_PHOTO_PATTERNS = [
  /googleusercontent\.com\/gps-cs-s\//,
  /streetviewpixels-pa\.googleapis\.com/,
  /maps\.gstatic\.com\/tactile\/pane\/result-no-thumbnail/,
  /ssl\.gstatic\.com\/local\/servicebusiness\/default_user\.png/,
]

/**
 * Hostnames next/image is configured to optimise (must mirror
 * `images.remotePatterns` in next.config.ts — next/image throws a hard
 * render error, not a broken-image fallback, for anything outside this
 * list). Venue photos get scraped from arbitrary business websites, so any
 * host outside this allowlist has to be filtered out here rather than
 * crashing the whole page; found via a live 500 on a Brighton venue whose
 * photo lived on the venue's own site.
 */
const ALLOWED_IMAGE_HOSTS = [
  'images.unsplash.com',
  'ssl.gstatic.com',
  'lh3.googleusercontent.com',
  'maps.googleapis.com',
]

function isAllowedImageHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return ALLOWED_IMAGE_HOSTS.includes(hostname) || hostname.endsWith('.googleusercontent.com')
  } catch {
    return false
  }
}

/** True if `url` is a real, directly-renderable photo (not empty, not a known-dead/placeholder pattern, and on a host next/image is configured for). */
export function isUsablePhotoUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed || trimmed.toLowerCase() === 'nan') return false
  if (!/^https?:\/\//i.test(trimmed)) return false
  if (!isAllowedImageHost(trimmed)) return false
  return !UNRENDERABLE_PHOTO_PATTERNS.some((p) => p.test(trimmed))
}

// Size options on a Google photo URL, e.g. `=w92-h92-k-no` or `=s400`.
const GOOGLE_PHOTO_SIZE = /=(?:[wh]\d+(?:-[wh]\d+)*|s\d+)(?:-[a-z0-9-]+)?$/i

/**
 * The URL to display a venue photo from. Scraped Google place photos are stored at Google's
 * 92px thumbnail size (`=w92-h92-k-no`), which looks blurry on any card or banner; Google serves
 * the same photo at any size if the suffix changes, so ask for a large one and let next/image
 * scale it down for each screen. Other URLs are returned unchanged.
 */
export function displayPhotoUrl(url: string): string {
  try {
    if (!new URL(url).hostname.endsWith('googleusercontent.com')) return url
  } catch {
    return url
  }
  return GOOGLE_PHOTO_SIZE.test(url) ? url.replace(GOOGLE_PHOTO_SIZE, '=s1200-k-no') : url
}

/**
 * Generates a shimmer SVG as a base64-encoded blur placeholder for next/image.
 * Use as: blurDataURL={shimmerDataURL(700, 475)} placeholder="blur"
 */
export function shimmerDataURL(w: number, h: number): string {
  const svg = `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#e2e8f0" offset="20%" />
      <stop stop-color="#f1f5f9" offset="50%" />
      <stop stop-color="#e2e8f0" offset="70%" />
    </linearGradient>
    <filter id="f">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)" />
</svg>`
  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}
