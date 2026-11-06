import { getPool } from '@/lib/pool'
import { ALL_PLACEMENTS } from './placements'
import { withUtm } from './utm'
import type { AdminAd, AdStatus, AdvertiserType, PublicAd } from './types'

/** Rows are only ever served when active, inside their date window, and on this placement. */
const ELIGIBLE_SQL = `
  status = 'active'
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now())
`

interface AdRow {
  id: number
  title: string
  description: string
  cta_text: string
  destination_url: string
  image_url: string | null
  image_alt: string
  advertiser_name: string
  advertiser_type: AdvertiserType
  utm_campaign: string
  status: AdStatus
  starts_at: Date | null
  ends_at: Date | null
  priority: number
  placements: string[]
  city_slugs: string[]
  created_at: Date
  updated_at: Date
  impressions_30d?: string | number
  clicks_30d?: string | number
}

export async function getActiveAds(placement: string, city: string | null): Promise<PublicAd[]> {
  const pool = getPool()
  const { rows } = await pool.query<AdRow>(
    `SELECT id, title, description, cta_text, image_url, image_alt, advertiser_type, priority
       FROM ads
      WHERE ${ELIGIBLE_SQL}
        AND image_url IS NOT NULL
        AND placements && ARRAY[$1, '${ALL_PLACEMENTS}']::text[]
        AND (cardinality(city_slugs) = 0 OR ($2::text IS NOT NULL AND $2 = ANY(city_slugs)))
      ORDER BY priority DESC, id ASC
      LIMIT 10`,
    [placement, city]
  )
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    ctaText: r.cta_text,
    imageUrl: r.image_url as string,
    imageAlt: r.image_alt,
    label: r.advertiser_type === 'sponsor' ? 'Sponsored' : 'More from us',
    sponsored: r.advertiser_type === 'sponsor',
    priority: r.priority,
    href: `/api/ads/${r.id}/click?p=${encodeURIComponent(placement)}`,
  }))
}

function liveState(r: AdRow): AdminAd['liveState'] {
  if (r.status === 'archived') return 'archived'
  if (r.status === 'draft') return 'paused'
  const now = Date.now()
  if (r.starts_at && r.starts_at.getTime() > now) return 'scheduled'
  if (r.ends_at && r.ends_at.getTime() <= now) return 'expired'
  return 'live'
}

export function toAdminAd(r: AdRow): AdminAd {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    ctaText: r.cta_text,
    destinationUrl: r.destination_url,
    imageUrl: r.image_url,
    imageAlt: r.image_alt,
    advertiserName: r.advertiser_name,
    advertiserType: r.advertiser_type,
    utmCampaign: r.utm_campaign,
    status: r.status,
    startsAt: r.starts_at ? r.starts_at.toISOString() : null,
    endsAt: r.ends_at ? r.ends_at.toISOString() : null,
    priority: r.priority,
    placements: r.placements,
    citySlugs: r.city_slugs,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    liveState: liveState(r),
    impressions30d: Number(r.impressions_30d ?? 0),
    clicks30d: Number(r.clicks_30d ?? 0),
  }
}

export async function listAdsForAdmin(): Promise<AdminAd[]> {
  const { rows } = await getPool().query<AdRow>(
    `SELECT a.*,
            COALESCE(e.imp, 0) AS impressions_30d,
            COALESCE(e.clk, 0) AS clicks_30d
       FROM ads a
       LEFT JOIN (
         SELECT ad_id,
                count(*) FILTER (WHERE event_type = 'impression') AS imp,
                count(*) FILTER (WHERE event_type = 'click')      AS clk
           FROM ad_events
          WHERE created_at >= now() - interval '30 days'
          GROUP BY ad_id
       ) e ON e.ad_id = a.id
      ORDER BY (a.status = 'archived'), a.priority DESC, a.id DESC`
  )
  return rows.map(toAdminAd)
}

export async function getAdById(id: number): Promise<AdRow | null> {
  const { rows } = await getPool().query<AdRow>(`SELECT * FROM ads WHERE id = $1`, [id])
  return rows[0] ?? null
}

export function buildDestination(ad: AdRow, placement: string): string {
  return withUtm(ad.destination_url, {
    placement,
    campaign: ad.utm_campaign,
    title: ad.title,
    advertiserType: ad.advertiser_type,
  })
}

export async function recordAdEvent(
  adId: number,
  placement: string,
  type: 'impression' | 'click',
  path: string | null
): Promise<void> {
  await getPool().query(
    `INSERT INTO ad_events (ad_id, placement, event_type, page_path) VALUES ($1, $2, $3, $4)`,
    [adId, placement, type, path ? path.slice(0, 300) : null]
  )
}
