'use client'

import { useEffect } from 'react'

/**
 * Fires the GA4 `purchase` event once per Checkout Session. Guarded by
 * sessionStorage so refreshing or coming back to this URL doesn't double-count
 * the same subscription — gtag itself has no dedup for client-fired events.
 */
export function PurchaseTracking({ sessionId, value, interval }: { sessionId?: string; value: number; interval: 'month' | 'year' }) {
  useEffect(() => {
    if (!sessionId) return
    const key = `ga4_purchase_${sessionId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // sessionStorage unavailable (private mode etc.) — fire anyway, worst case a dup event
    }
    ;(window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', 'purchase', {
      transaction_id: sessionId,
      currency: 'GBP',
      value,
      items: [{ item_name: `Premium subscription (${interval}ly)`, price: value, quantity: 1 }],
    })
  }, [sessionId, value, interval])

  return null
}
