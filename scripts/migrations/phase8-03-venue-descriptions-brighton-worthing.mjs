// Phase 8-03: replace the templated copy on Brighton/Worthing-area venue pages with short,
// factual descriptions.
//
// The old copy was generated: it said "in Brighton" for venues in Lewes and Worthing, pasted
// review fragments into the description, and added unverified claims ("Best for: children of
// all ages", "weekday mornings 9–11am are quietest", "check parking near …"). For the venues
// below this script:
//   description / meta_description   -> hand-written from the sources listed (venue website read on
//                                       2026-10-25, or Google Places address data where no site
//                                       could be read; those descriptions are deliberately one line)
//   tips_before_visiting             -> only tips the venue's own site states, otherwise NULL
//   what_to_expect, seo_summary      -> NULL (the page falls back to the facility flags / hides the box)
//   seo_title                        -> NULL (stored titles name the wrong town, e.g. "…, Brighton" for a Worthing venue)
// Prices and ratings are not put in the text (the page shows live ones next to it).
//
//   node scripts/migrations/phase8-03-venue-descriptions-brighton-worthing.mjs             # dry run
//   node scripts/migrations/phase8-03-venue-descriptions-brighton-worthing.mjs --execute   # write (backs up first)
//   node scripts/migrations/phase8-03-venue-descriptions-brighton-worthing.mjs --rollback=<backup> [--execute]

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const EXECUTE = process.argv.includes('--execute')
const rollbackArg = process.argv.find((a) => a.startsWith('--rollback='))?.slice('--rollback='.length)
const CHECKED = 'Checked against the venue’s website on 25 October 2026.'

const V = [
  { id: 874, slug: 'space-station-soft-play-ltd', src: 'spacestationsoftplay.co.uk',
    description: `Space Station is an indoor play centre in Lancing for children aged 0–12, with a café and two party rooms. Play runs in timed sessions of 1 hour 45 minutes. Walk-ins are accepted but a space isn’t guaranteed when it is full. Memberships and private hire are also offered. ${CHECKED}`,
    tips: ['Walk-ins are accepted but a space isn’t guaranteed when the centre is at capacity; call 01903 497606 to check.'] },
  { id: 894, slug: 'the-lighthouse-soft-play-and-cafe', src: 'lighthousesoftplay.com',
    description: `The Lighthouse is a volunteer-staffed soft play and community café at Offington Park Methodist Church, South Farm Road, Worthing. The seaside-themed frame has three levels, a transparent climbing wall, an infinity mirror, hanging snakes and an interactive gaming screen. Its website lists entry prices from babies up to age 10, and party bookings. ${CHECKED}`,
    tips: ['Check opening days before you go: the website lists Wednesday to Friday.', 'Adult supervision is required for all children, per the venue’s rules page.'] },
  { id: 899, slug: 'out-of-bounds', src: 'out-of-bounds.co.uk',
    description: `Out of Bounds is an indoor and outdoor activity centre on Golfers Lane, Angmering, with a soft play area and a pre-school Climb ‘n’ Soft Play session. Other activities on site include ten-pin bowling, laser tag, high ropes, adventure golf and jumping pillows, with food and drink and party options. ${CHECKED}`,
    tips: [] },
  { id: 866, slug: 'flying-fortress', src: 'flying-fortress.co.uk',
    description: `Flying Fortress is an indoor play centre on the Ford Airfield Industrial Estate, near Arundel. It runs timed sessions, has a 300-seat café, and lists party information. Its website prices children from 0 to 13 and says it is closed on Mondays. ${CHECKED}`,
    tips: ['Weekdays have two sessions (09:30–13:30 and 14:00–18:00); weekends and school holidays have three (09:30–12:00, 12:30–15:00, 15:30–18:00). The centre is closed between sessions.'] },
  { id: 907, slug: 'harbour-park-indoor-soft-play', src: 'harbourpark.com/soft-play',
    description: `Harbour Park’s soft play area in Littlehampton is for children up to 9, with separate role-play rooms, light tunnels and an interactive gaming screen. A separate baby soft play is for ages 0–18 months. Soft play parties are offered. ${CHECKED}`,
    tips: ['No need to book; pay on arrival. Peak times may limit play to a one-hour session.'] },
  { id: 901, slug: 'the-little-play-village', src: 'thelittleplayvillage.co.uk',
    description: `The Little Play Village is a role-play business based in Goring, Worthing, with play areas modelled on village amenities. It isn’t a conventional soft play centre: families visit on ticketed Stay & Play and special-event dates, and it also offers parties and visits to schools and nurseries. ${CHECKED}`,
    tips: ['Visits are ticketed for set dates; check the website for the next one.'] },
  { id: 791, slug: 'monkey-bizness-lewes', src: 'monkey-bizness.co.uk/lewes',
    description: `Monkey Bizness is an indoor play centre on the Cliffe Industrial Estate in Lewes. Its website lists three party packages (Funky Monkey, Mega Monkey and Pizza Party), each for a minimum of 12 children and two hours, including 90 minutes of play. It also lists memberships and special events. ${CHECKED}`,
    tips: [] },
  { id: 897, slug: 'sharkys', src: 'sharkysplay.co.uk',
    description: `Sharky’s Soft Play & Café is at Henfield Leisure Centre, Northcroft, Henfield. It runs SEN sessions on the first and third Thursday of each month and offers parties. It is a nut-free site: only food from its café is allowed in the play area. ${CHECKED}`,
    tips: ['Sessions are often fully booked; book in advance.', 'Only food bought from the café is allowed in the play area (nut-free site).'] },
  { id: 919, slug: 'the-doves-play-barn', src: 'thedovesplaybarn.co.uk',
    description: `The Doves Play Barn is an activity play barn at Heaven Farm, Furner’s Green, near Uckfield. Built from sustainable wood, it has hidden spaces, rope bridges, slides and a toddler-safe area, plus a café, inflatables and parties. Its website says it is open seven days a week, 9am to 5pm. ${CHECKED}`,
    tips: [] },
  { id: 903, slug: 'jumpin-fun-inflatable-park-burgess-hill', src: 'jumpinfun.co.uk/burgess-hill',
    description: `Jumpin Fun Burgess Hill is a 25,000 sq ft inflatable theme park on Jubilee Road: inflatables rather than traditional soft play. Attractions listed on its website include a mega slide, ninja assault course, ball pit and laser jump. It has a café and offers parties. ${CHECKED}`,
    tips: [] },
  // No readable website: one factual line from the address on Google Places.
  { id: 900, slug: 'funplex', src: 'Google Places address', description: 'Funplex is an indoor play centre at Unit 2b, The Hyde Business Park, Auckland Drive, Brighton.', tips: [] },
  { id: 886, slug: 'palace-play', src: 'Google Places address', description: 'Palace Play is a children’s play venue on Brighton Palace Pier, Madeira Drive.', tips: [] },
  { id: 1458, slug: 'playcafe-brighton', src: 'Google Places address', description: 'Playcafe is a café with a children’s play area on St Matthias Path, Brighton.', tips: [] },
  { id: 914, slug: 'funplay-leisure', src: 'Google Places + visitor reviews', description: 'FunPlay Leisure is a family leisure venue at Brighton Marina. Visitor reviews mention pirate crazy golf, trampolines and an inflatable slide.', tips: [] },
  { id: 881, slug: 'hope-hive', src: 'Google Places address', description: 'Our Hope Hive is at Pilgrim’s House, 51–63 St Dunstan’s Road, Worthing.', tips: [] },
  { id: 908, slug: 'two-by-two-softplay', src: 'Google Places address', description: 'Two by Two Softplay is listed at 1–5 Roman Crescent, Southwick, near Shoreham-by-Sea.', tips: [] },
  { id: 792, slug: 'barneys-play', src: 'Google Places address', description: 'Barney’s Play is a children’s play venue with a café on Bell Lane, Uckfield.', tips: [] },
  { id: 1622, slug: 'beechwood-hall-rural-park-hastings', src: 'Google Places address', description: 'Beechwood Hall & Rural Park is at Beechwood Lane, Cooksbridge, near Lewes.', tips: [] },
]

const metaOf = (d) => {
  const first = d.split('. ').slice(0, 2).join('. ').replace(/\s*Checked against.*$/, '')
  const t = first.endsWith('.') ? first : `${first}.`
  return t.length <= 158 ? t : `${t.slice(0, 155).replace(/\s+\S*$/, '')}…`
}
const COLS = ['description', 'meta_description', 'tips_before_visiting', 'what_to_expect', 'seo_summary', 'seo_title']

async function rollback(file) {
  const b = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  const pool = await getPool(); const c = await pool.connect()
  try {
    await c.query('BEGIN')
    for (const r of b.rows) {
      console.log(`  restore id=${r.id} ${r.slug}`)
      if (EXECUTE) await c.query('UPDATE venues SET description=$1, meta_description=$2, tips_before_visiting=$3, what_to_expect=$4, seo_summary=$5, seo_title=$6, updated_at=$7 WHERE id=$8',
        [r.description, r.meta_description, r.tips_before_visiting, r.what_to_expect, r.seo_summary, r.seo_title, r.updated_at, r.id])
    }
    await c.query(EXECUTE ? 'COMMIT' : 'ROLLBACK')
    console.log(EXECUTE ? 'Restored.' : 'Dry run. Add --execute to restore.')
  } finally { c.release(); await pool.end() }
}

async function main() {
  if (rollbackArg) return rollback(rollbackArg)
  console.log(EXECUTE ? 'EXECUTE\n' : 'DRY RUN: nothing will be written. Re-run with --execute.\n')
  const pool = await getPool(); const c = await pool.connect()
  try {
    const { rows } = await c.query('SELECT * FROM venues WHERE id = ANY($1::int[])', [V.map((v) => v.id)])
    const byId = new Map(rows.map((r) => [r.id, r]))
    const plan = []
    for (const v of V) {
      const row = byId.get(v.id)
      if (!row || row.slug !== v.slug) { console.log(`SKIP id=${v.id} ${v.slug}: not found / slug differs\n`); continue }
      const next = {
        description: v.description,
        meta_description: metaOf(v.description),
        tips_before_visiting: v.tips.length ? v.tips.map((t, i) => `${i + 1}. ${t}`).join('\n') : null,
        what_to_expect: null,
        seo_summary: null,
        seo_title: null, // the page then builds "<name> – Soft Play in <real town>" from the locality config
      }
      console.log(`id=${v.id} ${v.slug}   [source: ${v.src}]\n  description (${next.description.length}): ${next.description}\n  meta (${next.meta_description.length}): ${next.meta_description}\n  tips: ${next.tips_before_visiting ?? 'NULL'}\n  (old description began: ${(row.description || '').slice(0, 70).replace(/\n/g, ' ')}...)\n`)
      plan.push({ v, row, next })
    }
    if (!EXECUTE) { console.log('Dry run complete. Nothing written.'); return }
    fs.mkdirSync(path.join(ROOT, 'scripts/output/backups'), { recursive: true })
    const file = path.join(ROOT, `scripts/output/backups/phase8-03-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), rows: plan.map((p) => p.row) }, null, 2))
    console.log(`Backup written: ${path.relative(ROOT, file)}`)
    await c.query('BEGIN')
    try {
      for (const { v, next } of plan) {
        await c.query(`UPDATE venues SET ${COLS.map((k, i) => `${k}=$${i + 1}`).join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=$${COLS.length + 1} AND slug=$${COLS.length + 2}`,
          [...COLS.map((k) => next[k]), v.id, v.slug])
      }
      await c.query('COMMIT')
    } catch (e) { await c.query('ROLLBACK'); throw e }
    console.log(`Applied to ${plan.length} venues.`)
  } finally { c.release(); await pool.end() }
}
main().catch((e) => { console.error(e); process.exit(1) })
