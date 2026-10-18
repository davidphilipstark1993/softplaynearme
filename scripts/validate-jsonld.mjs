#!/usr/bin/env node
// Fetches pages and checks their JSON-LD: it must parse, carry the properties
// search engines need, and agree with what is visible on the page. A local
// stand-in for "does the Rich Results Test like this?" — run it against a local
// `next start` or the live site after deploying (the Rich Results Test is still the
// authority; this catches the common breakages early and runs in CI).
//
// Usage:
//   node scripts/validate-jsonld.mjs [--base=http://localhost:3000] /soft-play/hull /soft-play/hull/big-fun /
//   node scripts/validate-jsonld.mjs --base=https://www.softplaynearme.co.uk /soft-play/hull

const args = process.argv.slice(2)
const base = (args.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://localhost:3000').replace(/\/$/, '')
const paths = args.filter((a) => !a.startsWith('--'))
if (!paths.length) {
  console.error('Give at least one path, e.g. /soft-play/hull')
  process.exit(2)
}

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const visibleText = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<!--.*?-->/gs, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ')

let failures = 0
const problems = []
const fail = (path, msg) => {
  failures++
  problems.push(`  ✗ ${path}: ${msg}`)
}

function checkNode(path, node, text, ctx) {
  const types = [].concat(node['@type'] ?? [])
  if (!types.length) return fail(path, 'a JSON-LD node has no @type')
  for (const type of types) {
    ctx.seen.add(type)
    switch (type) {
      case 'BreadcrumbList': {
        const items = node.itemListElement ?? []
        if (!items.length) fail(path, 'BreadcrumbList is empty')
        items.forEach((it, i) => {
          if (it.position !== i + 1) fail(path, `breadcrumb position ${it.position} at index ${i}`)
          if (!it.name) fail(path, `breadcrumb ${i + 1} has no name`)
          if (i < items.length - 1 && !it.item) fail(path, `breadcrumb "${it.name}" is not the last item but has no item URL`)
        })
        break
      }
      case 'FAQPage': {
        const qs = node.mainEntity ?? []
        if (qs.length < 1) fail(path, 'FAQPage has no questions')
        for (const q of qs) {
          if (q['@type'] !== 'Question' || !q.name || !q.acceptedAnswer?.text) fail(path, `malformed Question "${q.name}"`)
          else if (!text.includes(q.name.replace(/\s+/g, ' ').trim())) fail(path, `FAQ question not visible on the page: "${q.name}"`)
        }
        ctx.faqCount = qs.length
        break
      }
      case 'ItemList': {
        const items = node.itemListElement ?? []
        if (!items.length) fail(path, 'ItemList is empty')
        items.forEach((it, i) => {
          if (!it.url || !it.name) fail(path, `ListItem ${i + 1} needs both url and name`)
          if (typeof it.position !== 'number') fail(path, `ListItem ${i + 1} has no numeric position`)
          if (it.url && !String(it.url).startsWith('https://www.softplaynearme.co.uk/')) fail(path, `ListItem url not absolute on the site: ${it.url}`)
          if (it.item?.aggregateRating) fail(path, `ListItem ${i + 1} carries aggregateRating (ratings belong on the venue page)`)
        })
        const positions = items.map((i) => i.position)
        if (new Set(positions).size !== positions.length) fail(path, 'duplicate ListItem positions')
        break
      }
      case 'EntertainmentBusiness':
      case 'LocalBusiness':
      case 'SportsActivityLocation':
      case 'TouristAttraction':
      case 'Park': {
        if (!node.name) fail(path, `${type} has no name`)
        if (!node.address || node.address.addressCountry !== 'GB') fail(path, `${type} address missing or no addressCountry`)
        if (node.address?.postalCode === '') fail(path, 'empty postalCode')
        if (node.geo && (typeof node.geo.latitude !== 'number' || typeof node.geo.longitude !== 'number')) fail(path, 'geo latitude/longitude must be numbers')
        if (node.telephone && !text.replace(/\s/g, '').includes(String(node.telephone).replace(/\s/g, ''))) fail(path, `telephone ${node.telephone} not visible on the page`)
        if (node.openingHoursSpecification?.length) {
          for (const h of node.openingHoursSpecification) if (!/^\d\d:\d\d$/.test(h.opens) || !/^\d\d:\d\d$/.test(h.closes)) fail(path, `bad opening hours ${h.opens}-${h.closes}`)
        }
        if (node.aggregateRating) {
          const r = node.aggregateRating
          if (!(Number(r.ratingValue) >= 1 && Number(r.ratingValue) <= 5) || !(Number(r.reviewCount) > 0)) fail(path, 'invalid aggregateRating')
          if (!text.includes(Number(r.ratingValue).toFixed(1))) fail(path, `aggregateRating ${r.ratingValue} is not shown on the page`)
          if (!Array.isArray(node.review) || !node.review.length) fail(path, 'aggregateRating without on-page first-party reviews')
        }
        ctx.business = node
        break
      }
      case 'WebSite':
        if (!node.potentialAction || node.potentialAction['@type'] !== 'SearchAction' || !String(node.potentialAction.target?.urlTemplate ?? '').includes('{search_term_string}')) fail(path, 'WebSite SearchAction malformed')
        break
      case 'Organization':
        if (!node.name || !node.url) fail(path, 'Organization needs name and url')
        break
      default:
        break
    }
  }
}

for (const p of paths) {
  const res = await fetch(base + p, { redirect: 'follow' })
  if (!res.ok) {
    fail(p, `HTTP ${res.status}`)
    continue
  }
  const html = await res.text()
  const text = visibleText(html)
  const ctx = { seen: new Set() }
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  if (!blocks.length) fail(p, 'no JSON-LD found')
  for (const raw of blocks) {
    let data
    try {
      data = JSON.parse(raw)
    } catch (e) {
      fail(p, `JSON-LD does not parse: ${e.message}`)
      continue
    }
    for (const node of Array.isArray(data) ? data : data['@graph'] ?? [data]) {
      if (node['@context'] !== 'https://schema.org') fail(p, `@context is ${node['@context']}`)
      checkNode(p, node, text, ctx)
    }
  }
  if (/\/soft-play\/[^/]+$/.test(p)) {
    for (const need of ['BreadcrumbList', 'FAQPage', 'ItemList']) if (!ctx.seen.has(need)) fail(p, `city page is missing ${need}`)
    if (ctx.faqCount < 4 || ctx.faqCount > 6) fail(p, `city page FAQ should have 4-6 questions, has ${ctx.faqCount}`)
  }
  if (/\/soft-play\/[^/]+\/[^/]+$/.test(p) && !/\/(toddler|birthday-parties|sen-friendly|open-now)$/.test(p)) {
    if (!ctx.business) fail(p, 'venue page has no business entity')
    if (!ctx.seen.has('BreadcrumbList')) fail(p, 'venue page is missing BreadcrumbList')
  }
  if (p === '/') {
    for (const need of ['Organization', 'WebSite']) if (!ctx.seen.has(need)) fail(p, `homepage is missing ${need}`)
  }
  if (/<meta name="keywords"/.test(html)) fail(p, 'meta keywords tag present')
  // <meta name="next-size-adjust"> is emitted by Next.js itself for any page using next/font; not removable by config in Next 16 (see the SEO report).
  if (args.includes('--strict-next-meta') && /<meta name="next-size-adjust"/.test(html)) fail(p, 'empty next-size-adjust meta tag present')
  console.log(`${p}: ${[...ctx.seen].join(', ') || '—'}`)
}

if (failures) {
  console.error(`\n${failures} problem(s):\n${problems.join('\n')}`)
  process.exit(1)
}
console.log('\nAll JSON-LD checks passed.')
