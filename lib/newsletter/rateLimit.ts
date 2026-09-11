// In-memory sliding-window limiter for the public subscribe endpoint. Good enough to blunt
// naive scripted abuse from a single IP on a warm serverless instance; it resets on cold start
// and isn't shared across instances, so it's a courtesy layer, not the primary defence — the
// email upsert-by-address in lib/newsletter/db.ts is what actually prevents duplicate rows.
const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS = 8

const hits = new Map<string, number[]>()

export function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)

  // Occasionally sweep so the map doesn't grow unbounded across a long-lived instance.
  if (hits.size > 5000) {
    for (const [key, timestamps] of hits) {
      if (timestamps.every((t) => now - t >= WINDOW_MS)) hits.delete(key)
    }
  }

  return recent.length > MAX_REQUESTS
}

export function getClientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
}
