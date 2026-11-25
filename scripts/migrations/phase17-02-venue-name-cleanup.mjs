#!/usr/bin/env node
/**
 * phase17-02: hand-checked venue name clean-up (SEO Phase 4 follow-up, 25 Nov 2026,
 * approved by David). Removes SEO junk, shouting capitals and taglines from display
 * names. Changes `name` only: slugs, and so URLs, are untouched. Each name was checked
 * by hand against the machine proposal in seo-data/phase4/venue-name-cleanup-proposals.csv;
 * proposals that lost meaning (e.g. "Active Leicester" for Aylestone Leisure Centre,
 * "Xplore" alone) were rewritten or dropped.
 *
 *   node scripts/migrations/phase17-02-venue-name-cleanup.mjs            # dry run
 *   node scripts/migrations/phase17-02-venue-name-cleanup.mjs --execute  # write + backup
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'

const EXECUTE = process.argv.includes('--execute')
const TAG = 'phase17-02-venue-name-cleanup'

// [id, expected current name, new name]
const RENAMES = [
  [1442, 'Moo music Bournemouth Christchurch, Ringwood and Ferndown', 'Moo Music Bournemouth, Christchurch, Ringwood and Ferndown'],
  [1444, 'ABC LEISURE HIRE', 'ABC Leisure Hire'],
  [514, 'LITTLE MONKEYS PLAY CENTRE', 'Little Monkeys Play Centre'],
  [169, "Crazy Tykes Indoor and Outdoor Children's Soft play centre", "Crazy Tykes Indoor and Outdoor Children's Soft Play Centre"],
  [197, 'Play Valley Doncaster - Soft Play Centre & Kids Parties', 'Play Valley Doncaster'],
  [215, 'Play Valley Rotherham - Soft Play Centre & Kids Parties', 'Play Valley Rotherham'],
  [961, 'Play Valley Dinnington - Soft Play Centre & Kids Parties', 'Play Valley Dinnington'],
  [246, 'Play Valley Sheffield - Soft Play Centre & Kids Parties', 'Play Valley Sheffield'],
  [1278, 'Crazy Club Soft Play | Soft Play in Sidcup, Kent', 'Crazy Club Soft Play'],
  [1304, 'Let Loose - Soft Play And Cafe', 'Let Loose Soft Play and Cafe'],
  [465, 'Wonder World Soft Play and Kids & Group Party Venue Edinburgh (Leith)', 'Wonder World Soft Play Edinburgh (Leith)'],
  [381, 'Wonder World Soft Play and Kids & Group Party Venue East Kilbride', 'Wonder World Soft Play East Kilbride'],
  [375, 'Wonder World Soft Play and Kids & Group Party Venue Glasgow', 'Wonder World Soft Play Glasgow'],
  [1784, 'WonderWorld Soft Play and Kids & Group Party Venue Southampton', 'WonderWorld Soft Play Southampton'],
  [251, 'GO BOUNCE', 'GO Bounce'],
  [910, 'SHWEET SOFT PLAY', 'Shweet Soft Play'],
  [1946, 'KIDZ TOWN', 'Kidz Town'],
  [321, 'Xplore - Soft Play and 4D Golf', 'Xplore Soft Play and 4D Golf'],
  [1701, 'Lincoln Zoo | A Wild Family Day Out in Lincolnshire', 'Lincoln Zoo'],
  [494, 'BECS - Inclusive Soft Play Centre', 'BECS Inclusive Soft Play Centre'],
  [388, 'Ruff and Tumble Softplay ( NEW AND IMPROVED)', 'Ruff and Tumble Softplay'],
  [844, "Clip 'n Climb Ipswich - Indoor Rock Climbing Centre", "Clip 'n Climb Ipswich"],
  [309, 'Sensory Haven - Play cafe & Sensory room', 'Sensory Haven Play Cafe & Sensory Room'],
  [1553, 'Hemsworth Methodist Church (+ Little Fishes soft play)', 'Little Fishes Soft Play (Hemsworth Methodist Church)'],
  [576, '360 Play Leicester - Family Entertainment Centre and Party Venue', '360 Play Leicester'],
  [811, '360 Play Basildon - Family Entertainment Centre and Party Venue', '360 Play Basildon'],
  [601, 'Tots Play Baby Development and Toddler Classes - Blaby, Whetstone & Desford', 'Tots Play Blaby, Whetstone & Desford'],
  [609, 'Krazy Krocs - Play Centre', 'Krazy Krocs Play Centre'],
  [296, "JungleMazeia Soft play & children's activity centre", "JungleMazeia Soft Play & Children's Activity Centre"],
  [2131, 'Funlord - Kids Birthday Parties & Soft Play Adventures', 'Funlord'],
  [764, 'PlayDaze - Indoor Play Centre', 'PlayDaze Indoor Play Centre'],
  [403, 'PIRATES & PRINCESSES ADVENTURE ZONE', 'Pirates & Princesses Adventure Zone'],
  [867, 'Jolly Junction - Soft Play Centre', 'Jolly Junction Soft Play Centre'],
  [188, '5 ALIVE BRADFORD Adventure Soft Play Centre/ INDOOR FOOTBALL (SEE WEBSITE FOR OPERATING HOURS)', '5 Alive Bradford Adventure Soft Play Centre'],
  [1003, 'Bounce Happy Doncaster Bouncy Castles, Soft play, Disco equipment, Mobile Cinema, Slush machines and more', 'Bounce Happy Doncaster'],
  [19, 'JAM JAMZ Indoor Softplay', 'Jam Jamz Indoor Softplay'],
  [1896, 'Appletown London- Indoor Kids Soft Play & Family Venue', 'Appletown London'],
  [1017, 'Go! Active @ The Arc - Leisure Centre', 'Go! Active @ The Arc'],
  [1135, 'Toddler Town Nursery @ Little Hooligans Soft play Centre', 'Toddler Town Nursery @ Little Hooligans Soft Play Centre'],
  [1258, 'The Hidden Village Keighley: Role-play Village, Sensory Room & Café', 'The Hidden Village Keighley'],
  [96, "The Hidden Village: Children's Role-Play Village & Café", 'The Hidden Village'],
  [996, 'TRIP 2 TOWN', 'Trip 2 Town'],
  [1076, 'Neverland Fun House (Under New Management)', 'Neverland Fun House'],
  [1655, "Little Linnie's | Suffolk Soft Play Hire |", "Little Linnie's Soft Play Hire"],
  [377, 'WeePlay - Soft Play & Party Venue', 'WeePlay'],
  [526, 'Tiny Town Adventures - Role Play Centre', 'Tiny Town Adventures'],
  [641, "Mini Monsters (children's play cafe 0-5 years)", 'Mini Monsters Play Cafe'],
  [1009, 'Born 2 Bounce Bouncy Castle Hire and Soft Play Hire Stockport Tameside Manchester', 'Born 2 Bounce'],
  [1575, "Jilly's Little Gems bounce and play equipment north east", "Jilly's Little Gems"],
  [1774, 'Jump Warehouse (Great Yamouth)', 'Jump Warehouse (Great Yarmouth)'],
  [1746, 'MCS Fun Factory - Mobile Soft Play Hire Service', 'MCS Fun Factory'],
  [1628, 'Crowhurst Park | Holidays | Lodges | Leisure', 'Crowhurst Park'],
  [1358, 'Graystone Action Sports (Skatepark, Trampoline, Bouldering) (Manchester)', 'Graystone Action Sports'],
  [1162, "Pop Up Play Village Kid's Role Play in North of Bristol", 'Pop Up Play Village'],
]

const url = process.env.DATABASE_URL ?? fs.readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].replace(/^["']|["']$/g, '')
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()
const rows = (await client.query('SELECT id, name, slug FROM venues WHERE id = ANY($1)', [RENAMES.map((r) => r[0])])).rows
const byId = new Map(rows.map((r) => [r.id, r]))
const todo = []
for (const [id, expected, next] of RENAMES) {
  const row = byId.get(id)
  if (!row) { console.log(`SKIP ${id}: not found`); continue }
  if (row.name !== expected) { console.log(`SKIP ${id}: name is now "${row.name}"`); continue }
  todo.push([id, next]); console.log(`${id}  ${expected}\n   -> ${next}`)
}
console.log(`\n${todo.length} renames.`)
if (!EXECUTE) { console.log('Dry run. Re-run with --execute to write.'); await client.end(); process.exit(0) }
fs.mkdirSync('scripts/output/backups', { recursive: true })
const backup = path.join('scripts/output/backups', `${TAG}-${Date.now()}.json`)
fs.writeFileSync(backup, JSON.stringify(rows, null, 1)); console.log(`Backup: ${backup}`)
await client.query('BEGIN')
for (const [id, next] of todo) await client.query(`UPDATE venues SET name = $2, updated_by = $3, updated_at = NOW() WHERE id = $1`, [id, next, TAG])
await client.query('COMMIT'); await client.end(); console.log('Done.')
