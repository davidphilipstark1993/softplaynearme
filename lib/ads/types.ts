export type AdStatus = 'draft' | 'active' | 'archived'
export type AdvertiserType = 'house' | 'sponsor'

/** What the public site is allowed to see. The destination URL is deliberately absent. */
export interface PublicAd {
  id: number
  title: string
  description: string
  ctaText: string
  imageUrl: string
  imageAlt: string
  /** "More from us" for own sites, "Sponsored" for paid third parties. */
  label: string
  sponsored: boolean
  priority: number
  /** Click-tracking redirect for this placement. */
  href: string
}

export interface AdminAd {
  id: number
  title: string
  description: string
  ctaText: string
  destinationUrl: string
  imageUrl: string | null
  imageAlt: string
  advertiserName: string
  advertiserType: AdvertiserType
  utmCampaign: string
  status: AdStatus
  startsAt: string | null
  endsAt: string | null
  priority: number
  placements: string[]
  citySlugs: string[]
  createdAt: string
  updatedAt: string
  /** Derived server-side from status + dates. */
  liveState: 'live' | 'scheduled' | 'expired' | 'paused' | 'archived'
  impressions30d: number
  clicks30d: number
}
