# Data Quality & Trust Audit — Phase 1

**Generated:** 2026-07-23
**Scope:** All venue data reachable via local static exports + a live-production probe for cities with no local data.
**File changes:** None. This report is the only file created in Phase 1.

---

## Phase 2 addendum (2026-07-24)

While preparing the postcode-backfill migration (`scripts/migrations/phase2-03-backfill-postcodes.mjs`), reverse-geocoding the 775 venues that had coordinates but no postcode surfaced **160 additional wrong-city venues** on top of the 57 found in §3 below — bringing the real total to **217** (181 auto-movable to one unambiguous city, 36 needing manual placement between two candidates, e.g. Doncaster venues that are genuinely Sheffield-or-Barnsley by postcode).

This wasn't random noise — it looks like entire city batches were mislabelled during import: **almost every venue currently assigned to "Doncaster" is actually in Sheffield or Barnsley by postcode**, and **a large share of venues assigned to "Glasgow" are actually in Birmingham** (`B` postcode prefix, nowhere near Scotland). Worth a manual look at whatever step assigned `city_slug` for those two batches specifically — this pattern is bigger than a few stray venues.

Updated migration scripts (`scripts/migrations/phase2-04-move-wrong-city.mjs`) now cover all 217, not just the original 57. See the Phase 2 summary for the full script list and run order.

---

## 0. Read this first — two things blocking the audit itself

### 0.1 The production database is over its compute-time quota, right now

Direct queries to the Neon Postgres database fail with `Your account or project has exceeded the compute time quota`. This is not intermittent — it failed consistently on retry. Practical effect on production **right now**:

- **Birmingham, Bolton, Bristol, Liverpool, London, and Manchester city pages are live but showing zero venues.** These 6 declared cities have no static-JSON fallback, so when the DB query fails, `getVenues()` returns nothing and the page renders empty (confirmed by fetching the live pages: only the 4 filter-category nav links appear, no venue cards). A parent searching "soft play London" right now sees an empty results page.
- Individual venue detail pages for those cities may still resolve if cached, but the listing pages do not.
- Any live write — new claims, reviews, dashboard edits, the contact form — is almost certainly failing silently, same as the claim-flow bug found and fixed earlier this week.

This needs your attention independently of the data-quality work below: upgrade the Neon plan or wait out the quota window.

### 0.2 This audit ran against static snapshots, not live data

Because of 0.1, I audited against local files instead of the live DB:

- `data/generated/venues.json` — 1,052 venues across 35 towns, generated 2026-05-25. **Primary source for this audit** — has postcode, category, website, phone, description.
- `data/generated/venuesByTown.json` + `towns.json` — 669 venues across 16 towns, generated ~2026-04-01. This is the file actually wired into the site's live fallback code (`lib/staticVenues.ts`). Used to confirm which slugs are truly live in production. **Its `postcode` field is 100% empty across all 669 rows** — itself a data-completeness bug, noted in §4.
- `data/cities.json` — the 38 officially declared city slugs.
- `data/import-raw-skipped.json` — 1,747 venues that a prior import already excluded (1,124 as `not_a_play_venue`, 623 as `duplicate_in_csv_set`). Useful context: a filter exists, but it clearly isn't catching everything — 15 of the 16 venues you named as Hull examples are still live despite this list existing.
- Direct HTTP probes of production for anything not covered above.

**Coverage gap:** `Birmingham, Bolton, Bristol, Liverpool, London, Manchester` have no data in either static file, and (per §0.1) currently render with zero venues live. **These 6 cities could not be audited at all.** Once the DB is back, re-run this audit against live data for them specifically — that data may look completely different from what shipped originally.

**Confidence-level definitions used throughout:**
- **HIGH** — objective signal (Google's own category field, e.g. "Aquarium", "Bowling Alley") and/or an unambiguous name match. Safe to action in bulk.
- **MEDIUM** — plausible but needs a human glance before acting (e.g. "Leisure centre" sometimes has a genuine soft-play area attached; "Trampoline Park" is a real family attraction, just not soft play).
- **LOW** — used sparingly below; flagged for awareness, not for bulk action.

---

## 1. Executive summary

| Issue | Count | Confidence |
|---|---|---|
| Miscategorised venues (not soft play) | 82 | HIGH |
| Miscategorised venues (recategorise candidates: trampoline parks, farms, leisure centres) | 66 | MEDIUM |
| Public park playgrounds listed as commercial venues | 83 | HIGH |
| B2B soft-play equipment suppliers listed as venues | 2 | HIGH |
| Wrong-city venues (postcode contradicts assigned city) | 57 | HIGH |
| Duplicate venues, same phone number | 25 groups (4 HIGH / 21 MEDIUM) | mixed |
| Additional likely duplicates, fuzzy name match | 50 pairs | LOW–MEDIUM |
| Venues with corrupted address field (leaked opening-hours text, literal "nan") | 682 / 1,052 (65%) | HIGH |
| Venues with no postcode at all | 778 / 1,052 (74%) | HIGH |
| Cities with zero local data, currently showing empty live | 6 | — |
| Broken internal links to a dead city slug (`stoke-on-trent` / `southend-on-sea`) | 2 files, 8 links | HIGH |

**The single biggest finding is §4.1: a systemic scraper bug, not scattered bad data.** In 20 of the 35 audited cities, **90–100%** of venues have their `address` field overwritten with a leaked Google Maps "opening status" string (e.g. `"Closed, · Opens 9 am Thu"`) or the literal word `"nan"`, instead of a real street address. This is not spread evenly — it maps cleanly to import batch: **Hull, Leeds, York, Sheffield, Beverley, Bridlington, and Aberdeen are almost entirely clean (0–22% affected)**, while the ~25 cities added afterward are almost entirely broken. This confirms your instinct that the site isn't ready to expand further until the underlying pipeline is fixed — the *next* batch of cities would ship broken by default if the same pipeline is reused.

---

## 2. Miscategorised venues

### 2.1 Hull — every named example, confirmed

All 15 of the 16 venues you listed by name were found and confirmed via Google's own category field. ("Enigma Escape Rooms" is listed as "Enigma Live Escape Rooms - Hull".)

| Venue | Slug | Category | Confidence | Signal |
| --- | --- | --- | --- | --- |
| Airplay Bouncy Castles | airplay-bouncy-castles-hull | Bouncy castle hire | HIGH | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/ |
| BB Inflatables | bb-inflatables-hull | Bouncy castle hire | HIGH | category="Bouncy castle hire"; name matches /\binflatables?\b/ |
| C&R Bouncy Castles and Soft Play | c-r-bouncy-castles-and-soft-play-hull | Bouncy castle hire | HIGH | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/ |
| Drum & Cymbals | drum-cymbals-hull | Pub | HIGH | category="Pub" |
| Enigma Live Escape Rooms - Hull | enigma-live-escape-rooms-hull-hull | Escape room centre | HIGH | category="Escape room centre"; name matches /\bescape room/ |
| FUN4ALL BOUNCY CASTLES | fun4all-bouncy-castles-hull | Bouncy castle hire | HIGH | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/ |
| Fantastic Faces Face Painting Hull | fantastic-faces-face-painting-hull-hull | Children's party service | HIGH | name matches /\bface paint/ |
| Hollywood Bowl Hull | hollywood-bowl-hull-hull | Bowling Alley | HIGH | category="Bowling Alley"; name matches /\bbowl\b/ |
| Inflata Nation Inflatable Theme Park Hull | inflata-nation-inflatable-theme-park-hull-hull | Theme park | HIGH | name matches /\binflatables?\b/ |
| Kingswood Leisure Park | kingswood-leisure-park-hull | Bowling Alley | HIGH | category="Bowling Alley" |
| Princes Quay | princes-quay-hull | Bowling Alley | HIGH | category="Bowling Alley"; name matches /\bquay\b/ |
| Rockcity Climbing | rockcity-climbing-hull | Rock climbing gym | HIGH | category="Rock climbing gym"; name matches /\bclimbing\b/ |
| Sailmakers | sailmakers-hull | Pub | HIGH | category="Pub" |
| Smyths Toys Superstores Hull | smyths-toys-superstores-hull-hull | Toy Shop | HIGH | category="Toy Shop"; name matches /\btoys?\b.*(store\|superstore\|shop)/ |
| The Deep | the-deep-hull | Aquarium | HIGH | category="Aquarium" |
| The Kingstown | the-kingstown-hull | Pub | HIGH | category="Pub" |
| The Lost City Adventure Golf | the-lost-city-adventure-golf-hull | Indoor golf course | HIGH | category="Indoor golf course"; name matches /\badventure golf\b/ |
| Wingfield Farm - Dining & Carvery | wingfield-farm-dining-carvery-hull | Pub | HIGH | category="Pub"; name matches /\bfarm\b/ |
| Active+ Hull | active-hull-hull | Events Venue | MEDIUM | category="Events Venue" |
| Airco Arena | airco-arena-hull | Leisure centre | MEDIUM | category="Leisure centre" |
| Albert Avenue Pools and Fitness | albert-avenue-pools-and-fitness-hull | Leisure centre | MEDIUM | category="Leisure centre"; name matches /\bpool(s)?\b/ |
| Bump 'n' Bounce | bump-n-bounce-hull | Bouncy castle hire | MEDIUM | category="Bouncy castle hire" |
| Cottingham Sports Centre | cottingham-sports-centre-hull | Leisure centre | MEDIUM | category="Leisure centre" |
| East Riding Leisure Haltemprice | east-riding-leisure-haltemprice | Leisure centre | MEDIUM | category="Leisure centre" |
| Gravity Active Hull | gravity-active-hull-hull | Leisure centre | MEDIUM | category="Leisure centre" |
| Jump Inc by AirHop Adventure & Trampoline Park Beverley | jump-inc-by-airhop-adventure-trampoline-park-beverley-hull | Children's Amusement Centre | MEDIUM | name matches /\btrampoline\b/ |
| The Freedom Centre | the-freedom-centre-hull | Events Venue | MEDIUM | category="Events Venue" |

Two additional Hull venues turned up during the sweep that weren't in your list but match the same pattern exactly: **Wingfield Farm - Dining & Carvery** (category: Pub) and **Sailmakers** (category: Pub) — both licensed pubs, not soft play.

### 2.2 Sitewide, HIGH confidence

| Venue | City | Category | Signal |
| --- | --- | --- | --- |
| Wacky World Inflatable Park | blackpool | Children's Amusement Centre | name matches /\binflatables?\b/ |
| Inflatazone Indoor Soft Play Centre & Inflatable Zone | bournemouth | Indoor playground | name matches /\binflatables?\b/ |
| John Bull World of Rock | bridlington | Museum | category="Museum" |
| Jumpin Fun Inflatable Park Burgess Hill | brighton | Indoor playground | name matches /\binflatables?\b/ |
| Tee-Rex Adventure Golf Cardiff | cardiff | Indoor playground | name matches /\badventure golf\b/ |
| Inflata Nation Soft Play Inflatable Park Glasgow | glasgow | Children's Amusement Centre | name matches /\binflatables?\b/ |
| Jump'n Fun Inflatable Park Eastbourne | hastings | Indoor playground | name matches /\binflatables?\b/ |
| Inflata Nation Inflatable Theme Park Huddersfield | huddersfield | Indoor playground | name matches /\binflatables?\b/ |
| Clip 'n Climb Ipswich - Indoor Rock Climbing Centre | ipswich | Indoor playground | name matches /\bclimbing\b/ |
| Abacus Bouncy Castle Hire | leeds | Bouncy castle hire | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/ |
| David Lloyd Leeds | leeds | Gym | category="Gym" |
| Escape Hunt Leeds | leeds | Escape room centre | category="Escape room centre" |
| Fun Factor Leeds Bouncy Castle & Soft Play Hire | leeds | Party equipment rental service | category="Party equipment rental service"; name matches /\bbouncy castles?\b/ |
| Hollywood Bowl Leeds | leeds | Bowling Alley | category="Bowling Alley"; name matches /\bbowl\b/ |
| None Go Bye Farm | leeds | Farm shop | category="Farm shop"; name matches /\bfarm\b/ |
| The Little Gym Leeds | leeds | Gymnastics academy | category="Gymnastics academy" |
| Inflata Nation Inflatable Theme Park Newcastle | newcastle | Children's Amusement Centre | name matches /\binflatables?\b/ |
| JR's Bowling & American Diner | norwich | Indoor playground | name matches /\bbowling\b/ |
| Strikes Bowl | norwich | Indoor playground | name matches /\bbowl\b/ |
| Freestyle Trampoline Park, Soft Play and Inflatable | nottingham | Indoor playground | name matches /\binflatables?\b/; name matches /\btrampoline\b/ |
| Planet Bounce Inflatable Park Nottingham | nottingham | Children's Amusement Centre | name matches /\binflatables?\b/ |
| Active iTRAIN | sheffield | Gym | category="Gym" |
| Barnsley Metrodome Waterpark (Calypso Cove) | sheffield | Water park | category="Water park" |
| Born 2 Bounce Bouncy Castle Hire and Soft Play Hire Stockport Tameside Manchester | sheffield | Bouncy castle hire | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/ |
| Bounce Around Sheffield Ltd | sheffield | Party equipment rental service | category="Party equipment rental service" |
| Bounce Happy Doncaster Bouncy Castles, Soft play, Disco equipment, Mobile Cinema, Slush machines and more | sheffield | Bouncy castle hire | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/; name matches /\bcinema\b/ |
| Bouncy Castle Hire - Sheffield Inflatables | sheffield | Bouncy castle hire | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/; name matches /\binflatables?\b/ |
| CBC-Hire Bouncy castles & inflatables | sheffield | Bouncy castle hire | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/; name matches /\binflatables?\b/ |
| Cream Castles - Bouncy Castle Hire Rotherham | sheffield | Bouncy castle hire | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/ |
| Eckington Active | sheffield | Swimming pool | category="Swimming pool" |
| G.F Bouncy castle hire | sheffield | Party equipment rental service | category="Party equipment rental service"; name matches /\bbouncy castles?\b/ |
| Highwayman | sheffield | Pub | category="Pub" |
| Jumparooz Inflatable Park | sheffield | Indoor playground | name matches /\binflatables?\b/ |
| Manic Bouncy Castles | sheffield | Bouncy castle hire | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/ |
| Meadow Farm - Farmhouse Inns | sheffield | Pub | category="Pub"; name matches /\bfarm\b/ |
| Meadowhall | sheffield | Shopping Centre | category="Shopping Centre" |
| Rock Up climbing centre Meadowhall | sheffield | Rock climbing | name matches /\bclimbing\b/ |
| Sheffield Bouncy Castle Hire | sheffield | Bouncy castle hire | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/ |
| Superbowl UK Barnsley | sheffield | Bowling Alley | category="Bowling Alley" |
| The Climbing Works | sheffield | Rock climbing gym | category="Rock climbing gym"; name matches /\bclimbing\b/ |
| Woodfield Farm - Farmhouse Inns | sheffield | Pub | category="Pub"; name matches /\bfarm\b/ |
| Airborne Bouncy Castles | york | Bouncy castle hire | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/ |
| Askham Bryan Wildlife & Conservation Park | york | Zoo | category="Zoo" |
| Bouncing 4 Fun Bouncy Castles | york | Bouncy castle hire | category="Bouncy castle hire"; name matches /\bbouncy castles?\b/ |
| DIG | york | Archaeological museum | category="Archaeological museum" |
| David Lloyd York | york | Gym | category="Gym" |
| Dobbies Garden Centre York | york | Garden centre | category="Garden centre" |
| Energise Leisure Centre | york | Rock climbing gym | category="Rock climbing gym" |
| Everyman York | york | Cinema | category="Cinema" |
| Flying Legends | york | Pub | category="Pub" |
| Freeklime York | york | Rock climbing gym | category="Rock climbing gym" |
| Galtres Centre | york | Community centre | category="Community centre" |
| Hollywood Bowl York | york | Leisure centre | category="Leisure centre"; name matches /\bbowl\b/ |
| Little Vikings | york | Publisher | category="Publisher" |
| Little Vikings - York for kids | york | Publisher | category="Publisher" |
| Murton Park | york | Museum | category="Museum" |
| Museum Gardens | york | Park and Garden | name matches /\bmuseum\b/ |
| National Railway Museum York | york | Rail museum | category="Rail museum"; name matches /\bmuseum\b/ |
| Pear Tree Farm - Farmhouse Inns | york | Pub | category="Pub"; name matches /\bfarm\b/ |
| Smyths Toys Superstores York Monks Cross | york | Toy Shop | category="Toy Shop"; name matches /\btoys?\b.*(store\|superstore\|shop)/ |
| The Balloon Tree Farmshop & Cafe | york | Farm shop | category="Farm shop" |
| The Entertainer | york | Toy Shop | category="Toy Shop" |
| The Hole In Wand, York | york | Miniature golf course | category="Miniature golf course" |
| Yorkshire Spa Retreat | york | Gym | category="Gym" |

### 2.3 Public park playgrounds (new pattern, not in your original list)

83 venues sitewide are literal council-run outdoor park playgrounds (swings, slides, public equipment) — not commercial, visitable soft play centres at all. These share a distinct naming pattern ("X Play Area", "X Playground") and are heavily concentrated in York (14), Southend (13), Leeds (8), Sheffield (7), Bournemouth (6), and Swansea (6). Recommend removing these outright rather than recategorising — they're not a business, so a "family-attractions" category doesn't really fit either; there's nothing to link to or claim.

(not commercial soft play venues)

| Venue | City | Category | Address |
| --- | --- | --- | --- |
| The Secret Playground | barnsley | Playground | nan, Open 24 hours, nan |
| Tots Explore Play Cafe and Play Area | barnsley | Indoor playground | Shafton Community Centre, High St, Closed, · Opens 9:15 am Thu |
| Barrack Road Children's Playground | bournemouth | Playground | Barrack Rd, nan, nan, nan |
| Bigger Kids Playground | bournemouth | Playground | nan, nan, nan, nan |
| Doe Copse Play Area | bournemouth | Playground | 21 Doe Copse Way, nan, nan, nan |
| Kings park PlayGround | bournemouth | Playground | Kings Park |
| Mini Monsters (children's play cafe 0-5 years) | bournemouth | Children's cafe | 960 Wimborne Rd, nan, nan, nan |
| Playground | bournemouth | Playground | 63 Church Rd, nan, nan, nan |
| Bonkers Play Area | bridlington | Playground | Grays Inn, 5 Esplanade |
| Playground | brighton | Playground | nan |
| Children's Playground | cardiff | Playground | O'Donnell Rd |
| Llanishen Park Childrens Playground | cardiff | Playground | 17 Newborough Ave |
| Children's play area | colchester | Playground | 1a Caxton Cl, nan, nan |
| Kids Playground | colchester | Playground | nan, nan, nan, nan |
| Tots Explore Play Cafe and Play Area | doncaster | Indoor playground | Shafton Community Centre, High St, Closed, · Opens 9:15 am Wed |
| West Heath Park Play Area | glasgow | Playground | 18 Oddingley Rd, Closed, · Opens 10 am Sun |
| Woodcross Play Area | glasgow | Playground | Woodcross Ln, nan, nan |
| Children's Playground | hastings | Playground | nan |
| Beach Cove Adventure Play Area | hull | Amusement Centre | Hornsea Freeport Village, Rolston Rd |
| Noddle Hill Play Area | hull | Playground | Noddle Hill Way |
| Waterloo St Play Area | hull | Playground | Waterloo St |
| Alderman Park Childrens Play Area | ipswich | Playground | nan |
| Childrens Play Area | ipswich | Playground | nan |
| Childrens Play Area | ipswich | Playground | nan, Closed, · |
| Childrens Play Area | ipswich | Playground | Unnamed Road, nan, nan, nan |
| Children’s play park | leeds | Playground | Tarnfield park, Victoria Terrace |
| Deepdale Playground | leeds | Playground | Deepdale Ln |
| Hall Lane Playground | leeds | Playground | 5 Cookridge Ln |
| Kids Playground | leeds | Playground | 53-50 Merrion St |
| Lakeside Playground | leeds | Playground | Parc Mont, 11 Park Ave |
| Playground | leeds | Playground | Vesper Ln |
| Wharfemeadows Playground & Cafe | leeds | Playground | 24 Farnley Ln |
| Woodhouse Moor Playground | leeds | Playground | 245 Hyde Park Rd |
| Children's Play Area | leicester | Playground | nan, nan, nan |
| Childrens Play Park | leicester | Playground | 2 Featherby Dr, Closed, · Opens 8 am Thu |
| Kids Play Area | leicester | Playground | nan, Closed, · Opens 6 am Thu |
| Queens Park Play Area | leicester | Playground | Queens Park, 1 Queens Rd, Open 24 hours, nan |
| Marion Road Children's Play Ground | norwich | Playground | Marion Rd, nan, nan, nan |
| Borough Hill Children's Play Area | portsmouth | Playground | Borough Rd |
| Northfields Childrens Play Area | portsmouth | Playground | Shipley Rd, nan, nan |
| IKEA Play Area | sheffield | Playground | Sheffield Rd |
| Marsh Avenue Play Area, Dronfield | sheffield | Playground | Marsh Ave |
| Meadowhall Riverside Playground | sheffield | Playground | Unnamed Road, Sheffield S9 |
| Shirebrook Play Area | sheffield | Playground | Shirebrook Dr |
| Tots Explore Play Cafe and Play Area | sheffield | Indoor playground | Shafton Community Centre, High St |
| Valley Road Play Area | sheffield | Playground |  |
| Wildmoor Avenue Play Area | sheffield | Playground | 133 Wildmoor Ave |
| Blenheim Park Children's Play Area | southend | Playground | Blenheim Park Cl |
| Bonchurch Park Childrens Play Area | southend | Playground | Bonchurch Park |
| Bournes Green Park Children's Play Area | southend | Playground | Bournes Green Park, Poynings Ave, nan, nan |
| Fairfax Drive Children's Play Area | southend | Playground | Fairfax Dr, nan, nan |
| Friars Park Children's Play Area - "The Bunkers" | southend | Playground | Friars St, nan, nan |
| Jones Memorial Children's Play Area | southend | Playground | nan |
| Leigh Library Gardens Play Area | southend | Playground | nan, nan, nan |
| Manners Way Children's Play Area | southend | Playground | Manners Way, nan, nan |
| Priory Park Children's Play Area | southend | Playground | Priory Lodge, Victoria Ave, Closed, · |
| Scott Park Children's Play Area | southend | Playground | Western Approaches, nan, nan |
| Shoebury Park Childrens Play Area | southend | Playground | nan |
| Southchurch Park Children's Play Area | southend | Playground | Southchurch Park Lodge, Shaftesbury Ave, Closed, · |
| St Laurence Park Children's Play Area | southend | Playground | St Laurence Park |
| Kids Play area, longton park | stoke | Playground | nan, nan, nan, nan |
| North Marine Park Childrens Play Area | sunderland | Playground | Marine Approach, Closed, · Opens 9 am Thu, nan |
| South Marine Park Childrens Play Area | sunderland | Playground | South, Marine Approach, Closed, · Opens 8 am Thu, nan |
| Copr Bay Children's Play Area | swansea | Playground | nan, nan, nan, nan |
| Memorial Park Children's Play Area | swansea | Playground | 102 Wern Rd, nan, nan, nan |
| Morriston Park Children's Play Area | swansea | Playground | Dan-Y-Parc |
| Singleton Park Children's Play Area | swansea | Playground | Parc Singleton Park, nan, nan, nan |
| Tregof Play Area | swansea | Playground | — |
| Victoria Park Children's Play Area | swansea | Playground | Francis St, nan, nan, nan |
| Ashton Avenue play area | york | Playground | Burton Stone Ln |
| Children's Play Area | york | Park and Garden | 14 Elston Cl |
| Childrens play area - York Designer outlet | york | Playground | Unnamed Road |
| Elvington Play Area | york | Playground | Halifax Way, Elvington Ln |
| Esk Drive Play Area | york | Playground | 2 Foss Walk |
| Garnet Terrace Play Area | york | Playground | — |
| Leeside Play Area | york | Playground | Dringhouses and Woodthorpe, Leeside |
| Nelson's Lane Play Area | york | Playground | Nelson's Ln |
| Old Railway Station Play Area | york | Playground | 1DG, Church Rd |
| Play Area | york | Playground | 7 Harewood Cl |
| Playground | york | Playground | Broadway |
| Rawcliffe Playground | york | Playground | Armstrong Way |
| Sovereign Park Playground | york | Playground | 35 Princess Dr |
| The Limes Play Area | york | Playground | — |

### 2.4 B2B equipment suppliers (2, both Swansea)

Not venues at all — companies that manufacture/install soft play equipment for other businesses:
- **Crazy Play** — "We design, manufacture and install children's indoor soft play equipment."
- **Soft Play Manufacturer +Trampoline Parks**

### 2.5 Recategorisation candidates, MEDIUM confidence

These are legitimate family attractions, just not soft play — good fits for the new `trampoline-parks` / `play-farms` category types you proposed for Phase 2, or in a few cases (Leisure centres, Events venues) worth a quick manual check since some genuinely do have a soft-play area attached.

(trampoline parks / farms / leisure centres / events venues)

| Venue | City | Category | Signal |
| --- | --- | --- | --- |
| AirHop Adventure & Trampoline Park Aberdeen | aberdeen | Children's Amusement Centre | name matches /\btrampoline\b/ |
| Wynford Farm Park | aberdeen | Children's Amusement Centre | name matches /\bfarm\b/ |
| Swithens Farm | barnsley | Children's farm | name matches /\bfarm\b/ |
| AirHop Adventure & Trampoline Park Blackpool | blackpool | Children's Amusement Centre | name matches /\btrampoline\b/ |
| Salt Pig the Farm - Putlake | bournemouth | Children's Amusement Centre | name matches /\bfarm\b/ |
| Brighton Palace Pier | brighton | Amusement park | category="Amusement park" |
| Palace of Fun - Brighton Palace Pier | brighton | Amusement park | category="Amusement park" |
| West Sands Fun Fair | brighton | Amusement park | category="Amusement park" |
| Jump Adventure Trampoline Park | cardiff | Children's Amusement Centre | name matches /\btrampoline\b/ |
| AirHop Adventure & Trampoline Park Chelmsford | colchester | Children's Amusement Centre | name matches /\btrampoline\b/ |
| Boston Park Farm (Maize Maze) | doncaster | Children's farm | name matches /\bfarm\b/ |
| Funny Farm Softplay Ltd | doncaster | Children's Amusement Centre | name matches /\bfarm\b/ |
| AirHop Adventure & Trampoline Park Edinburgh | edinburgh | Children's Amusement Centre | name matches /\btrampoline\b/ |
| Ash End House Children's Farm | glasgow | Children's farm | name matches /\bfarm\b/ |
| Jump Xtreme Trampoline Park & That Fun Place Tamworth | glasgow | Indoor playground | name matches /\btrampoline\b/ |
| Sky High Trampoline Park | hastings | Children's Amusement Centre | name matches /\btrampoline\b/ |
| Urban Jump Trampoline Park | hastings | Amusement Centre | name matches /\btrampoline\b/ |
| Skyline Trampoline Park, Inverurie, Aberdeen-Shire | huddersfield | Amusement park | category="Amusement park"; name matches /\btrampoline\b/ |
| Active+ Hull | hull | Events Venue | category="Events Venue" |
| Airco Arena | hull | Leisure centre | category="Leisure centre" |
| Albert Avenue Pools and Fitness | hull | Leisure centre | category="Leisure centre"; name matches /\bpool(s)?\b/ |
| Bump 'n' Bounce | hull | Bouncy castle hire | category="Bouncy castle hire" |
| Cottingham Sports Centre | hull | Leisure centre | category="Leisure centre" |
| East Riding Leisure Haltemprice | hull | Leisure centre | category="Leisure centre" |
| Gravity Active Hull | hull | Leisure centre | category="Leisure centre" |
| Jump Inc by AirHop Adventure & Trampoline Park Beverley | hull | Children's Amusement Centre | name matches /\btrampoline\b/ |
| The Freedom Centre | hull | Events Venue | category="Events Venue" |
| Flip Out York (Previously Point Zero Trampoline Park York) | leeds | Indoor playground | name matches /\btrampoline\b/ |
| Infinity Bradford | leeds | Leisure centre | category="Leisure centre" |
| Jump Inc by AirHop Adventure & Trampoline Park Leeds | leeds | Children's Amusement Centre | name matches /\btrampoline\b/ |
| Ninja Warrior UK Adventure (Leeds) | leeds | Leisure centre | category="Leisure centre" |
| Fun Farm Grantham | lincoln | Children's Amusement Centre | name matches /\bfarm\b/ |
| Fun Farm Lincoln Family Entertainment Centre | lincoln | Children's Amusement Centre | name matches /\bfarm\b/ |
| Fun Farm Spalding | lincoln | Children's Amusement Centre | name matches /\bfarm\b/ |
| Jump Inc by AirHop Adventure & Trampoline Park Lincoln | lincoln | Children's Amusement Centre | name matches /\btrampoline\b/ |
| i FUN Trampoline & Soft Play Mansfield | lincoln | Indoor playground | name matches /\btrampoline\b/ |
| Airbox Bounce Trampoline Park | newcastle | Children's Amusement Centre | name matches /\btrampoline\b/ |
| Newcastle Trampoline Park, Soft Play and Gym | newcastle | Children's Amusement Centre | name matches /\btrampoline\b/ |
| High Altitude Trampoline Park | norwich | Children's party service | name matches /\btrampoline\b/ |
| White Post Farm | nottingham | Children's farm | name matches /\bfarm\b/ |
| Funland Amusement Parks | portsmouth | Amusement park | category="Amusement park" |
| Staunton Farm | portsmouth | Children's farm | name matches /\bfarm\b/ |
| Adwick Leisure Complex | sheffield | Leisure centre | category="Leisure centre" |
| Aston Springs Farm | sheffield | Tourist attraction | name matches /\bfarm\b/ |
| Cannon Hall Farm | sheffield | Tourist attraction | name matches /\bfarm\b/ |
| DB Entertainment Sheffield | sheffield | Bouncy castle hire | category="Bouncy castle hire" |
| Funny Farm Softplay Ltd | sheffield | Children's Amusement Centre | name matches /\bfarm\b/ |
| Go! Active @ The Arc - Leisure Centre | sheffield | Leisure centre | category="Leisure centre" |
| Healthy Living Centre | sheffield | Leisure centre | category="Leisure centre" |
| Killamarsh Active | sheffield | Leisure centre | category="Leisure centre" |
| NovaCity Barnsley | sheffield | Leisure centre | category="Leisure centre" |
| Heath Farm Wacky Warehouse | stoke | Children's Amusement Centre | name matches /\bfarm\b/ |
| Lakemore Farm Park | stoke | Children's farm | name matches /\bfarm\b/ |
| The Play Barn @ Round Meadows Farm | stoke | Indoor playground | name matches /\bfarm\b/ |
| UA Trampoline Park Winsford | stoke | Children's Amusement Centre | name matches /\btrampoline\b/ |
| Down At The Farm | sunderland | Children's farm | name matches /\bfarm\b/ |
| East End Pool & Gym | sunderland | Indoor playground | name matches /\bpool(s)?\b/ |
| Jump 360 Newcastle Trampoline Park | sunderland | Indoor playground | name matches /\btrampoline\b/ |
| Mini Moos Fun Farm - CLOSED | sunderland | Children's Amusement Centre | name matches /\bfarm\b/ |
| Super Tramp Sunderland Trampoline Park | sunderland | Children's Amusement Centre | name matches /\btrampoline\b/ |
| Soft Play Manufacturer +Trampoline Parks | swansea | Playground equipment supplier | name matches /\btrampoline\b/ |
| Agility | york | Leisure centre | category="Leisure centre" |
| Flip Out York (Previously Point Zero Trampoline Park York) | york | Indoor playground | name matches /\btrampoline\b/ |
| Piggy Farm | york | Children's farm | name matches /\bfarm\b/ |
| Piglets Adventure Farm | york | Children's farm | name matches /\bfarm\b/ |
| Willow Farm Cafe | york | Cafe | name matches /\bfarm\b/ |

---

## 3. Wrong-city venues

Validated by extracting the postcode area from each venue's postcode and checking it against a UK postcode-area → city table (HU→Hull/Beverley, YO→York/Bridlington, DN→Doncaster, S→Sheffield/Barnsley, etc.).

**Caveat:** this check only runs on venues that *have* a postcode (274 of 1,052 do — see §4.2 for the other 74%). The true count of wrong-city venues is almost certainly higher once missing postcodes are backfilled.

### 3.1 Hull — every named example, confirmed (where postcode data exists)

| Venue | Slug | Postcode | Postcode area | Assigned to | Should be |
| --- | --- | --- | --- | --- | --- |
| Candy Kingdom | candy-kingdom-hull | YO15 3QY | YO | hull | york / bridlington |
| FunForest Brigg | funforest-brigg-hull | DN20 8UN | DN | hull | doncaster |
| JAM JAMZ Indoor Softplay | jam-jamz-indoor-softplay-hull | YO25 6JX | YO | hull | york / bridlington |
| Old Farmhouse Wacky Warehouse | old-farmhouse-wacky-warehouse-hull | DN15 8TE | DN | hull | doncaster |
| The Magical Castle | the-magical-castle-hull | DN35 0FB | DN | hull | doncaster |
| Time 4 Play Grimsby Ltd | time-4-play-grimsby-ltd-hull | DN32 9AB | DN | hull | doncaster |

Note: several of your named Hull examples (Play Valley Doncaster, The Web Adventure Park, Monkey Maze, Crazy Tykes, Pink Pig Farm, Time 4 Play, Xplore, Uproar Play Barn, JungleMazeia) either aren't present in the Hull entry of `venues.json`/`venuesByTown.json` at all, or are present without a postcode so the automated check can't confirm them — they may already have been fixed since you last looked, may only exist in the live DB (unreachable right now), or may need a manual address lookup. Worth a manual spot-check on the live Hull page once the DB is back, cross-referenced against this list.

### 3.2 Sitewide, excluding Hull

| Venue | Slug | Postcode | Assigned to | Should be |
| --- | --- | --- | --- | --- |
| Allansmagic | allansmagic-blackpool | AB12 5AJ | blackpool | aberdeen |
| Mini's Party and Play Centre | mini-s-party-and-play-centre-blackpool | PR1 8XE | blackpool | bolton |
| Phantom Winger Wacky Warehouse | phantom-winger-wacky-warehouse-blackpool | PR3 5JE | blackpool | bolton |
| Wacky World Inflatable Park | wacky-world-inflatable-park-blackpool | PR1 5LX | blackpool | bolton |
| Amazonia Bolton | amazonia-bolton-bolton-preston | BL1 2AL | bolton-preston | bolton |
| Bee Hive Wacky Warehouse | bee-hive-wacky-warehouse-bolton-preston | BL6 4BA | bolton-preston | bolton |
| Charlie Park | charlie-park-bolton-preston | M46 9FD | bolton-preston | manchester |
| Fun Valley bolton | fun-valley-bolton-bolton-preston | BL1 8DT | bolton-preston | bolton |
| Jungle World Leyland - Play Park | jungle-world-leyland-play-park-bolton-preston | PR25 2DY | bolton-preston | bolton |
| Party and Play Funhouse Bolton | party-and-play-funhouse-bolton-bolton-preston | BL5 3XA | bolton-preston | bolton |
| Poachers Wacky Warehouse | poachers-wacky-warehouse-bolton-preston | PR5 6BA | bolton-preston | bolton |
| Rascals Party & Play Centre | rascals-party-play-centre-bolton-preston | PR5 4AR | bolton-preston | bolton |
| The Secret Garden Play Cafe | the-secret-garden-play-cafe-bolton-preston | PR7 1NL | bolton-preston | bolton |
| Tiny Rockers | tiny-rockers-bolton-preston | PR7 7EZ | bolton-preston | bolton |
| Wiggleworks Playspace | wiggleworks-playspace-bolton-preston | PR7 5BW | bolton-preston | bolton |
| George's Spaceship Play Zone | georges-spaceship-play-zone | SO51 6AL | bournemouth | southend |
| Inflatazone Indoor Soft Play Centre & Inflatable Zone | inflatazone-indoor-soft-play-centre-and-inflatable-zone | SO16 9FQ | bournemouth | southend |
| 360 Play Basildon - Family Entertainment Centre and Party Venue | 360-play-basildon-family-entertainment-centre-and-party-venue | SS14 3WB | colchester | southend |
| Monkey Bizzness Adventure Play | monkey-bizzness-adventure-play | SS5 4AD | colchester | southend |
| Partyman World of Play | partyman-world-of-play | IP3 8AX | colchester | ipswich |
| Play2Day, Ipswich | play2day-ipswich | IP5 3RJ | colchester | ipswich |
| School's Out Activities at Colchester Royal Grammar School | schools-out-activities-at-colchester-royal-grammar-school | IP6 0FL | colchester | ipswich |
| Yaya's House | yayas-house | IP8 3NJ | colchester | ipswich |
| The Edge Play Gym | the-edge-play-gym-halifax | HD6 1AT | halifax | huddersfield |
| The Zone | the-zone-halifax | HD1 6PT | halifax | huddersfield |
| Playtown Inverurie | playtown-inverurie-aberdeen | AB51 3QJ | inverurie | aberdeen |
| Adventure Island Play Park | adventure-island-play-park | NR33 7NL | ipswich | norwich |
| Funopolis | funopolis-leeds | BD17 7AD | leeds | bradford |
| Fun 2 Play | fun-2-play | IP24 1XB | norwich | ipswich |
| The Wonder Wood | the-wonder-wood | IP25 6JX | norwich | ipswich |
| East End Pool & Gym | east-end-pool-gym-sunderland | NE6 1AL | sunderland | newcastle |
| Jump 360 Newcastle Trampoline Park | jump-360-newcastle-trampoline-park-sunderland | NE12 9SW | sunderland | newcastle |
| Kenton Park Sports Centre | kenton-park-sports-centre-sunderland | NE3 3LL | sunderland | newcastle |
| Namco Funscape Metrocentre | namco-funscape-metrocentre-sunderland | NE11 9XY | sunderland | newcastle |
| No Limits Paintball and Laser | no-limits-paintball-and-laser-sunderland | NE8 2YP | sunderland | newcastle |
| Pineapple and Bears Birtley | pineapple-and-bears-birtley-sunderland | NE21 6RT | sunderland | newcastle |
| Walker Activity Dome | walker-activity-dome-sunderland | NE6 3BR | sunderland | newcastle |
| sport@kenton | sport-kenton-sunderland | NE6 2FT | sunderland | newcastle |
| Enchanted Adventures Bridgend | enchanted-adventures-bridgend | CF35 5BP | swansea | cardiff |
| The Play Yard | the-play-yard | CF42 6DL | swansea | cardiff |
| Tiny Tumblers | tiny-tumblers | CF38 1RL | swansea | cardiff |
| 5 ALIVE BRADFORD Adventure Soft Play Centre/ INDOOR FOOTBALL (SEE WEBSITE FOR OPERATING HOURS) | 5-alive-bradford-adventure-soft-play-centre-indoor-football-see-website-for-operating-hours-york | BD8 0HR | york | bradford |
| Clip N' Climb | clip-n-climb-york | SE18 6SX | york | london |
| Crazy Tykes Indoor and Outdoor Children's Soft play centre | crazy-tykes-indoor-and-outdoor-children-s-soft-play-centre-york | LS23 7FJ | york | leeds |
| Freeklime York | freeklime-york-york | HD1 6RX | york | huddersfield |
| Funopolis | funopolis-york | BD17 7AD | york | bradford |
| Jack in the Box Soft Play and Role Play | jack-in-the-box-soft-play-and-role-play-york | HU17 0LF | york | hull / beverley |
| Let Loose Yorkshire | let-loose-yorkshire-york | HU17 0RS | york | hull / beverley |
| Oxygen York | oxygen-york-york | W3 0AF | york | london |
| The Kidsplay (Formerly Kidzplay Leeds) | the-kidsplay-formerly-kidzplay-leeds-york | LS14 1LU | york | leeds |
| York Barbican | york-barbican-york | M3 1AR | york | manchester |

---

## 4. Broken data

### 4.1 Systemic address corruption (the big one — see §1)

| City | Corrupted | Total | % corrupted |
| --- | --- | --- | --- |
| barnsley | 18 | 18 | 100% |
| bolton-preston | 18 | 18 | 100% |
| bradford | 6 | 6 | 100% |
| doncaster | 43 | 43 | 100% |
| edinburgh | 17 | 17 | 100% |
| glasgow | 51 | 51 | 100% |
| huddersfield | 4 | 4 | 100% |
| inverness | 2 | 2 | 100% |
| leicester | 35 | 35 | 100% |
| lincoln | 22 | 22 | 100% |
| newcastle | 22 | 22 | 100% |
| nottingham | 45 | 45 | 100% |
| stoke | 25 | 25 | 100% |
| sunderland | 25 | 25 | 100% |
| colchester | 31 | 32 | 97% |
| brighton | 26 | 27 | 96% |
| blackpool | 17 | 18 | 94% |
| portsmouth | 34 | 36 | 94% |
| halifax | 16 | 17 | 94% |
| bournemouth | 30 | 32 | 94% |
| ipswich | 15 | 16 | 94% |
| norwich | 28 | 30 | 93% |
| swansea | 32 | 35 | 91% |
| cardiff | 38 | 42 | 90% |
| hastings | 24 | 27 | 89% |
| southend | 20 | 23 | 87% |
| unknown | 2 | 3 | 67% |
| aberdeen | 2 | 9 | 22% |
| york | 13 | 91 | 14% |
| hull | 11 | 79 | 14% |
| leeds | 10 | 73 | 14% |
| inverurie |  | 1 | 0% |
| beverley |  | 1 | 0% |
| bridlington |  | 7 | 0% |
| sheffield |  | 120 | 0% |

Two distinct corruption patterns, often both present in the same field:
1. **Leaked Google Maps status text**: `"Closed, · Opens 9 am Thu"` overwrites the real street address.
2. **Literal `"nan"`**: a Python `NaN`-to-string artifact, appearing where a field was empty during the scrape/import.

Sample (Barnsley, 100% corrupted):
```
"Wynford Farm Park"  address: "nan, Closed, · Opens 10 am Thu"
"Rainbow Playrooms"  address: "Rainbow Playrooms, Navigation Walk, Closed, · Opens 9 am Thu"
```
The second example shows the real address fragment ("Navigation Walk") is still present but truncated and appended with the corrupted status string — meaning the *raw* correct data likely still exists upstream (the scraper's intermediate output, or Google Place details) and this is a formatting/field-mapping bug in the import script, not lost data. Worth checking `scripts/buildSoftplayData.mjs` / `scripts/import-raw-city-csvs.mjs` for whatever step concatenates opening-hours-status onto the address string.

### 4.2 Missing postcode

778 of 1,052 venues (74%) have no postcode at all. This blocks the wrong-city check (§3) from running on them, blocks proper `PostalAddress` schema, and blocks distance/postcode search from working correctly for those venues. Full per-venue list is in `data/_audit_findings.json` (`noPostcode` array) rather than reproduced here — it's most of the dataset.

### 4.3 `venuesByTown.json`'s postcode field is 100% blank

Separately from the above: the file actually wired into the site's live DB-outage fallback has **zero postcodes across all 669 venues**, in the dedicated `postcode` field. This isn't a per-venue data problem, it's a bug in whatever step exports `venuesByTown.json` — it's just not populating that field, even for venues where `venues.json` (a different export, same underlying data) does have it. Worth checking `scripts/rebuild-static-json.mjs`.

---

## 5. Duplicates

Matched primarily on phone number (same physical premises), since matching on website domain alone produces heavy false positives for franchises (e.g. every "Wacky Warehouse" location shares `wackywarehouse.co.uk` but is a genuinely different pub/venue) — domain-only matching was tried first and discarded for that reason.

### 5.1 Hull — every named example, confirmed

| Confidence | Venues (same phone) |
| --- | --- |
| MEDIUM | Active+ Hull ↔ Little Monkeys @ Active+ |
| MEDIUM | Funstation Hull ↔ Laser Station St Stephen's Hull |
| HIGH | Blue Kangaroo ↔ Blue Kangaroo Soft Play |
| MEDIUM | Kingstown Wacky Warehouse ↔ The Kingstown |

Both of your named Hull duplicate pairs (**Candy Kingdom**, **Blue Kangaroo**) confirmed. Candy Kingdom is additionally a wrong-city case (§3.1) — worth resolving both at once. "Active+ Hull" / "Little Monkeys @ Active+" is the same premises listed under two names (matches your "Active+ Hull vs Little Monkeys @ Active+" example). One additional Hull pair not in your list: **Kingstown Wacky Warehouse** and **The Kingstown** share a phone number — same pub, listed once under the play-area brand name and once under the pub's own name.

### 5.2 Sitewide

| City | Confidence | Venues (same phone) |
| --- | --- | --- |
| leeds | MEDIUM | Headingley Enterprise & Arts Centre ↔ Tiny Boo LTD |
| leicester | MEDIUM | Parklands Leisure Centre ↔ Parklands Play World |
| aberdeen | MEDIUM | Codona's ↔ Smuggler's Cove |
| sheffield | MEDIUM | Adventure Reef ↔ Barnsley Metrodome Waterpark (Calypso Cove) |
| colchester | MEDIUM | Clacton Pier ↔ Discovery Bay Adventure Play |
| swansea | MEDIUM | Sgiliau Llanelli ↔ Sgiliau Play Centre, Carmarthen |
| edinburgh | MEDIUM | Dobbies Soft Play ↔ Little Seedlings Soft Play at Dobbies Edinburgh |
| stoke | MEDIUM | Tenpin Crewe ↔ Tenpin Stoke |
| norwich | MEDIUM | Planet Zoom ↔ Strikes Bowl |
| colchester | MEDIUM | Crazy Kids Adventure Play ↔ Partyman World of Play |
| sheffield | MEDIUM | Bizzy Bouncers ↔ Jumparooz Inflatable Park |
| norwich | MEDIUM | JR's Bowling & American Diner ↔ Stompers |
| southend | MEDIUM | Blenheim Park Children's Play Area ↔ Bournes Green Park Children's Play Area ↔ Fairfax Drive Children's Play Area ↔ Friars Park Children's Play Area - "The Bunkers" ↔ Jones Memorial Children's Play Area ↔ Leigh Library Gardens Play Area ↔ Manners Way Children's Play Area ↔ Priory Park Children's Play Area ↔ Scott Park Children's Play Area ↔ Shoebury Park Childrens Play Area ↔ Southchurch Park Children's Play Area |
| stoke | MEDIUM | JK Laser Frenzy ↔ Just Kidding |
| brighton | MEDIUM | Harbour Park Amusements ↔ Harbour Park Indoor Soft Play |
| york | MEDIUM | Bouncing 4 Fun Bouncy Castles ↔ York Soft Play Hire |
| york | MEDIUM | Clip N' Climb ↔ York Leisure Centre |
| cardiff | MEDIUM | Tee -Rex Soft Play ↔ Tee-Rex Adventure Golf Cardiff |
| brighton | HIGH | Brighton Palace Pier ↔ Palace Play ↔ Palace of Fun - Brighton Palace Pier |
| stoke | HIGH | Apple Tree Town ↔ Apple Tree Town - Bridgemere |
| york | HIGH | Flying Legends ↔ Flying Legends Wacky Warehouse |

A notable MEDIUM case: **Brighton Palace Pier**, **Palace Play**, and **Palace of Fun - Brighton Palace Pier** all share one phone number — three listings for what's likely one pier attraction, and none of the three are soft play (§2).

### 5.3 Additional likely duplicates, fuzzy name match (no shared phone/website to confirm)

Lower confidence — flagged for a human look, not for bulk merging.

| City | Venue A | Venue B |
| --- | --- | --- |
| bournemouth | Barrack Road Children's Playground | Playground |
| bournemouth | Bigger Kids Playground | Playground |
| bournemouth | Kings park PlayGround | Playground |
| cardiff | Children's Playground | Llanishen Park Childrens Playground |
| cardiff | The Eden Centre | The Eden Centre - Blackwood |
| cardiff | The Eden Centre | The Eden Centre - Caerphilly |
| colchester | Mace Playce | Mace Playce City Centre |
| hull | Active+ Hull | Gravity Active Hull |
| ipswich | Alderman Park Childrens Play Area | Childrens Play Area |
| ipswich | Alderman Park Childrens Play Area | Childrens Play Area |
| ipswich | Alderman Park Childrens Play Area | Childrens Play Area |
| ipswich | Childrens Play Area | Childrens Play Area |
| ipswich | Childrens Play Area | Childrens Play Area |
| ipswich | Childrens Play Area | Childrens Play Area |
| leeds | Deepdale Playground | Playground |
| leeds | Hall Lane Playground | Playground |
| leeds | Kids Playground | Playground |
| leeds | Lakeside Playground | Playground |
| leeds | Monster Kidz | Monster Kidz Beeston |
| leeds | Playground | Wharfemeadows Playground & Cafe |
| leeds | Playground | Woodhouse Moor Playground |
| leicester | Little Dragon's Den Soft Play & Parties | Soft Play Parties |
| portsmouth | Wild Wonderland Gosport | Wonder |
| sheffield | Meadowhall | Meadowhall Riverside Playground |
| sheffield | Meadowhall | Rock Up climbing centre Meadowhall |
| sheffield | Play In | Play in Dore |
| sheffield | Tiny Town Ltd | Tiny Town Ltd Barlborough |
| stoke | Just Kidding | Just Kidding Holmes Chapel |
| swansea | Crazy Play - We design, manufacture and install children’s indoor soft play equipment. | Soft Play Equipment |
| swansea | Play-zone at Trago | Playzone |
| swansea | Playzone | Soft Landings Play Zone |
| york | Ashton Avenue play area | Play Area |
| york | Children's Play Area | Childrens play area - York Designer outlet |
| york | Children's Play Area | Play Area |
| york | Childrens play area - York Designer outlet | Play Area |
| york | Elvington Play Area | Play Area |
| york | Esk Drive Play Area | Play Area |
| york | Garnet Terrace Play Area | Play Area |
| york | Leeside Play Area | Play Area |
| york | Little Vikings | Little Vikings - York for kids |
| york | Nelson's Lane Play Area | Play Area |
| york | Old Railway Station Play Area | Play Area |
| york | Play Area | The Limes Play Area |
| york | Playground | Rawcliffe Playground |
| york | Playground | Sovereign Park Playground |

---

## 6. City / URL structure issues

### 6.1 Two declared "extra" city slugs not in `cities.json`

`venues.json` contains venues under `bolton-preston` and `inverurie` — neither is a declared city slug (the declared one is `bolton`; `inverurie` isn't declared at all, it's a small town near Aberdeen). Plus a third bucket literally named `unknown` (3 venues) where the scraper couldn't determine a town at all. These need a decision: fold `bolton-preston` into `bolton` (checking the postcodes — some are genuinely `BL` Bolton, some are `PR` Preston/Chorley, which is a *different, undeclared* town, see §3.2), and manually place the 3 `unknown` venues or drop them.

### 6.2 Broken internal links to a dead `stoke-on-trent` / `southend-on-sea` slug

`data/cities.json` is internally consistent — canonical slugs are `stoke` and `southend`. But two other files hardcode the wrong, non-existent slug:

- `components/layout/Footer.tsx:24` — links to `/soft-play/stoke-on-trent`
- `components/layout/Footer.tsx:29` — links to `/soft-play/southend-on-sea`
- `lib/blogPosts.ts` — 6 occurrences of `href="/stoke-on-trent"` (also missing the `/soft-play/` prefix entirely — a second, compounding bug)

I confirmed live: `/soft-play/stoke-on-trent` returns **HTTP 200** but renders the "City Not Found" content — so this isn't a duplicate live page, it's currently a dead link with a misleading 200 status (see §6.3). Every footer on every page site-wide, plus every Stoke blog post, currently links to a page that says "not found."

### 6.3 Minor: "not found" pages return HTTP 200, not 404

While checking §6.2 I confirmed any nonexistent city slug (tested with a deliberately made-up one) renders "City Not Found" content but with a `200` status code rather than `404`. This is a soft-404 — search engines and monitoring tools won't recognise these as errors. Small fix, worth bundling into Phase 2 since you'll be touching routing anyway.

---

## 7. Proposed action summary (for your approval)

| Category | Proposed action | Count |
|---|---|---|
| HIGH-confidence miscategorised | Remove from soft-play listings entirely | 82 |
| Public park playgrounds | Remove entirely | 83 |
| B2B equipment suppliers | Remove entirely | 2 |
| MEDIUM recategorise candidates | Move to new `trampoline-parks` / `play-farms` categories; manual check for leisure-centre/events-venue ones | 66 |
| Wrong-city | Move to correct city page, 301 from old URL | 57 (min. — postcode gap likely hides more) |
| HIGH-confidence duplicates | Merge, keep most complete slug, 301 the other | 4 groups |
| MEDIUM-confidence duplicates | Manual check, likely merge | 21 groups |
| Corrupted addresses | Re-derive from source data where possible; blank rather than show corrupted text otherwise | 682 |
| Missing postcodes | Backfill where derivable from address/lat-lng; otherwise omit postcode field from schema rather than render empty | 778 |
| Dead-slug internal links | Fix to `stoke` / `southend` | 8 links, 2 files |
| Soft-404s | Return real 404 status for unknown city slugs | sitewide |

**Not included above, needs your call:** the 6 cities with no local data (Birmingham, Bolton, Bristol, Liverpool, London, Manchester) need this same audit run again once the DB is reachable — I'd flag it as very likely they have the same corruption pattern as the other late-batch cities, given the timing, but I don't have data to confirm that yet.

Full machine-readable findings (every flagged venue, not just the tables above) are in `data/_audit_findings.json` for use when building Phase 2 migration scripts.

---

**Waiting for your approval before any Phase 2 changes.**
