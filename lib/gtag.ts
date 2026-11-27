/** Fire a GA4 event if gtag is loaded (no-op otherwise). */
export function gtagEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  ;(window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', name, params)
}

const FULL_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/i

/**
 * What a search box sends to analytics: a full UK postcode is cut to its outward
 * code (HU5 3AB → HU5), anything else is trimmed, lower-cased and capped at 60
 * characters. Keeps search reports useful without storing a near-address.
 */
export function searchTermForAnalytics(input: string): string {
  const t = input.trim()
  const m = t.match(FULL_POSTCODE)
  if (m) return m[1].toUpperCase()
  return t.toLowerCase().slice(0, 60)
}
