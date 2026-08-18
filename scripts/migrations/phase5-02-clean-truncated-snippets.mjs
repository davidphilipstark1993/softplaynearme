// Priority 5 — cleans review_snippet values corrupted by the old
// extractReviewSnippet() (import-raw-city-csvs.mjs), which unconditionally
// appended a "." to whatever raw fragment was scraped, fabricating a
// sentence ending that was never actually written ("Great soft play for
// the."). Fixed at the source in that script; this retroactively cleans
// what's already stored.
//
// Splits each snippet into sentences and checks the LAST one: if it ends
// with a stopword/preposition immediately before the final period (a strong
// tell that the period was appended mid-clause, not written by the
// reviewer), that trailing sentence is dropped. If nothing sentence-worthy
// remains, the whole snippet is nulled rather than left half-broken —
// matches the brief's "drop any snippet that can't be cleanly terminated".
//
//   node scripts/migrations/phase5-02-clean-truncated-snippets.mjs [--execute]

import { EXECUTE, getPool, runBatched } from './_lib.mjs'

// Words that (almost) never legitimately end a complete English sentence —
// deliberately restricted to determiners, coordinating conjunctions, degree
// adverbs, and exactly two prepositions ("for", "by") that essentially
// never strand without an object in casual review text. Most other
// prepositions strand constantly in common idioms — "choose from.", "taken
// care of.", "creative with.", "nice to be in." — and including them (or
// pronouns/copulas like "it"/"was"/"all"/"too") wrongly nulled genuinely
// complete reviews; each was tested against real data in this table before
// being excluded.
const DANGLING_TAIL = /^(a|an|the|by|for|and|but|or|nor|very|so|really)$/i

// Manual scan rather than String.match(/…/g): a regex with a lookahead that
// can fail mid-string causes .match() to silently DROP the unmatched
// prefix instead of keeping it (confirmed: "Amazing value... £4.50 per
// baby..." lost everything before "50" because the lookahead failed at the
// decimal point and the engine just moved its start position forward).
// Scanning char-by-char guarantees every character ends up in some sentence.
function splitSentences(text) {
  const sentences = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (!'.!?'.includes(text[i])) continue
    // Don't treat a period as terminal when it's a decimal point or a
    // scrape-artifact mid-word period (e.g. "4.50", "to.do") — only when
    // followed by whitespace + a capital letter, or end of string.
    const rest = text.slice(i + 1)
    const boundary = /^\s+[A-Z]/.test(rest) || rest.trim() === ''
    if (!boundary) continue
    sentences.push(text.slice(start, i + 1).trim())
    start = i + 1
  }
  if (start < text.length) sentences.push(text.slice(start).trim())
  return sentences.filter(Boolean)
}

function isDanglingSentence(sentence) {
  const withoutPunct = sentence.replace(/[.!?]+$/, '').trim()
  const words = withoutPunct.split(/\s+/)
  const lastWord = (words[words.length - 1] || '').replace(/[^a-zA-Z']/g, '')
  return DANGLING_TAIL.test(lastWord)
}

function cleanSnippet(raw) {
  const sentences = splitSentences(raw)
  while (sentences.length && isDanglingSentence(sentences[sentences.length - 1])) {
    sentences.pop()
  }
  const cleaned = sentences.join(' ').trim()
  return cleaned.length >= 10 ? cleaned : null
}

const pool = await getPool()
try {
  const { rows } = await pool.query(
    `SELECT id, name, review_snippet FROM venues
     WHERE review_snippet IS NOT NULL AND review_snippet != ''
       AND review_snippet NOT LIKE '%Information verified from the venue website%'`
  )

  const changes = []
  for (const v of rows) {
    const cleaned = cleanSnippet(v.review_snippet)
    if (cleaned !== v.review_snippet.trim()) {
      changes.push({ id: v.id, name: v.name, before: v.review_snippet, after: cleaned })
    }
  }

  console.log(`${rows.length} venues have a review_snippet; ${changes.length} need cleaning.`)
  console.log(`  -> ${changes.filter((c) => c.after === null).length} will be nulled entirely (no clean sentence survives)`)
  console.log(`  -> ${changes.filter((c) => c.after !== null).length} will be truncated to their last complete sentence`)
  console.log(EXECUTE ? '\nEXECUTING' : '\nDRY RUN')

  await runBatched(changes, async (c) => {
    console.log(`  ${EXECUTE ? 'CLEAN' : 'would CLEAN'} id=${c.id} "${c.name}"`)
    console.log(`    before: ${JSON.stringify(c.before)}`)
    console.log(`    after:  ${JSON.stringify(c.after)}`)
    if (EXECUTE) {
      await pool.query('UPDATE venues SET review_snippet = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [c.after, c.id])
    }
    return 'ok'
  })
} finally {
  await pool.end()
}
