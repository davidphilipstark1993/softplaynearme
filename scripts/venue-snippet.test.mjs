// Venue <title>, meta description, Quick facts and schema hours (lib/venueSnippet.ts).
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = process.features.typescript !== false && Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'
const load = () => import('../lib/venueSnippet.ts')

const GOOGLE_DAILY = 'Monday: 9:30 AM – 6:00 PM; Tuesday: 9:30 AM – 6:00 PM; Wednesday: 9:30 AM – 6:00 PM; Thursday: 9:30 AM – 6:00 PM; Friday: 9:30 AM – 6:00 PM; Saturday: 9:30 AM – 6:00 PM; Sunday: 9:30 AM – 6:00 PM'

test('names: notes, straplines and shouting removed; real names left alone', { skip }, async () => {
  const { cleanVenueName: c } = await load()
  assert.equal(c('5 ALIVE BRADFORD Adventure Soft Play Centre/ INDOOR FOOTBALL (SEE WEBSITE FOR OPERATING HOURS)'), '5 Alive Bradford Adventure Soft Play Centre')
  assert.equal(c('The Hidden Village Keighley: Role-play Village, Sensory Room & Café'), 'The Hidden Village Keighley')
  assert.equal(c('Immersive Gamebox - Arndale, Manchester'), 'Immersive Gamebox')
  assert.equal(c('The Eden Centre - Blackwood'), 'The Eden Centre - Blackwood', 'a branch name is kept, so branches differ')
  assert.equal(c('SHWEET SOFT PLAY'), 'Shweet Soft Play')
  assert.equal(c('Jungle boogie walsall'), 'Jungle Boogie Walsall')
  assert.equal(c("CJ's Funhouse"), "CJ's Funhouse")
  assert.equal(c('Monster Mayhem (Dudley Port)'), 'Monster Mayhem (Dudley Port)')
  assert.equal(c('SPARC (St Peter\'s Activity & Resource Centre)'), "SPARC (St Peter's Activity & Resource Centre)")
  assert.equal(c('Party and Play'), 'Party and Play')
})

test('hours: weekly pattern from Google text or structured JSON, never "today"', { skip }, async () => {
  const { parseWeekHours: p, summariseHours: s } = await load()
  assert.equal(s(p({ opening_hours_text: GOOGLE_DAILY })), 'Open daily 9:30am–6pm')
  assert.equal(s(p({ opening_hours_text: GOOGLE_DAILY.replace('Tuesday: 9:30 AM – 6:00 PM', 'Tuesday: Closed') })), 'Open 9:30am–6pm, closed Tuesdays')
  assert.equal(s(p({ opening_hours_text: GOOGLE_DAILY.replace('Monday: 9:30 AM – 6:00 PM', 'Monday: Closed').replace('Sunday: 9:30 AM – 6:00 PM', 'Sunday: Closed') })), 'Open Tue–Sat 9:30am–6pm')
  assert.equal(s(p({ opening_hours_text: GOOGLE_DAILY.replace('Sunday: 9:30 AM – 6:00 PM', 'Sunday: 9:30 AM – 4:00 PM') })), 'Open 7 days from 9:30am')
  assert.equal(s(p({ opening_hours_text: GOOGLE_DAILY.replace('Sunday: 9:30 AM – 6:00 PM', 'Sunday: 10:00 AM – 4:00 PM') })), 'Open 7 days')
  assert.equal(s(p({ opening_hours_text: 'Monday to Sunday 9am–6pm (holiday times differ)' })), null, 'free text we cannot map to days says nothing')
  assert.equal(s(p({ opening_hours_text: 'Monday: 9:30 AM – 3:00 PM; Tuesday: Closed' })), null, 'a partial week says nothing')
  const week = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((d) => [d, { open: '09:00', close: '15:00' }]))
  assert.equal(s(p({ opening_hours: { ...week, saturday: 'closed', sunday: 'closed' } })), 'Open Mon–Fri 9am–3pm')
})

test('schema hours: a full week, or nothing', { skip }, async () => {
  const { parseWeekHours: p, weekHoursForSchema: w } = await load()
  const out = w(p({ opening_hours_text: GOOGLE_DAILY.replace('Tuesday: 9:30 AM – 6:00 PM', 'Tuesday: Closed') }))
  assert.deepEqual(out.monday, { open: '09:30', close: '18:00' })
  assert.equal(out.tuesday, 'closed')
  assert.equal(w(p({ opening_hours_text: GOOGLE_DAILY.replace('Monday: 9:30 AM – 6:00 PM', 'Monday: 9 AM – 12 PM, 1 – 5 PM') })), null, 'split day')
})

const base = {
  name: 'Jigsaw Juniors Shipley', venue_type: 'indoor', rating: '4.1', reviews_count: 161,
  opening_hours_text: GOOGLE_DAILY, cafe: true, parties: true, has_sen_sessions: true, parking: false,
}

test('facts: only what the record holds; false booleans are unknown, not "no"', { skip }, async () => {
  const { venueFacts } = await load()
  const f = venueFacts(base, { town: 'Shipley', nearbyCount: 7 })
  assert.deepEqual(f.rating, { value: 4.1, count: 161 })
  assert.deepEqual(f.features, ['Café', 'Party bookings', 'SEN sessions'])
  assert.equal(f.price, null)
  assert.equal(f.ages, null)
  const bare = venueFacts({ name: 'X', venue_type: 'indoor' }, { town: 'Hull', nearbyCount: 0 })
  assert.equal(bare.rating, null)
  assert.equal(bare.hours, null)
  assert.deepEqual(bare.features, [])
})

test('title: name first, town once, <= 60 chars with fallbacks', { skip }, async () => {
  const { venueFacts, buildVenueSeoTitle: t } = await load()
  const f = (name, town, over = {}) => venueFacts({ ...base, name, ...over }, { town, nearbyCount: 3 })
  assert.equal(t(f('Rascal Ranch', 'Leicester')), 'Rascal Ranch, Leicester: Soft Play Info & Reviews')
  assert.equal(t(f('Jigsaw Juniors Shipley', 'Shipley')), 'Jigsaw Juniors Shipley: Soft Play Info & Reviews', 'town already in the name')
  assert.equal(t(f('Rascal Ranch', 'Leicester', { rating: null })), 'Rascal Ranch, Leicester: Soft Play Info', 'no "Reviews" without reviews')
  assert.equal(t(f('The Nook Saddleworth Play Cafe', 'Saddleworth')), 'The Nook Saddleworth Play Cafe: Soft Play Info & Reviews')
  assert.equal(t(f('Kids Play ESK Eastbourne', 'Eastbourne')), 'Kids Play ESK Eastbourne: Soft Play Info & Reviews')
  const long = t(f('BCP Leisure, Kings Park Leisure and Learning Centre', 'Bournemouth'))
  assert.ok(long.length <= 60 && long.startsWith('BCP Leisure, Kings Park Leisure and Learning Centre'), long)
  assert.equal(t(f('Jump Inc', 'Beverley', { venue_type: 'trampoline-park' }), 'trampoline-park'), 'Jump Inc, Beverley: Trampoline Park Info & Reviews')
  const huge = t(f('Born 2 Bounce Bouncy Castle Hire and Soft Play Hire Stockport Tameside Manchester', 'Stockport'))
  assert.ok(huge.length <= 60 && !huge.endsWith(' '), huge)
})

test('meta: facts first, then the comparison; <= 155; dropped whole, never cut', { skip }, async () => {
  const { venueFacts, buildVenueMetaDescription: m } = await load()
  const f = (over = {}, opts = {}) => venueFacts({ ...base, ...over }, { town: 'Shipley', nearbyCount: 7, ...opts })
  assert.equal(m(f()), 'Rated 4.1★ on Google (161 reviews). Open daily 9:30am–6pm. Facilities: café, party bookings and SEN sessions. Compare 7 other soft plays near Shipley.')
  assert.equal(m(f({ cafe: false, parties: false, has_sen_sessions: false, opening_hours_text: null })), 'Rated 4.1★ on Google (161 reviews). Compare 7 other soft plays near Shipley.')
  assert.equal(m(f({}, { nearbyCount: 20, nearbyMore: true })).endsWith('Compare 20+ other soft plays near Shipley.'), true)
  assert.equal(m(f({}, { nearbyCount: 1 })).endsWith('Compare 1 other soft play near Shipley.'), true)
  assert.equal(m(f({}, { nearbyCount: 0 })).endsWith('Address, directions and contact details.'), true)
  assert.equal(m(venueFacts({ name: 'Tiny Tots', venue_type: 'indoor' }, { town: 'Hull', nearbyCount: 4 })), 'Tiny Tots in Hull: soft play info. Compare 4 other soft plays near Hull.')
  const busy = m(f({ toddler_area: true, free_parking: true, age_range_min: 0, age_range_max: 8, price_from: 6.5 }, { town: 'Newcastle-under-Lyme' }))
  assert.ok(busy.length <= 155, busy)
  assert.ok(busy.endsWith('Compare 7 other soft plays near Newcastle-under-Lyme.'), busy)
  assert.ok(!busy.includes('…'))
})

test('Quick facts rows carry every fact the meta can state', { skip }, async () => {
  const { venueFacts, quickFactRows, buildVenueMetaDescription } = await load()
  const f = venueFacts({ ...base, age_range_min: 0, age_range_max: 8, price_from: 6.5 }, { town: 'Shipley', nearbyCount: 7 })
  const rows = quickFactRows(f)
  const shown = rows.map((r) => r.value).join(' | ')
  assert.match(shown, /4\.1★ from 161 reviews/)
  assert.match(shown, /Open daily 9:30am–6pm/)
  assert.match(shown, /Ages 0–8/)
  assert.match(shown, /From £6\.50 per child/)
  assert.match(shown, /Café, Party bookings, SEN sessions/)
  // every fact sentence in the meta (apart from the comparison) is backed by a row
  for (let sentence of buildVenueMetaDescription(f).split('. ').map((x) => x.replace(/\.$/, ''))) {
    if (sentence.startsWith('Compare') || sentence.startsWith('Rated')) continue
    sentence = sentence.replace(/^Facilities: /, '')
    const lower = shown.toLowerCase()
    for (const word of sentence.toLowerCase().split(/,? and |, /)) assert.ok(lower.includes(word.replace(/ per child$/, '')), `${word} not shown`)
  }
})

test('meta: says how to reach the venue when there is room, naming only what the page shows', { skip }, async () => {
  const { venueFacts, buildVenueMetaDescription: m } = await load()
  const reach = { address: '9 Trevanth Rd', postcode: 'LE4 9JJ', phone: '0116 397 0940', google_place_id: 'abc' }
  const f = (over = {}, opts = {}) => venueFacts({ ...base, cafe: false, parties: false, has_sen_sessions: false, ...over }, { town: 'Leicester', nearbyCount: 10, ...opts })
  assert.equal(
    m(f(reach)),
    'Rated 4.1★ on Google (161 reviews). Open daily 9:30am–6pm. Address, phone number and directions. Compare 10 other soft plays near Leicester.',
  )
  assert.deepEqual(f(reach).contact, ['address', 'phone number', 'directions'])
  // no phone: not promised
  assert.ok(m(f({ ...reach, phone: null })).includes('Address and directions.'))
  // directions alone is not worth a sentence
  assert.ok(!/directions\./i.test(m(f({ google_place_id: 'abc' }))))
  // junk address ("Closed", "nan") is not an address
  assert.deepEqual(f({ address: 'Closed', postcode: 'nan' }).contact, [])
  // it is the first thing dropped when space runs out: facts survive, comparison survives
  const busy = m(f({ ...reach, cafe: true, parties: true, has_sen_sessions: true }))
  assert.ok(busy.length <= 155, busy)
  assert.ok(busy.includes('Facilities:') && !busy.includes('phone number'), busy)
  // no comparison (no nearby venues): the existing contact ending is used, not repeated
  const alone = m(f(reach, { nearbyCount: 0 }))
  assert.equal(alone.match(/directions/gi).length, 1, alone)
})
