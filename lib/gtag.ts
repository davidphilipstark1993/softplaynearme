/** Fire a GA4 event if gtag is loaded (no-op otherwise). */
export function gtagEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  ;(window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', name, params)
}
