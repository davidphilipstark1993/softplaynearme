'use client'

import { useEffect } from 'react'

const GA_ID = 'G-LELV01QR3Z'
const ADSENSE_CLIENT = 'ca-pub-1521157758368352'

// Fallback for visitors who never scroll, tap or type: load anyway after this long.
const IDLE_FALLBACK_MS = 6000
const INTERACTION_EVENTS = ['scroll', 'pointerdown', 'touchstart', 'keydown', 'mousemove'] as const

function addScript(src: string, crossOrigin?: string) {
  const s = document.createElement('script')
  s.src = src
  s.async = true
  if (crossOrigin) s.crossOrigin = crossOrigin
  document.head.appendChild(s)
}

/**
 * Loads Google Analytics (gtag.js) and AdSense Auto ads after the visitor first interacts with
 * the page, or after IDLE_FALLBACK_MS, instead of during page load. On phones these two scripts
 * blocked the main thread for ~750ms before the page could respond to taps.
 *
 * Nothing is lost by waiting: the inline gtag() stub in app/layout.tsx queues the page view and
 * any click events in window.dataLayer, and gtag.js sends them once it arrives.
 */
export function DeferredThirdParty() {
  useEffect(() => {
    let loaded = false
    const load = () => {
      if (loaded) return
      loaded = true
      cleanup()
      addScript(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`)
      addScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`, 'anonymous')
    }
    const timer = window.setTimeout(load, IDLE_FALLBACK_MS)
    const cleanup = () => {
      window.clearTimeout(timer)
      for (const e of INTERACTION_EVENTS) window.removeEventListener(e, load)
    }
    for (const e of INTERACTION_EVENTS) window.addEventListener(e, load, { once: true, passive: true })
    return cleanup
  }, [])

  return null
}
