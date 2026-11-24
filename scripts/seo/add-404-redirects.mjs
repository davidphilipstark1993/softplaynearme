#!/usr/bin/env node
/**
 * Adds 301s to data/redirects.json for 404 URLs that have a genuine replacement:
 * the same venue (matched by Google place id, name+postcode, or name within the same
 * hub — see scripts/seo/resolve-404s.mjs) now living at another URL, plus a short
 * hand-checked list of renamed blog posts. URLs with no replacement are left as 404.
 *
 * Dry run by default; --write updates data/redirects.json.
 * Usage: node scripts/seo/add-404-redirects.mjs [--in=seo-data/phase1/404-resolution.csv] [--write]
 */
import fs from 'node:fs'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v = true] = a.replace(/^--/, '').split('='); return [k, v] }))
const inFile = args.in ?? 'seo-data/phase1/404-resolution.csv'

// Blog posts removed on 14 Feb 2026 (commit 14db23c), each with a page on the same topic
// today. soft-play-birthday-party-checklist has none and stays 404.
const BLOG = [
  ['/blog/rainy-day-kids-activities-hull', '/blog/rainy-day-activities-hull'],
  ['/blog/best-soft-play-manchester', '/soft-play/manchester'],
  ['/blog/toddler-soft-play-leeds', '/soft-play/leeds/toddler'],
  ['/blog/sensory-soft-play-yorkshire', '/blog/sen-friendly-soft-play-uk'],
]

const parseCsv = (text) => {
  const [head, ...lines] = text.trim().split('\n')
  const cols = JSON.parse(`[${head.split(',').map((c) => JSON.stringify(c)).join(',')}]`)
  return lines.map((l) => Object.fromEntries(JSON.parse(`[${l}]`).map((v, i) => [cols[i], v])))
}
const rows = parseCsv(fs.readFileSync(inFile, 'utf8'))
const venueMoves = rows
  .filter((r) => r.match && r.match !== 'blog' && r.replacement && r.replacementLive === true)
  .map((r) => [r.path, r.replacement])

const existing = JSON.parse(fs.readFileSync('data/redirects.json', 'utf8'))
const have = new Set(existing.map((e) => e.source))
const add = [...venueMoves, ...BLOG].filter(([s]) => !have.has(s))
console.log(`venue moves ${venueMoves.length}, blog ${BLOG.length}, new entries ${add.length}`)
for (const [s, d] of add.slice(0, 8)) console.log(`  ${s} -> ${d}`)
if (args.write) {
  fs.writeFileSync('data/redirects.json', JSON.stringify([...existing, ...add.map(([source, destination]) => ({ source, destination, permanent: true }))], null, 2) + '\n')
  console.log('data/redirects.json updated')
} else console.log('(dry run: pass --write to update data/redirects.json)')
