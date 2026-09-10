import type { Newsletter, NewsletterItem } from './types'

const BASE_URL = 'https://www.softplaynearme.co.uk'

function esc(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function itemUrl(item: NewsletterItem): string | null {
  if (item.item_type === 'venue' && item.venue_slug && item.city_slug) {
    return `${BASE_URL}/soft-play/${item.city_slug}/${item.venue_slug}`
  }
  return item.url || null
}

function renderCard(item: NewsletterItem): string {
  const url = itemUrl(item)
  const dateLine = item.event_date
    ? `<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:0.04em">${esc(formatEventDate(item.event_date))}</p>`
    : ''
  const image = item.image_url
    ? `<img src="${esc(item.image_url)}" alt="${esc(item.title)}" width="100%" style="display:block;width:100%;height:auto;border-radius:10px 10px 0 0;object-fit:cover;max-height:180px" />`
    : ''
  const cta = url
    ? `<a href="${esc(url)}" style="display:inline-block;margin-top:10px;color:#7c3aed;font-weight:600;font-size:13px;text-decoration:none">${item.item_type === 'venue' ? 'View venue' : 'Find out more'} &#x2192;</a>`
    : ''

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:14px;overflow:hidden">
    <tr><td>
      ${image}
      <div style="padding:16px 18px">
        ${dateLine}
        <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1e293b">${esc(item.title)}</p>
        ${item.description ? `<p style="margin:0;font-size:14px;line-height:1.55;color:#475569">${esc(item.description)}</p>` : ''}
        ${cta}
      </div>
    </td></tr>
  </table>`
}

const SECTION_META: Record<NewsletterItem['item_type'], { heading: string; emoji: string }> = {
  venue: { heading: 'Featured soft play venues', emoji: '&#x1F3AA;' },
  event: { heading: 'Family events & activities', emoji: '&#x1F388;' },
  offer: { heading: 'Offers & discounts', emoji: '&#x1F4B7;' },
  news: { heading: 'Venue news', emoji: '&#x1F4F0;' },
  link: { heading: 'Useful for your week ahead', emoji: '&#x1F517;' },
}

const SECTION_ORDER: NewsletterItem['item_type'][] = ['venue', 'event', 'offer', 'news', 'link']

export interface RenderNewsletterOptions {
  newsletter: Newsletter
  items: NewsletterItem[]
  /**
   * Real URLs for a preview or a single-recipient send. For a batched
   * campaign send (lib/newsletter/sendgrid.ts), pass the literal SendGrid
   * substitution tags ('-unsub_url-' / '-pref_url-') instead — the HTML is
   * rendered once and shared across the whole batch, with SendGrid
   * substituting each recipient's own values per-personalization.
   */
  unsubscribeUrl: string
  preferencesUrl: string
}

export function renderNewsletterHtml(opts: RenderNewsletterOptions): string {
  const { newsletter, items, unsubscribeUrl, preferencesUrl } = opts
  const scope = newsletter.type === 'weekly' ? 'the weekly newsletter' : 'family events & offers'

  const bannerTitle =
    newsletter.type === 'weekly' ? "This week's family guide" : 'Family events & offers'

  const sections = SECTION_ORDER.map((type) => {
    const sectionItems = items.filter((i) => i.item_type === type)
    if (sectionItems.length === 0) return ''
    const meta = SECTION_META[type]
    return `
    <tr><td style="padding-top:8px">
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#0f172a">${meta.emoji}&nbsp; ${esc(meta.heading)}</p>
      ${sectionItems.map(renderCard).join('')}
    </td></tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(newsletter.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:600px;margin:0 auto;padding:20px 12px">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#9333ea 0%,#ec4899 100%);border-radius:16px;margin-bottom:20px">
    <tr><td style="padding:32px 28px;text-align:center">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.08em">Soft Play Near Me</p>
      <p style="margin:0;font-size:24px;font-weight:800;color:#fff;line-height:1.3">${esc(newsletter.subject) || esc(bannerTitle)}</p>
    </td></tr>
  </table>

  ${
    newsletter.intro_html
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px"><tr><td style="font-size:15px;line-height:1.6;color:#334155">${newsletter.intro_html}</td></tr></table>`
      : ''
  }

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${sections}
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
    <tr><td style="text-align:center;padding:20px 8px">
      <a href="${BASE_URL}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:13px 28px;border-radius:9px;font-weight:600;font-size:14px">
        Find more soft play near you &#x2192;
      </a>
    </td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid #e2e8f0;padding-top:18px">
    <tr><td style="text-align:center">
      <p style="font-size:12px;color:#94a3b8;margin:0 0 6px">
        You're receiving this because you subscribed to ${scope} at softplaynearme.co.uk.
      </p>
      <p style="font-size:12px;margin:0">
        <a href="${unsubscribeUrl}" style="color:#7c3aed">Unsubscribe from this list</a>
        &nbsp;&middot;&nbsp;
        <a href="${preferencesUrl}" style="color:#7c3aed">Manage preferences</a>
      </p>
      <p style="font-size:11px;color:#cbd5e1;margin:10px 0 0">Soft Play Near Me &middot; UK's Largest Soft Play Directory</p>
    </td></tr>
  </table>

</div>
</body>
</html>`
}

export function renderNewsletterPlainText(opts: RenderNewsletterOptions): string {
  const { newsletter, items, unsubscribeUrl, preferencesUrl } = opts
  const parts: string[] = [newsletter.subject, '']

  if (newsletter.intro_html) {
    parts.push(newsletter.intro_html.replace(/<[^>]+>/g, ''), '')
  }

  for (const type of SECTION_ORDER) {
    const sectionItems = items.filter((i) => i.item_type === type)
    if (sectionItems.length === 0) continue
    parts.push(SECTION_META[type].heading.toUpperCase(), '')
    for (const item of sectionItems) {
      parts.push(item.title)
      if (item.event_date) parts.push(formatEventDate(item.event_date))
      if (item.description) parts.push(item.description)
      const url = itemUrl(item)
      if (url) parts.push(`More info: ${url}`)
      parts.push('')
    }
  }

  parts.push(`Find more soft play near you: ${BASE_URL}`, '')
  parts.push(`— Soft Play Near Me (${BASE_URL})`)
  parts.push(`Unsubscribe: ${unsubscribeUrl}`)
  parts.push(`Manage preferences: ${preferencesUrl}`)

  return parts.join('\n')
}
