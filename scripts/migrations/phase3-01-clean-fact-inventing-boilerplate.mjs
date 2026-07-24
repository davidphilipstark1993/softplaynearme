// Strips fact-inventing boilerplate sentences that scripts/enrich-seo-all.mjs
// wrote into `description`, `tips_before_visiting`, and `what_to_expect` for
// every venue on a prior --commit run — sock-policy claims asserted as fact
// for a specific venue we have no such data for, and pure-filler sentences
// with no real information. The template functions themselves are already
// fixed (see git history on that file); this cleans up what's already
// stored in the DB from before that fix.
//
// Matches on the fixed (non-interpolated) portion of each known template
// sentence, so it's robust to the venue name/city that got interpolated in.
// Only strips the offending sentence(s), leaves the rest of the field
// intact — this is surgical removal, not a rewrite.
// See reports/data-quality-audit.md Phase 3.
//
//   node scripts/migrations/phase3-01-clean-fact-inventing-boilerplate.mjs [--execute]

import { EXECUTE, getPool, runBatched } from './_lib.mjs'

// Each pattern matches one full sentence (including its trailing space) so
// removal doesn't leave a double-space or orphaned punctuation behind.
const BOILERPLATE_PATTERNS = [
  /Socks are required for all children and adults entering the play frame\.\s*/gi,
  /Soft-soled socks are required throughout the play area\.\s*/gi,
  /Children will need socks, so keep a spare pair in the bag\.\s*/gi,
  /Socks are mandatory in all play areas\.\s*/gi,
  /Grip socks are recommended for the play areas\.\s*/gi,
  /The play frame is designed to entertain children across a range of ages and abilities\.\s*/gi,
  // tips_before_visiting — old tip #1 (numbered "1. ...")
  /1\.\s*Pack socks — grip socks are ideal and required for all play areas\.\n?/gi,
]

// what_to_expect — old generic no-rating fallback sentence. Matches from
// the preceding sentence boundary (consumes the period before it too, so
// replaced with '.' not ' ') so multi-word venue names ("Adventure Land")
// aren't partially eaten — [^.]*? stops at the first period.
const TRAILING_FALLBACK_SENTENCE =
  /\.?\s*[A-Z][^.]*? provides a dedicated indoor play environment in [^.]+ for children to stay active and entertained\.\s*$/gi

function clean(text) {
  if (!text) return text
  let out = text
  for (const pattern of BOILERPLATE_PATTERNS) {
    out = out.replace(pattern, ' ')
  }
  out = out.replace(TRAILING_FALLBACK_SENTENCE, '.')
  // Ball pit assumption in tips — replace with a fact-free equivalent rather than deleting the tip
  out = out.replace(
    /Bring a change of clothes for younger children — soft play can get messy, especially in the ball pit\./gi,
    'Bring a change of clothes for younger children — soft play sessions can get messy.'
  )
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/\.\s*\./g, '.').trim()
}

const pool = await getPool()
try {
  let rows
  try {
    ;({ rows } = await pool.query(
      `SELECT id, name, description, tips_before_visiting, what_to_expect FROM venues
       WHERE description ~* 'socks are (required|mandatory)|soft-soled socks|play frame is designed'
          OR tips_before_visiting ~* 'Pack socks — grip socks is ideal|especially in the ball pit'
          OR what_to_expect ~* 'provides a dedicated indoor play environment in .+ for children to stay active'`
    ))
  } catch (e) {
    console.error('DB unreachable:', e.message)
    process.exit(1)
  }
  console.log(`Found ${rows.length} venues with fact-inventing boilerplate to clean.`)
  console.log(EXECUTE ? 'EXECUTING — this will UPDATE description/tips_before_visiting/what_to_expect.' : 'DRY RUN — no changes will be made.')

  // If cleaning leaves only stray punctuation/whitespace, treat as empty —
  // omit the field rather than store a lone "."
  const normalize = (s) => (s && /^[\s.]*$/.test(s) ? null : s)

  await runBatched(rows, async (v) => {
    const cleaned = {
      description: normalize(clean(v.description)),
      tips_before_visiting: normalize(clean(v.tips_before_visiting)),
      what_to_expect: normalize(clean(v.what_to_expect)),
    }
    const changed = Object.keys(cleaned).filter((k) => cleaned[k] !== v[k])
    if (!changed.length) {
      console.log(`  SKIP  id=${v.id} "${v.name}" — nothing changed after cleaning (pattern matched but no textual diff)`)
      return 'skipped'
    }
    console.log(`  ${EXECUTE ? 'UPDATE' : 'would UPDATE'}  id=${v.id} "${v.name}" — cleaned fields: ${changed.join(', ')}`)
    if (EXECUTE) {
      await pool.query(
        `UPDATE venues SET description = $1, tips_before_visiting = $2, what_to_expect = $3 WHERE id = $4`,
        [cleaned.description, cleaned.tips_before_visiting, cleaned.what_to_expect, v.id]
      )
    }
  })
} finally {
  await pool.end()
}
