// Build an owner-outreach CSV for one or more hubs (Prompt B, Nov 2026 pilot).
//
//   node scripts/outreach/pilot-outreach-list.mjs --hubs=worthing,brighton --out="<path>.csv"
//
// Read-only on the DB. For each soft play venue on the hubs (venue_type indoor/pub, active,
// main list and nearby towns alike) it writes our page, claim link, website, phone, Google
// rating, which facts we're missing, and a contact email found on the venue's own site.
//
// Email finding is polite: at most 1 request per second, an honest user agent, robots.txt is
// fetched and respected, and only the homepage plus one contact/parties page are read. Only
// addresses that appear on the site (mailto links or visible text) and sit on the venue's own
// domain or a webmail domain are kept; nothing is guessed.
//
// Output contains contact details: write it outside the (public) repo.
import fs from 'node:fs'
import { getPool } from '../migrations/_lib.mjs'

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const HUBS = (arg('hubs') ?? 'worthing,brighton').split(',')
const OUT = arg('out')
if (!OUT) throw new Error('--out=<file.csv> required (outside the repo: it holds contact details)')
const BASE = 'https://www.softplaynearme.co.uk'
const UA = 'SoftPlayNearMeBot/1.0 (+https://www.softplaynearme.co.uk/about; listing verification)'
const WEBMAIL = /@(gmail|googlemail|hotmail|outlook|live|yahoo|ymail|icloud|me|aol|btinternet|sky|talktalk|virginmedia|ntlworld|protonmail)\.(com|co\.uk|net)$/i
const JUNK = /(example|domain|email|yourname|sentry|wixpress|godaddy|\.png|\.jpg|\.gif|\.webp|@2x|noreply|no-reply)/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let last = 0
async function politeFetch(url) {
  const wait = 1000 - (Date.now() - last)
  if (wait > 0) await sleep(wait)
  last = Date.now()
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,text/plain' }, redirect: 'follow', signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? ''
    if (!/text\/html|text\/plain/.test(type)) return null
    return { url: res.url, text: (await res.text()).slice(0, 2_000_000) }
  } catch {
    return null
  }
}

/**
 * robots.txt check for our UA (or *): the longest matching Allow/Disallow rule wins, with
 * Google-style wildcards ("*" = anything, trailing "$" = end of path).
 */
export function robotsAllows(robots, path) {
  if (!robots) return true
  const groups = []
  let current = null
  let lastWasAgent = false
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    if (key === 'user-agent') {
      if (!lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current) }
      current.agents.push(val.toLowerCase())
      lastWasAgent = true
    } else if (current) {
      lastWasAgent = false
      if (val) current.rules.push({ allow: key === 'allow', pattern: val })
    }
  }
  const ours = groups.filter((g) => g.agents.some((a) => a.includes('softplaynearme')))
  const rules = (ours.length ? ours : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules)
  let best = null
  for (const r of rules) {
    const re = new RegExp('^' + r.pattern.replace(/[.+?^${}()|[\]\\]/g, (c) => (c === '$' ? c : '\\' + c)).replace(/\*/g, '.*').replace(/\\\$$/, '$'))
    if (re.test(path) && (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow))) best = r
  }
  return !best || best.allow
}

const registrable = (host) => {
  const l = host.toLowerCase().replace(/^www\./, '').split('.')
  return ['co', 'org', 'me', 'ltd', 'plc', 'net'].includes(l.at(-2)) && l.at(-1) === 'uk' ? l.slice(-3).join('.') : l.slice(-2).join('.')
}

function emailsIn(html, siteHost) {
  const found = new Set()
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) found.add(decodeURIComponent(m[1]).toLowerCase())
  const visible = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&#64;|&commat;/g, '@')
  for (const m of visible.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) found.add(m[0].toLowerCase())
  const site = registrable(siteHost)
  return [...found].filter((e) => !JUNK.test(e) && (registrable(e.split('@')[1]) === site || WEBMAIL.test(e)))
}

async function findEmail(website) {
  let base
  try { base = new URL(/^https?:\/\//.test(website) ? website : `https://${website}`) } catch { return { email: '', source: '', note: 'bad website url' } }
  if (/facebook\.com|instagram\.com|simplybook|bookwhen|linktr\.ee/.test(base.hostname)) return { email: '', source: '', note: 'website is a social/booking page' }
  const robots = (await politeFetch(`${base.origin}/robots.txt`))?.text ?? ''
  const pages = []
  if (robotsAllows(robots, base.pathname || '/')) {
    const home = await politeFetch(base.href)
    if (home) {
      pages.push(home)
      // One more page: the most relevant contact/parties link on the homepage.
      const links = [...home.text.matchAll(/href="([^"#]+)"[^>]*>([\s\S]{0,80}?)<\/a>/gi)]
        .map(([, href, label]) => ({ href, label: label.replace(/<[^>]+>/g, ' ').toLowerCase() }))
        .filter((l) => /contact|get in touch|parties|party|book/.test(`${l.href} ${l.label}`))
      const best = links.find((l) => /contact/.test(`${l.href} ${l.label}`)) ?? links[0]
      if (best) {
        try {
          const u = new URL(best.href, home.url)
          if (registrable(u.hostname) === registrable(base.hostname) && robotsAllows(robots, u.pathname)) {
            const p = await politeFetch(u.href)
            if (p) pages.push(p)
          }
        } catch { /* ignore bad link */ }
      }
    }
  } else {
    return { email: '', source: '', note: 'robots.txt disallows' }
  }
  for (const p of pages) {
    const found = emailsIn(p.text, base.hostname)
    const own = found.find((e) => !WEBMAIL.test(e)) ?? found[0]
    if (own) return { email: own, source: p.url, note: '' }
  }
  return { email: '', source: '', note: pages.length ? 'no email on site' : 'site unreachable' }
}

const pool = await getPool()
const { rows } = await pool.query(
  `SELECT v.id, v.name, v.slug, v.city_slug, v.website, v.phone, v.rating, v.reviews_count, v.price_from, v.price_range,
          v.age_range_min, v.age_ranges, v.opening_hours, v.opening_hours_text, v.sen_friendly, v.has_sen_sessions,
          v.toddler_area, v.parties, v.party_info, v.main_image_url, v.photo_urls, v.claimed_by_owner, v.contact_email,
          (SELECT count(*) FROM venue_photos p WHERE p.venue_id = v.id) AS photo_count
     FROM venues v
    WHERE v.city_slug = ANY($1) AND v.is_active = true AND (v.venue_type IS NULL OR v.venue_type IN ('indoor','pub'))
    ORDER BY v.city_slug, v.name`,
  [HUBS]
).catch(async () => pool.query(
  `SELECT v.*, 0 AS photo_count FROM venues v
    WHERE v.city_slug = ANY($1) AND v.is_active = true AND (v.venue_type IS NULL OR v.venue_type IN ('indoor','pub'))
    ORDER BY v.city_slug, v.name`, [HUBS]))
await pool.end()

const hasHours = (v) => {
  const oh = v.opening_hours
  if (oh && typeof oh === 'object' && (Array.isArray(oh.weekday_text) || Object.keys(oh).some((k) => /day$/.test(k)))) return true
  return !!String(v.opening_hours_text ?? '').trim()
}
const out = []
for (const v of rows) {
  const missing = []
  if (!(Number(v.price_from) > 0) && !String(v.price_range ?? '').trim()) missing.push('prices')
  if (v.age_range_min == null && !(v.age_ranges ?? []).length) missing.push('age range')
  if (!hasHours(v)) missing.push('hours')
  if (!v.sen_friendly && !v.has_sen_sessions) missing.push('SEN sessions')
  if (!v.toddler_area) missing.push('toddler sessions')
  if (!v.parties && !String(v.party_info ?? '').trim()) missing.push('party info')
  const photos = Number(v.photo_count) + (Array.isArray(v.photo_urls) ? v.photo_urls.length : 0) + (v.main_image_url ? 1 : 0)
  if (!photos) missing.push('photos')
  const web = String(v.website ?? '').trim()
  const contact = web && !/^(https?:\/\/)?(nan|none|null)\/?$/i.test(web) ? await findEmail(web) : { email: '', source: '', note: 'no website' }
  const onFile = String(v.contact_email ?? '').trim().toLowerCase()
  process.stderr.write(`${v.name}: ${contact.email || contact.note}\n`)
  out.push({
    venue_name: v.name,
    hub: v.city_slug,
    venue_url: `${BASE}/soft-play/${v.city_slug}/${v.slug}`,
    claim_url: `${BASE}/claim/${v.city_slug}/${v.slug}`,
    already_claimed: v.claimed_by_owner ? 'yes' : '',
    website: web,
    phone: v.phone ?? '',
    google_rating: v.rating ?? '',
    review_count: v.reviews_count ?? '',
    missing_fields: missing.join('; '),
    contact_email: contact.email,
    email_source: contact.source,
    email_note: contact.note,
    // Found by an earlier scan of the venue's site (scripts/extract-contact-emails.mjs), not today's.
    email_on_file: onFile && onFile !== contact.email ? onFile : '',
    entity_type: '',
    contact_name: '',
    status: '',
    notes: '',
    views_last_30d: '',
    clicks_last_30d: '',
  })
}
const cols = Object.keys(out[0] ?? { venue_name: '' })
const esc = (x) => (/[",\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x))
fs.writeFileSync(OUT, [cols.join(','), ...out.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n')
const withEmail = out.filter((r) => r.contact_email || r.email_on_file).length
const phoneOnly = out.filter((r) => !r.contact_email && !r.email_on_file && r.phone).length
console.log(JSON.stringify({ venues: out.length, with_email: withEmail, phone_only: phoneOnly, neither: out.length - withEmail - phoneOnly, already_claimed: out.filter((r) => r.already_claimed).length, out: OUT }))
