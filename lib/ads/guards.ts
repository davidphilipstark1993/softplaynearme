// Pure helpers (no Next.js imports) so they can be unit-tested directly.

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|monitor|curl|wget|python-requests|node-fetch/i

/** Crawlers and uptime monitors must not inflate impressions or clicks. */
export function isBotUserAgent(ua: string | null): boolean {
  return !ua || BOT_UA.test(ua)
}

const buckets = new Map<string, { count: number; resetAt: number }>()

/** Best-effort per-instance limiter; enough to stop a trivial loop from flooding ad_events. */
export function rateLimit(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = buckets.get(key)
  if (!entry || now > entry.resetAt) {
    if (buckets.size > 5000) buckets.clear()
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

/** Only same-site relative paths are stored as the page an event happened on. */
export function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null
  return value.split('?')[0].slice(0, 300)
}
