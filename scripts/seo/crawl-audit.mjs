#!/usr/bin/env node
/**
 * Phase 1 crawl audit: fetches every path in the URL inventory
 * (scripts/seo/url-inventory.mjs) from production and records what Google would see.
 * Read-only. Redirects are followed by hand so chains and loops are visible.
 *
 * Per URL: status, redirect chain + final status, x-robots-tag, meta robots,
 * canonical, title, first H1, and a rough visible word count.
 *
 * Usage: node scripts/seo/crawl-audit.mjs [--in=seo-data/phase1/url-inventory.json]
 *        [--out=seo-data/phase1/crawl.json] [--concurrency=6] [--only=sitemap,gsc]
 */
import fs from 'node:fs'

const SITE = 'https://www.softplaynearme.co.uk'
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v = true] = a.replace(/^--/, '').split('='); return [k, v] }))
const inFile = args.in ?? 'seo-data/phase1/url-inventory.json'
const outFile = args.out ?? 'seo-data/phase1/crawl.json'
const conc = Number(args.concurrency ?? 6)
let items = JSON.parse(fs.readFileSync(inFile, 'utf8'))
if (args.only) {
  const only = args.only.split(',')
  items = items.filter((i) => i.sources.some((s) => only.includes(s)))
}

const UA = 'Mozilla/5.0 (compatible; spnm-seo-audit/1.0)'
const decode = (s) => s?.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

function parseHtml(html) {
  const head = html.slice(0, html.indexOf('</head>') + 7 || 200000)
  const metaRobots = [...head.matchAll(/<meta[^>]+name="robots"[^>]*>/g)].map((m) => m[0].match(/content="([^"]*)"/)?.[1]).filter(Boolean)
  const canonical = head.match(/<link[^>]+rel="canonical"[^>]*>/)?.[0].match(/href="([^"]*)"/)?.[1] ?? null
  const title = decode(head.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? null)
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')))
  // Words inside <main> (falls back to <body>), scripts removed: a rough measure of
  // the page's own text, without the site-wide header and footer.
  const start = html.indexOf('<main') >= 0 ? html.indexOf('<main') : html.indexOf('<body')
  const end = html.indexOf('</main>') >= 0 ? html.indexOf('</main>') : html.length
  let words = 0
  for (const chunk of html.slice(start, end).split(/<script\b|<\/script>/).filter((_, i) => i % 2 === 0)) {
    for (const w of chunk.replace(/<[^>]*>/g, ' ').split(/\s+/)) if (/[a-z]/i.test(w)) words++
  }
  const jsonLdTypes = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    try {
      const j = JSON.parse(m[1])
      const list = Array.isArray(j) ? j : j['@graph'] ?? [j]
      return list.map((x) => [].concat(x['@type']).join('+'))
    } catch { return ['INVALID'] }
  })
  return { metaRobots: metaRobots.join(' | ') || null, canonical, title, h1: h1s[0] ?? null, h1Count: h1s.length, words, jsonLdTypes }
}

async function get(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })
    } catch (e) {
      if (attempt >= 2) throw e
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

async function audit(item) {
  const chain = []
  let url = SITE + item.path
  let res
  for (let hop = 0; hop < 6; hop++) {
    res = await get(url)
    if (res.status >= 300 && res.status < 400) {
      const loc = new URL(res.headers.get('location'), url).toString()
      chain.push({ status: res.status, to: loc })
      await res.body?.cancel()
      if (chain.filter((c) => c.to === loc).length > 1) break
      url = loc
      continue
    }
    break
  }
  const row = { ...item, status: chain[0]?.status ?? res.status, finalUrl: url, finalStatus: res.status, hops: chain.length, chain: chain.map((c) => `${c.status}>${c.to.replace(SITE, '')}`), xRobots: res.headers.get('x-robots-tag') }
  if ((res.headers.get('content-type') ?? '').includes('text/html')) Object.assign(row, parseHtml(await res.text()))
  else await res.body?.cancel()
  return row
}

const results = []
const jsonl = fs.createWriteStream(outFile.replace(/\.json$/, '.jsonl'))
let i = 0, done = 0
await Promise.all(Array.from({ length: conc }, async () => {
  while (i < items.length) {
    const item = items[i++]
    let row
    try { row = await audit(item) } catch (e) { row = { ...item, error: String(e) } }
    results.push(row)
    jsonl.write(JSON.stringify(row) + '\n')
    if (++done % 250 === 0) console.error(`${done}/${items.length}`)
  }
}))
results.sort((a, b) => a.path.localeCompare(b.path))
fs.writeFileSync(outFile, JSON.stringify(results, null, 1))
jsonl.end()
console.log(`${results.length} URLs -> ${outFile}`)
