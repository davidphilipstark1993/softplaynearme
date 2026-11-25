// Render-time clean-up of generated venue text (lib/venueCopy.ts).
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = process.features.typescript !== false && Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'

test('description: filler sentences go, facts stay, Google quote is attributed', { skip }, async () => {
  const { cleanVenueDescription } = await import('../lib/venueCopy.ts')
  const d = `Set in Leicester, Leicestershire, Rascal Ranch is a soft play centre built around supervised indoor play for children. Well reviewed and popular — a fixture for local family days out.

On Google, Rascal Ranch is rated 4.2 from 324 reviews. Great softplay , clean, fun, and very well managed.

Weekday visits to Rascal Ranch tend to be quieter than weekends — worth bearing in mind if you're after a calmer session.`
  assert.equal(
    cleanVenueDescription(d, 'Great softplay , clean, fun, and very well managed.'),
    'On Google, Rascal Ranch is rated 4.2 from 324 reviews. One Google reviewer wrote: “Great softplay, clean, fun, and very well managed.”',
  )
})

test('description: the generator lead-in before a quote is replaced, "vs." does not split', { skip }, async () => {
  const { cleanVenueDescription } = await import('../lib/venueCopy.ts')
  assert.equal(
    cleanVenueDescription('The venue is rated 4.2 from 18 reviews.\n\nA visitor summed it up: Way cleaner, way lighter.', 'Way cleaner, way lighter.'),
    'The venue is rated 4.2 from 18 reviews.\n\nOne Google reviewer wrote: “Way cleaner, way lighter.”',
  )
  assert.equal(cleanVenueDescription("X's session structure (timed slots vs. open play) is worth confirming ahead of a visit, since this varies venue to venue."), '')
})

test('description: hand-written text passes through untouched', { skip }, async () => {
  const { cleanVenueDescription } = await import('../lib/venueCopy.ts')
  const d = 'Level Up has a main play frame and a sensory toddler zone for ages 0–3. Sessions last 90 minutes.'
  assert.equal(cleanVenueDescription(d), d)
  assert.equal(cleanVenueDescription(null), '')
})

test('tips: the five sitewide tips are removed, specific ones kept and renumbered', { skip }, async () => {
  const { cleanVenueTips } = await import('../lib/venueCopy.ts')
  const generic = `1. Most soft play centres require socks for children (and often adults) — worth packing a spare pair just in case.
2. Bring a snack bag and a water bottle as the café situation varies — call ahead if refreshments are important.
3. Check parking options near 9 Trevanth Rd before you travel — street parking availability varies.
4. Weekend and school holiday sessions fill up quickly at popular venues — check if pre-booking is available.
5. Weekday mornings (especially Tuesday–Thursday, 9–11am) are typically the quietest and calmest times to visit.`
  assert.equal(cleanVenueTips(generic), '')
  assert.equal(cleanVenueTips(generic + "\n6. If you have a child with additional needs, call ahead to ask about SEN session schedules.\n7. Toddler mornings run on Tuesdays."),
    "1. If you have a child with additional needs, call ahead to ask about SEN session schedules.\n2. Toddler mornings run on Tuesdays.")
})

test('what to expect: "children of all ages" alone and the stock rating line are dropped', { skip }, async () => {
  const { cleanWhatToExpect } = await import('../lib/venueCopy.ts')
  assert.deepEqual(cleanWhatToExpect('Best for: children of all ages. Consistently well-rated by local families, X is a reliable choice for a soft play outing in Y.'), { audiences: [], body: '' })
  assert.deepEqual(cleanWhatToExpect('Best for: children of all ages, birthday party groups. The venue caters for birthday parties with dedicated party areas.'),
    { audiences: ['children of all ages', 'birthday party groups'], body: 'The venue caters for birthday parties with dedicated party areas.' })
})

test('description: every generator review lead-in is replaced by one attribution', { skip }, async () => {
  const { cleanVenueDescription } = await import('../lib/venueCopy.ts')
  for (const lead of ['One recurring theme in visitor feedback:', 'Parents visiting Lets Go Bonkers report:', 'A visitor summed it up: The venue also offers wheelchair access.']) {
    const out = cleanVenueDescription(`It's rated 4.2 from 724 reviews.\n\n${lead} Big and colourful.`, 'Big and colourful.')
    assert.ok(!/summed it up|recurring theme|report:/.test(out), out)
    assert.match(out, /One Google reviewer wrote: “Big and colourful\.”$/)
  }
})
