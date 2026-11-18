'use client'

import Link from 'next/link'
import { gtagEvent } from '@/lib/gtag'

/** A link to the claim page that records claim_cta_click (with where on the page it was). */
export function ClaimCta({ citySlug, slug, placement, className, children }: { citySlug: string; slug: string; placement: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/claim/${citySlug}/${slug}`}
      className={className}
      onClick={() => gtagEvent('claim_cta_click', { city_slug: citySlug, venue_slug: slug, placement })}
    >
      {children}
    </Link>
  )
}
