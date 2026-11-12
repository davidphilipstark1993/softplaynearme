// JS mirror of scripts/sql/hull-area-2026-11-12/03-hull-area-claim-wave.sql, so the recipient rules can be
// tested against a fixture without a database. Keep the two in step: if one changes, change the other.
//
// Rules: active · unclaimed · visible type (indoor / pub / none) · a well-formed public email
// (contact_email, falling back to email — never lead_notification_email) · not a placeholder domain ·
// not on the recent-outreach list · has coordinates · within RADIUS miles of the centre OR an HU postcode.

export const HULL_CENTRE = { lat: 53.7457, lng: -0.3367 }
export const RADIUS_MILES = 20
const EARTH_MILES = 3958.7613
const EMAIL_OK = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/
const PLACEHOLDER_DOMAINS = ['mysite.com', 'example.com', 'email.com']
export const RECENT_OUTREACH = [
  'info@uklittlerascals.com',
  'info@gigglesplayandadventure.co.uk',
  'geoplayltdwales@gmail.com',
  'customerservice@wonderworldgroup.co.uk',
]

export function distanceMiles(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const c = Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng) - rad(a.lng)) + Math.sin(rad(a.lat)) * Math.sin(rad(b.lat))
  return Math.round(EARTH_MILES * Math.acos(Math.min(1, Math.max(-1, c))) * 100) / 100
}

export function publicEmail(v) {
  const pick = (x) => (x ?? '').trim()
  return (pick(v.contact_email) || pick(v.email)).toLowerCase()
}

export function selectAreaWave(rows, { centre = HULL_CENTRE, radius = RADIUS_MILES, recent = RECENT_OUTREACH } = {}) {
  const out = []
  for (const v of rows) {
    if (!v.is_active || v.claimed_by_owner) continue
    if (v.venue_type != null && !['indoor', 'pub'].includes(v.venue_type)) continue
    const email = publicEmail(v)
    if (!email || !EMAIL_OK.test(email)) continue
    if (PLACEHOLDER_DOMAINS.some((d) => email.endsWith(`@${d}`))) continue
    if (recent.includes(email)) continue
    const lat = Number(v.lat), lng = Number(v.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || v.lat == null || v.lng == null) continue
    const distance = distanceMiles(centre, { lat, lng })
    const huPostcode = /^HU[0-9]/.test((v.postcode ?? '').toUpperCase().replace(/\s+/g, ''))
    if (distance <= radius || huPostcode) out.push({ ...v, email, distance_miles: distance, listing_url: `https://www.softplaynearme.co.uk/soft-play/${v.city_slug}/${v.slug}` })
  }
  return out.sort((a, b) => a.distance_miles - b.distance_miles || a.name.localeCompare(b.name))
}
