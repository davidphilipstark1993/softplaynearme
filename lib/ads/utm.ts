export const UTM_SOURCE = 'softplaynearme'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/**
 * Appends UTM parameters identifying Soft Play Near Me as the traffic source.
 * Any utm_* the destination URL already carries is left alone, so an advertiser
 * who supplies their own tagging keeps it.
 */
export function withUtm(
  destination: string,
  opts: { placement: string; campaign?: string | null; title: string; advertiserType: string }
): string {
  let url: URL
  try {
    url = new URL(destination)
  } catch {
    return destination
  }
  const params: Record<string, string> = {
    utm_source: UTM_SOURCE,
    utm_medium: opts.advertiserType === 'sponsor' ? 'sponsored' : 'cross_promo',
    utm_campaign: opts.campaign?.trim() || slugify(opts.title) || 'advert',
    utm_content: opts.placement,
  }
  for (const [key, value] of Object.entries(params)) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value)
  }
  return url.toString()
}
