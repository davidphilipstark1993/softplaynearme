/**
 * Render-time sanitization for scraped venue fields. Defense-in-depth
 * against the same leaked-Google-status / literal-"nan" corruption pattern
 * fixed in bulk by scripts/migrations/phase2-06-clean-corrupted-addresses.mjs
 * — this catches anything a future import reintroduces, since the DB is
 * still fed by scripts (import-raw-city-csvs.mjs, scrape-cities.mjs) that
 * don't currently validate on the way in.
 */

const STATUS_ONLY_SEGMENT = /^(closed|open|open now|open 24 hours|opens?\s+\d.*|closes?\s+\d.*|nan|null|none)$/i

/** Strips leaked status text, literal "nan"/"null"/"None", and stray "·" separators. */
export function cleanAddressForDisplay(address?: string | null): string | null {
  if (!address) return null
  const kept = address
    .split(',')
    .map((seg) => seg.replace(/·/g, '').trim())
    .filter((seg) => seg && !STATUS_ONLY_SEGMENT.test(seg))
  const result = kept.join(', ').trim()
  return result.length > 0 ? result : null
}

export function hasValidAddress(address?: string | null): boolean {
  return cleanAddressForDisplay(address) !== null
}

export function isValidPostcode(postcode?: string | null): boolean {
  if (!postcode) return false
  return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(postcode.trim())
}

/** Combined "street, POSTCODE" line for display — omits either part if invalid, and returns null if nothing usable remains. */
export function formatAddressLine(address?: string | null, postcode?: string | null): string | null {
  const cleanAddr = cleanAddressForDisplay(address)
  const validPostcode = isValidPostcode(postcode) ? postcode!.trim() : null
  const parts = [cleanAddr, validPostcode].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}
