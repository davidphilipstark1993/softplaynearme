#!/usr/bin/env node
// Scans the public copy (city intros/FAQs, blog posts, curated venue notes,
// generated-copy templates) for internal / editorial notes that leaked into text
// readers see, and for filler calls to action ("check the venue", "confirm on the
// official site") that say nothing. Writes a CSV; changes nothing.
//
// Categories
//   editor_note    internal process or instruction ("do not rely on…", "we do not invent…",
//                  "fact-check", "NEEDS SOURCE", TODO/FIXME) — fix these
//   filler_cta     a generic "check/confirm with the venue" with no information in it
//   data_disclosure an honest statement about what our data holds ("in our data", "we don't hold…") —
//                  reported for your judgement, not necessarily wrong
//
// Usage: node scripts/find-leaked-notes.mjs [--out=reports/leaked-notes.csv]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = path.resolve(ROOT, process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? 'reports/leaked-notes.csv')

const SOURCES = [
  'data/cities.json',
  'lib/blogPosts.ts',
  'data/hullCuratedVenues.ts',
  'lib/locationContent.ts',
  'lib/filterContent.ts',
  'lib/venueContent.ts',
  'app/page.tsx',
]

const RULES = [
  { category: 'editor_note', re: /do not rely on[^.\n"']*/gi },
  { category: 'editor_note', re: /third-party figures?/gi },
  { category: 'editor_note', re: /we do not invent[^.\n"']*/gi },
  { category: 'editor_note', re: /(?:our )?local fact-?check(?:ing)? work[^.\n"']*/gi },
  { category: 'editor_note', re: /fact[- ]?check(?:er|ed)?\b/gi },
  { category: 'editor_note', re: /\bNEEDS SOURCE\b|\bTODO\b|\bFIXME\b|\bTBD\b|lorem ipsum/g },
  { category: 'editor_note', re: /Publisher APPROVED|Fact Checker PASS/gi },
  { category: 'filler_cta', re: /check the venue\b[^.\n"']*/gi },
  { category: 'filler_cta', re: /check with the venue\b[^.\n"']*/gi },
  { category: 'filler_cta', re: /(?:always )?confirm (?:prices|hours|current|on the (?:official|venue|hull)|with the (?:venue|centre))[^.\n"']*/gi },
  { category: 'filler_cta', re: /confirm on (?:the )?(?:official|venue|their)[^.\n"']*/gi },
  { category: 'filler_cta', re: /see the venue page for[^.\n"']*/gi },
  { category: 'filler_cta', re: /check the (?:hull|venue) page for[^.\n"']*/gi },
  { category: 'data_disclosure', re: /\b(?:in|from) our data\b[^.\n"']*/gi },
  { category: 'data_disclosure', re: /we (?:don'?t|do not) hold[^.\n"']*/gi },
]

const csvCell = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const rows = []
for (const rel of SOURCES) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    // Code comments are for developers, not readers — only scan lines that can render.
    if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) return
    for (const { category, re } of RULES) {
      re.lastIndex = 0
      for (const m of line.matchAll(re)) {
        const start = Math.max(0, m.index - 50)
        rows.push({
          category,
          file: rel,
          line: i + 1,
          matched: m[0].trim().slice(0, 120),
          context: line.slice(start, m.index + m[0].length + 50).replace(/\s+/g, ' ').trim(),
        })
      }
    }
  })
}

// de-duplicate rules that matched the same text on the same line
const seen = new Set()
const unique = rows.filter((r) => {
  const key = `${r.file}:${r.line}:${r.matched.toLowerCase()}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
const order = { editor_note: 0, filler_cta: 1, data_disclosure: 2 }
unique.sort((a, b) => order[a.category] - order[b.category] || a.file.localeCompare(b.file) || a.line - b.line)

const columns = ['category', 'file', 'line', 'matched', 'context']
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, [columns.join(','), ...unique.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n')

const tally = unique.reduce((m, r) => ((m[r.category] = (m[r.category] ?? 0) + 1), m), {})
console.log(`Scanned ${SOURCES.length} files; ${unique.length} matches written to ${path.relative(ROOT, outPath)}:`, tally)
