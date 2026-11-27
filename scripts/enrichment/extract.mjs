// Fact extraction from a venue's own web page text (Phase 2D, 27 Nov 2026).
//
// Pure functions, no I/O: given the visible text of one page and its URL, propose fact
// candidates, each with the sentence that supports it. Candidates go to the review queue
// (venue_fact_candidates); nothing here decides what is live.
//
// Deliberately narrow: a candidate needs a specific phrase ("toddler area", "SEN session",
// "£6.50 per child"), never a lone word. The previous scraper matched "park", "food",
// "accessible" and "sen" anywhere on the page, which is how "parking" and "SEN-friendly"
// ended up on venues that never said so.

/** Visible text from HTML: scripts/styles/nav/footer dropped, entities decoded, one line per block. */
export function pageText(html) {
  return String(html || '')
    .replace(/<(script|style|noscript|svg|nav|footer|header)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|td|dd|dt)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&pound;/g, '£').replace(/&#163;/g, '£')
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&#8217;/g, '’').replace(/&ndash;|&#8211;/g, '–').replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
}

/** Sentences (and short lines such as price-list rows), trimmed for use as evidence. */
export function sentences(text) {
  return String(text || '')
    .split('\n')
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z£0-9])/))
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && s.length <= 400)
}

const RULES = [
  { field: 'toddler_area', value: true, re: /\b(toddler|under[- ]?[2345]s?'?|pre-?school(er)?s?'?|little ones'?)\s+(area|zone|section|play ?area|room|corner)\b/i },
  { field: 'baby_area', value: true, re: /\b(baby|babies'?|under[- ]?1s?'?|crawlers'?)\s+(area|zone|section|play ?area|room|corner)\b/i },
  { field: 'has_sen_sessions', value: true, re: /\b(SEN|SEND|sensory|autism[- ]friendly|additional needs|quiet|relaxed)\s+(play\s+)?sessions?\b/ },
  { field: 'parties', value: true, re: /\b(birthday part(y|ies)|party packages?|book (a|your) party|parties? (are|is) available)\b/i },
  { field: 'has_party_rooms', value: true, re: /\b(private |dedicated |themed )?party rooms?\b/i },
  { field: 'cafe', value: true, re: /\b(our|on-?site|the|a|licensed)\s+(caf[eé]|coffee shop|kitchen serving)\b|\bcaf[eé] (serves|serving|offers|menu)\b/i },
  { field: 'free_parking', value: true, re: /\bfree (on-?site )?(car )?parking\b|\bparking is free\b/i },
  { field: 'parking', value: true, re: /\b(on-?site|our own|free|large|dedicated) (car park|parking)\b|\bcar park (is )?(available|on site)\b/i },
  { field: 'has_soft_play', value: true, re: /\bsoft[- ]?play\b/i },
]

/** "aged 0–8", "for children up to 10", "0-12 years", "under 11s" -> { min, max }. */
export function ageRange(s) {
  let m = s.match(/\b(?:aged?|ages|for children(?: aged)?|suitable for)\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years?|yrs?)?\b/i)
    ?? s.match(/\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years?|yrs?)(?:\s*old)?\b/i)
  if (m) {
    const min = Number(m[1]), max = Number(m[2])
    if (min < max && max <= 16) return { min, max }
  }
  m = s.match(/\b(?:children|kids)\s+(?:up to|under)\s+(?:the age of\s+)?(\d{1,2})\b/i) ?? s.match(/\bup to (?:the )?age (?:of )?(\d{1,2})\b/i)
  if (m) {
    const max = Number(m[1]) - (/under/i.test(m[0]) ? 1 : 0)
    if (max >= 2 && max <= 16) return { min: 0, max }
  }
  return null
}

/** Lowest per-child entry price in a sentence that is about entry, not parties/food/adults. */
export function childPrice(s) {
  if (!/\b(child|children|kids?|per child|entry|admission|session|off-?peak|peak|play)\b/i.test(s)) return null
  if (/\b(party|parties|per head|adult|grown-?up|coffee|tea|food|menu|meal|sock|membership|annual|voucher|deposit)\b/i.test(s)) return null
  const prices = [...s.matchAll(/£\s?(\d{1,2}(?:\.\d{2})?)\b/g)].map((m) => Number(m[1])).filter((n) => n >= 1 && n <= 25)
  return prices.length ? Math.min(...prices) : null
}

/**
 * Candidates for one page: [{ field, value, evidence, source_url }]. One per field (the
 * first supporting sentence). Fields the venue already has confirmed can be passed in
 * `known` to skip them.
 */
export function extractFacts(text, sourceUrl, known = {}) {
  const out = new Map()
  for (const s of sentences(text)) {
    for (const r of RULES) {
      if (known[r.field] || out.has(r.field)) continue
      if (r.re.test(s)) out.set(r.field, { field: r.field, value: r.value, evidence: s, source_url: sourceUrl })
    }
    if (!known.age_range && !out.has('age_range')) {
      const a = ageRange(s)
      if (a) out.set('age_range', { field: 'age_range', value: a, evidence: s, source_url: sourceUrl })
    }
    if (!known.price_from && !out.has('price_from')) {
      const p = childPrice(s)
      if (p != null) out.set('price_from', { field: 'price_from', value: p, evidence: s, source_url: sourceUrl })
    }
  }
  // free parking implies parking: keep the stronger one only
  if (out.has('free_parking')) out.delete('parking')
  return [...out.values()]
}

/** Same-site links worth a second fetch (prices, parties, SEN, about, FAQ), max `limit`. */
export function interestingLinks(html, baseUrl, limit = 3) {
  const base = new URL(baseUrl)
  const seen = new Set()
  const out = []
  for (const m of String(html || '').matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u
    try { u = new URL(m[1], base) } catch { continue }
    if (u.host !== base.host || !/^https?:$/.test(u.protocol)) continue
    const label = `${u.pathname} ${m[2].replace(/<[^>]+>/g, ' ')}`.toLowerCase()
    if (!/(price|pricing|admission|entry|ticket|part(y|ies)|birthday|sen\b|send|sensory|autism|additional|about|faq|info|visit)/.test(label)) continue
    if (/\.(pdf|jpe?g|png|gif|docx?)$/i.test(u.pathname)) continue
    u.hash = ''
    const key = u.toString()
    if (seen.has(key) || key === base.toString()) continue
    seen.add(key)
    out.push(key)
    if (out.length >= limit) break
  }
  return out
}

/** robots.txt: is `path` disallowed for user-agent `*` (or ours)? Minimal parser. */
export function robotsDisallows(robotsTxt, path, agent = 'SoftPlayDirectoryBot') {
  const groups = []
  let cur = null
  for (const raw of String(robotsTxt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i)
    if (!m) continue
    const k = m[1].toLowerCase(), v = m[2].trim()
    if (k === 'user-agent') {
      if (!cur || cur.rules.length) groups.push((cur = { agents: [], rules: [] }))
      cur.agents.push(v.toLowerCase())
    } else if (cur) cur.rules.push({ allow: k === 'allow', path: v })
  }
  const mine = groups.filter((g) => g.agents.includes(agent.toLowerCase()))
  const rules = (mine.length ? mine : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules)
  let best = null
  for (const r of rules) {
    if (!r.path) continue
    if (path.startsWith(r.path) && (!best || r.path.length > best.path.length)) best = r
  }
  return !!best && !best.allow
}
