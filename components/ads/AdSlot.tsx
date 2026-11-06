'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AdCard } from './AdCard'
import { PLACEMENTS, type PlacementKey } from '@/lib/ads/placements'
import type { PublicAd } from '@/lib/ads/types'

// One fetch per placement+city per page load, however many slots ask for it.
const requests = new Map<string, Promise<PublicAd[]>>()
// Ads currently on screen, so two slots on one page prefer different adverts.
const shown = new Set<number>()

function fetchAds(placement: string, city?: string): Promise<PublicAd[]> {
  const key = `${placement}|${city ?? ''}`
  let p = requests.get(key)
  if (!p) {
    const qs = new URLSearchParams({ placement })
    if (city) qs.set('city', city)
    p = fetch(`/api/ads?${qs}`)
      .then((r) => (r.ok ? r.json() : { ads: [] }))
      .then((d) => (Array.isArray(d.ads) ? (d.ads as PublicAd[]) : []))
      .catch(() => [])
    requests.set(key, p)
  }
  return p
}

/** Highest priority wins; equal priorities rotate randomly. Prefers adverts not already shown. */
function pick(ads: PublicAd[]): PublicAd | null {
  if (ads.length === 0) return null
  const fresh = ads.filter((a) => !shown.has(a.id))
  const pool = fresh.length ? fresh : ads
  const top = Math.max(...pool.map((a) => a.priority))
  const best = pool.filter((a) => a.priority === top)
  return best[Math.floor(Math.random() * best.length)]
}

const VISIBLE_RATIO = 0.5 // at least half the advert on screen…
const VISIBLE_MS = 1000 //   …for a full second, with the tab in the foreground

function sendImpression(adId: number, placement: string, path: string) {
  const body = JSON.stringify({ adId, placement, path })
  try {
    if (navigator.sendBeacon?.('/api/ads/track', new Blob([body], { type: 'application/json' }))) return
  } catch {}
  fetch('/api/ads/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
}

/**
 * Renders nothing until an eligible advert is found, so a page with no active
 * adverts is byte-for-byte unchanged for the visitor. Place slots below the
 * fold / at the end of content — never above or inside search results.
 */
export function AdSlot({
  placement,
  city,
  className,
}: {
  placement: PlacementKey
  /** City slug, for adverts targeted at particular cities. */
  city?: string
  className?: string
}) {
  const [ad, setAd] = useState<PublicAd | null>(null)
  const rootRef = useRef<HTMLElement | null>(null)
  const pathname = usePathname()
  const variant = PLACEMENTS.find((p) => p.key === placement)?.variant ?? 'banner'

  useEffect(() => {
    let cancelled = false
    let claimed: number | null = null
    fetchAds(placement, city).then((ads) => {
      if (cancelled) return
      const chosen = pick(ads)
      if (chosen) {
        claimed = chosen.id
        shown.add(chosen.id)
      }
      setAd(chosen)
    })
    return () => {
      cancelled = true
      if (claimed !== null) shown.delete(claimed)
    }
  }, [placement, city])

  // Impression = genuinely seen, counted once per advert+placement per browser session.
  useEffect(() => {
    const el = rootRef.current
    if (!ad || !el || typeof IntersectionObserver === 'undefined') return

    const storageKey = `ad-imp:${ad.id}:${placement}`
    try {
      if (sessionStorage.getItem(storageKey)) return
    } catch {}

    let timer: ReturnType<typeof setTimeout> | null = null
    let visible = false
    let done = false

    const clear = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }
    const arm = () => {
      clear()
      if (done || !visible || document.visibilityState !== 'visible') return
      timer = setTimeout(() => {
        done = true
        try {
          sessionStorage.setItem(storageKey, '1')
        } catch {}
        sendImpression(ad.id, placement, pathname)
        io.disconnect()
      }, VISIBLE_MS)
    }

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1].intersectionRatio >= VISIBLE_RATIO
        arm()
      },
      { threshold: [0, VISIBLE_RATIO, 1] }
    )
    io.observe(el)
    document.addEventListener('visibilitychange', arm)

    return () => {
      clear()
      io.disconnect()
      document.removeEventListener('visibilitychange', arm)
    }
  }, [ad, placement, pathname])

  if (!ad) return null

  return (
    <div data-ad-placement={placement} className={className}>
      <AdCard ad={ad} variant={variant} rootRef={rootRef} />
    </div>
  )
}
