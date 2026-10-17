/**
 * Hand-curated, fact-checked venue lists for the Hull city hub
 * (/soft-play/hull) — separate from the live venues table, which is used
 * for the main directory grid elsewhere on the same page.
 *
 * This is Hull-specific editorial content approved 2026-09-14 (Fact Checker
 * PASS + Publisher APPROVED — see
 * newsletter-drafts-2026-09-14/hull-city-hub-copy-2026-09-14.md), not a
 * general mechanism — no other city currently has this data, and
 * CuratedVenueSections renders nothing if it's absent.
 *
 * Links go to each venue's own official site (not an internal /soft-play/
 * page) since these are curator picks with individually-verified pricing/
 * category notes that don't map onto the generic venue-card template. Do
 * not add prices/hours here beyond what's already approved — see the
 * source markdown's "NEEDS SOURCE" list for what's deliberately withheld.
 *
 * 2026-10: Lincolnshire venues (FunForest in Brigg, Magical Castle in
 * Cleethorpes, Time 4 Play in Grimsby) were removed from `nearbySection` — they
 * are not in Hull or East Yorkshire. Only East Yorkshire venues belong here.
 */

export interface CuratedVenue {
  name: string
  url: string
  category: string
  note: string
}

export interface CuratedVenueGroup {
  heading: string
  intro?: string
  venues: CuratedVenue[]
}

export const HULL_CURATED_VENUES: {
  citySection: CuratedVenueGroup
  nearbySection: CuratedVenueGroup
  notSoftPlaySection: CuratedVenueGroup
} = {
  citySection: {
    heading: 'Soft play in Hull (city)',
    intro:
      'Hull has a mix of classic soft-play frames, role-play centres, climbing with soft play, and an inflatable park. Here are the city venues we currently treat as soft play or soft-play adjacent. Prices and session times change, so check each venue\'s own website before you go.',
    venues: [
      { name: 'Little Astronauts', url: 'https://littleastronauts.co.uk/', category: 'Soft play', note: '' },
      { name: 'Big Fun', url: 'https://www.big-fun-hull.co.uk/', category: 'Soft play', note: '' },
      { name: 'East Coast Crazy Kids', url: 'https://www.crazykidssoftplay.co.uk/', category: 'Soft play', note: '' },
      { name: 'Monkey Bizness Hull', url: 'https://www.monkey-bizness.co.uk/hull/', category: 'Soft play', note: '' },
      { name: "Let's Play Hull", url: 'https://www.letsplayhull.com/', category: 'Soft play / role play', note: 'Fantasy village with a baby soft-play area. Official admission examples: children (1–7) £7; babies (0–11 months) £5; adults £2 (90-minute sessions).' },
      { name: 'Crazy Club at Superbowl UK Hull', url: 'https://www.superbowluk.co.uk/hull/crazy-club/', category: 'Soft play', note: 'At Princes Quay. Official Crazy Club examples: off-peak under-1s £2 / ages 1+ £6.50 (adults free); peak under-1s £2 / ages 1+ £7.50 (adults £1).' },
      { name: 'Ping Pong Tots Hull', url: 'https://www.pingpongtotshull.co.uk/', category: 'Soft play / role play', note: 'Midweek soft-play pricing has been published at £10.' },
      { name: 'Little Monkeys @ Active+', url: 'https://www.active-plus.uk/', category: 'Soft play', note: 'Soft-play prices aren’t published clearly on the venue’s own website — ask the venue or book through their channels.' },
      { name: 'Adventure Play Town', url: 'https://adventureplaytown.co.uk/', category: 'Role play', note: 'Imagination town (soft-play adjacent). Official Plan Your Visit: child £6.50; adults £2.50; baby/pre-walker free (90-minute sessions).' },
      { name: 'Rock Up Hull', url: 'https://www.rock-up.co.uk/locations/hull', category: 'Climbing + soft play', note: "St Stephen's. Soft play is offered alongside climbing; book for soft-play ticket prices rather than assuming a fixed walk-up tariff." },
      { name: 'Inflata Nation Hull', url: 'https://www.inflatanation.com/locations/hull/', category: 'Inflatable park', note: 'Pricing is booking/dynamic — book on the official location page for current prices.' },
    ],
  },
  nearbySection: {
    heading: 'Near Hull / East Yorkshire',
    intro: 'A short drive from Hull opens more options across East Yorkshire.',
    venues: [
      { name: 'Our Imagination Station', url: 'https://www.ourimaginationstation.co.uk/', category: 'Soft play · Hessle', note: '' },
      { name: 'Jack in the Box Soft Play and Role Play', url: 'https://www.jackintheboxclub.co.uk/', category: 'Soft play · Beverley', note: 'With separate role play. Timed and term-time tariffs are published on their times-and-prices page.' },
      { name: 'Blue Kangaroo', url: 'https://www.bluekangarooplay.co.uk/', category: 'Soft play · Cottingham', note: 'Ages roughly 0–8. Official examples include adults £2; 0–8 months free; 9–12 months £4; 1–8 years £6.95.' },
      { name: 'The Secret Village', url: 'https://thesecretvillage.co.uk/', category: 'Role play · Anlaby', note: '' },
      { name: 'Kingstown Wacky Warehouse', url: 'https://www.wackywarehouse.co.uk/play-area/east-riding-yorkshire/kingstown-hotel', category: 'Soft play · Hedon', note: 'Official examples include around £5 general play / £3.50 for tots.' },
      { name: 'Beach Cove Adventure Play Area', url: 'https://hornseavillage.com/food-leisure/beach-cove/', category: 'Soft play · Hornsea', note: 'Indoor + outdoor at Hornsea Village.' },
      { name: 'Candy Kingdom', url: 'https://www.candy-kingdom.com/', category: 'Soft play / indoor adventure · Carnaby / Bridlington', note: 'Admission costs are published on the official site (term-time vs weekend/holiday rates).' },
    ],
  },
  notSoftPlaySection: {
    heading: 'Not soft play (optional related)',
    intro:
      'Nearby attractions sometimes appear in "soft play Hull" searches but are not counted as Hull soft play here. Useful days out — different category.',
    venues: [
      { name: 'Funstation Hull', url: 'https://www.funstationuk.com/locations/hull', category: 'Arcade / FEC', note: '' },
      { name: 'Gravity Active Hull', url: 'https://gravity-global.com/active/hull', category: 'Trampoline park', note: '' },
      { name: "William's Den", url: 'https://www.williamsden.co.uk/adventure-play', category: 'Adventure play · North Cave', note: 'States on its own site it is not soft play.' },
      { name: 'Let Loose Yorkshire', url: 'https://letlooseyorkshire.co.uk/', category: 'Open days · Woodmansey', note: 'Runs open days rather than daily soft-play drop-in.' },
    ],
  },
}
