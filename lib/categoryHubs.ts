/**
 * National category hubs (SEO Phase 5, 25 Nov 2026): /toddler-soft-play, /baby-soft-play,
 * /sen-soft-play, /play-cafes and /soft-play-parties.
 *
 * Search Console (3 months to 24 Nov 2026) shows national "near me" demand for each of
 * these with no page built for it: "play cafe near me" (683 impressions), "baby soft play"
 * (609), "soft play parties near me" (402), "soft play near me for toddlers" (381),
 * "sen soft play near me" (48, but at position 6.7). The per-city filter pages only
 * answer "<need> in <city>"; these pages answer the national query and route to them.
 *
 * A venue is listed only on what we hold for it: a facility flag (set from the venue's
 * own website, its owner, or our checks), an age range from its site, or its own name
 * ("… Play Cafe"). Nothing is inferred from venue type or reviews. Every answer and
 * count on the page is computed from the listed venues, so the copy can't drift from
 * the data.
 */

export type HubSlug = 'toddler-soft-play' | 'baby-soft-play' | 'sen-soft-play' | 'play-cafes' | 'soft-play-parties'

/** The per-city filter page that covers the same need, if there is one. */
export type CityFilterSlug = 'toddler' | 'sen-friendly' | 'birthday-parties'

export interface HubVenue {
  name: string
  slug: string
  city_slug: string
  city?: string | null
  town?: string | null
  rating?: number | string | null
  reviews_count?: number | null
  toddler_area?: boolean | null
  baby_area?: boolean | null
  under_1s?: boolean | null
  has_under_1s?: boolean | null
  sen_friendly?: boolean | null
  has_sen_sessions?: boolean | null
  parties?: boolean | null
  cafe?: boolean | null
  age_range_min?: number | null
  age_range_max?: number | null
  price_from?: number | string | null
  prebooking_required?: boolean | null
}

export interface HubGuideLink {
  href: string
  label: string
}

export interface HubConfig {
  slug: HubSlug
  /** Short name used in headings and links ("toddler soft play"). */
  label: string
  h1: string
  title: (count: number) => string
  description: (count: number, places: number) => string
  intro: string[]
  /** What "listed here" means for this hub, shown under the intro. */
  basis: string
  choosing: { heading: string; points: string[] }
  cityFilter?: CityFilterSlug
  guides: HubGuideLink[]
  matches: (v: HubVenue) => boolean
  /** Ask the entry-price question (off for parties: we hold entry prices, not party prices). */
  priceFaq?: boolean
  /** Why this venue is on the page, in a few words. */
  reason: (v: HubVenue) => string
}

const PLAY_CAFE_NAME = /play ?caf[eé]/i

export const isPlayCafeName = (name: string) => PLAY_CAFE_NAME.test(name)

const ages = (v: HubVenue) =>
  v.age_range_min != null && v.age_range_max != null ? `ages ${v.age_range_min}–${v.age_range_max}` : ''

export const HUBS: Record<HubSlug, HubConfig> = {
  'toddler-soft-play': {
    slug: 'toddler-soft-play',
    label: 'toddler soft play',
    h1: 'Toddler Soft Play Near You',
    title: (n) => `Toddler Soft Play Near Me: ${n} UK Venues with Toddler Areas`,
    description: (n, places) =>
      `${n} soft play centres in ${places} UK towns and cities with a separate toddler area or play aimed at under-6s. Find one near you and check ages, prices and facilities.`,
    intro: [
      'A toddler on the main frame of a big soft play centre spends a lot of the session being overtaken by eight-year-olds. What makes a venue work for under-4s is a separate toddler area: low platforms, short slides and a ball pit they can manage on their own, fenced off from the big frame.',
      'Every venue below has a toddler area, or is aimed entirely at young children (its stated age range tops out at 6 or under). Pick a town to see the full list for that area.',
    ],
    basis: 'Listed when the venue’s website, its owner or our own checks confirm a toddler area, or the venue’s stated age range tops out at 6 or under.',
    choosing: {
      heading: 'What to look for in toddler soft play',
      points: [
        'A toddler area that is physically separate from the main frame, with its own entrance, not just a corner of it.',
        'Sightlines from the seating: can you see the toddler area from where you will sit?',
        'Session length and price for under-2s. Many venues charge less for (or don’t charge) babies and young toddlers, but it varies, so check the venue page.',
        'Whether the venue runs term-time toddler sessions, when older children are at school.',
      ],
    },
    cityFilter: 'toddler',
    guides: [
      { href: '/blog/baby-and-toddler-soft-play-uk', label: 'Baby and toddler soft play: a UK guide' },
      { href: '/blog/play-cafes-uk-guide', label: 'Play cafés: what they are and where to find them' },
      { href: '/baby-soft-play', label: 'Baby-friendly soft play' },
    ],
    matches: (v) => v.toddler_area === true || (v.age_range_max != null && v.age_range_max <= 6),
    reason: (v) => [v.toddler_area ? 'toddler area' : '', ages(v)].filter(Boolean).join(' · '),
  },
  'baby-soft-play': {
    slug: 'baby-soft-play',
    label: 'baby soft play',
    h1: 'Baby-Friendly Soft Play Near You',
    title: (n) => `Baby Soft Play Near Me: ${n} UK Venues with Baby Areas`,
    description: (n, places) =>
      `${n} soft play centres in ${places} UK towns and cities with a dedicated baby area or under-1s play. Find baby-friendly soft play near you.`,
    intro: [
      'Babies who can sit, roll or crawl get a lot from soft play, but not from the main frame. A baby area is a small, enclosed space with soft mats, sensory toys and nothing for a running child to land on them from.',
      'Every venue below has a baby area or a space for under-1s. Some are play cafés built around babies and toddlers; others are larger centres with a baby zone.',
    ],
    basis: 'Listed when the venue’s website, its owner or our own checks confirm a baby area or play space for under-1s.',
    choosing: {
      heading: 'What to look for with a baby',
      points: [
        'An enclosed baby area that older children can’t wander into.',
        'Baby changing, and somewhere comfortable to feed.',
        'What under-1s cost. Some venues charge less for babies or let them in free with a paying sibling; the venue page shows any prices we hold.',
        'Pushchair access and parking near the entrance.',
      ],
    },
    cityFilter: 'toddler',
    guides: [
      { href: '/blog/baby-and-toddler-soft-play-uk', label: 'Baby and toddler soft play: a UK guide' },
      { href: '/toddler-soft-play', label: 'Toddler soft play' },
      { href: '/play-cafes', label: 'Play cafés' },
    ],
    matches: (v) => v.baby_area === true || v.under_1s === true || v.has_under_1s === true,
    reason: (v) => [v.baby_area ? 'baby area' : 'under-1s play', ages(v)].filter(Boolean).join(' · '),
  },
  'sen-soft-play': {
    slug: 'sen-soft-play',
    label: 'SEN soft play',
    h1: 'SEN and Sensory-Friendly Soft Play Near You',
    title: (n) => `SEN Soft Play Near Me: ${n} SEN-Friendly UK Venues`,
    description: (n, places) =>
      `${n} soft play centres in ${places} UK towns and cities that run SEN sessions or describe themselves as SEN-friendly. Find SEN and sensory soft play near you.`,
    intro: [
      'For many children with autism, ADHD, sensory processing differences or physical disabilities, an ordinary soft play session is too loud, too busy or too unpredictable. SEN sessions change that: fewer children, music off or down, lights dimmed, and staff who expect children to play differently.',
      'Every venue below either runs SEN sessions or says it is SEN-friendly. Session days change often, so check with the venue before you travel.',
    ],
    basis: 'Listed when the venue’s website, its owner or our own checks confirm SEN sessions or SEN-friendly provision. A venue marked “SEN sessions” has advertised dedicated sessions; “SEN-friendly” means it describes itself that way.',
    choosing: {
      heading: 'Questions worth asking before an SEN visit',
      points: [
        'When the SEN sessions run, how many children they take, and whether you need to book.',
        'Whether music and lighting are changed for the session, and whether there is a quiet or sensory room.',
        'What a carer pays. Some venues let a carer in free; ask whether they accept a carer card or need proof.',
        'Wheelchair access to the play frame and toilets, if that matters for your child.',
      ],
    },
    cityFilter: 'sen-friendly',
    guides: [
      { href: '/blog/sen-friendly-soft-play-uk', label: 'SEN-friendly soft play: a UK guide' },
      { href: '/toddler-soft-play', label: 'Toddler soft play' },
    ],
    matches: (v) => v.sen_friendly === true || v.has_sen_sessions === true,
    reason: (v) => (v.has_sen_sessions ? 'SEN sessions' : 'SEN-friendly'),
  },
  'play-cafes': {
    slug: 'play-cafes',
    label: 'play cafés',
    h1: 'Play Cafés Near You',
    title: (n) => `Play Cafe Near Me: ${n} UK Play Cafés for Babies and Toddlers`,
    description: (n, places) =>
      `${n} play cafés in ${places} UK towns and cities: smaller, calmer play spaces with a proper café, mostly for babies and under-5s. Find a play café near you.`,
    intro: [
      'A play café is a smaller, calmer version of soft play, built around a café rather than a giant frame. Most are aimed at babies and under-5s, with role-play areas, small soft play structures and sensory toys, and seating close enough to watch while you drink a coffee that is still hot.',
      'Every venue below has “play café” in its own name. Many bigger soft play centres also have a café; you’ll find those on each town’s page.',
    ],
    basis: 'Listed when the venue describes itself as a play café in its own name.',
    choosing: {
      heading: 'What to check before visiting a play café',
      points: [
        'Whether you need to book a session slot. Play cafés are small, and many sell sessions in advance rather than taking walk-ins.',
        'The age range. Most play cafés are aimed at under-5s or under-8s; older siblings may not be allowed on the equipment.',
        'Session length, and whether the price includes a drink or snack.',
        'Whether the venue closes for private parties at weekends.',
      ],
    },
    cityFilter: 'toddler',
    guides: [
      { href: '/blog/play-cafes-uk-guide', label: 'Play cafés: a UK guide' },
      { href: '/baby-soft-play', label: 'Baby-friendly soft play' },
      { href: '/toddler-soft-play', label: 'Toddler soft play' },
    ],
    matches: (v) => isPlayCafeName(v.name),
    reason: (v) => [ages(v), v.prebooking_required === true ? 'book ahead' : ''].filter(Boolean).join(' · '),
  },
  'soft-play-parties': {
    slug: 'soft-play-parties',
    label: 'soft play parties',
    h1: 'Soft Play Birthday Parties Near You',
    title: (n) => `Soft Play Parties Near Me: ${n} UK Party Venues`,
    description: (n, places) =>
      `${n} soft play centres in ${places} UK towns and cities that host birthday parties. Find a soft play party venue near you, then compare packages and prices.`,
    intro: [
      'A soft play party usually means a play session for the guests followed by food in a party room, with the venue handling set-up and clearing. Some venues also offer exclusive hire of the whole play area, which suits larger groups or children who find busy sessions hard.',
      'Every venue below hosts birthday parties. Packages, minimum numbers and prices vary widely, so compare two or three before booking.',
    ],
    basis: 'Listed when the venue’s website, its owner or our own checks confirm it hosts children’s parties.',
    choosing: {
      heading: 'Comparing soft play party packages',
      points: [
        'Price per child, the minimum number of children, and whether adults are charged.',
        'Shared session or exclusive hire: will other families be on the frame during the party?',
        'How long you get in the party room, and what food is included.',
        'Deposit and cancellation terms, especially for weekend slots.',
      ],
    },
    cityFilter: 'birthday-parties',
    priceFaq: false,
    guides: [
      { href: '/blog/soft-play-party-cost-uk', label: 'How much does a soft play party cost?' },
      { href: '/blog/soft-play-closed-party-booking', label: 'Booking a closed (exclusive) soft play party' },
      { href: '/blog/soft-play-hire-for-parties-uk', label: 'Hiring soft play for a party at home or in a hall' },
    ],
    matches: (v) => v.parties === true,
    reason: (v) => ages(v),
  },
}

export const HUB_SLUGS = Object.keys(HUBS) as HubSlug[]

export const hubPath = (slug: HubSlug) => `/${slug}`

export interface CityGroup<T extends HubVenue> {
  citySlug: string
  cityName: string
  venues: T[]
}

export interface RegionGroup<T extends HubVenue> {
  region: string
  count: number
  cities: CityGroup<T>[]
}

const REGION_ORDER = [
  'London', 'South East', 'South West', 'East of England', 'East Midlands', 'West Midlands',
  'North West', 'North East', 'Yorkshire and the Humber', 'Wales', 'Scotland', 'Northern Ireland',
]

const ratingOf = (v: HubVenue) => Number(v.rating) || 0

/**
 * Matching venues grouped region → city → venue. Cities are ordered by how many venues
 * they have, venues by Google rating (then review count, then name), so the list reads
 * like a directory rather than a ranking we can't justify.
 */
export function groupHubVenues<T extends HubVenue>(
  venues: T[],
  cityInfo: (slug: string) => { name: string; region?: string | null } | undefined,
): RegionGroup<T>[] {
  const byCity = new Map<string, T[]>()
  for (const v of venues) {
    const list = byCity.get(v.city_slug) ?? []
    list.push(v)
    byCity.set(v.city_slug, list)
  }
  const regions = new Map<string, CityGroup<T>[]>()
  for (const [citySlug, list] of byCity) {
    const info = cityInfo(citySlug)
    if (!info) continue
    const raw = info.region === 'Yorkshire' ? 'Yorkshire and the Humber' : info.region
    const region = raw && REGION_ORDER.includes(raw) ? raw : 'Other areas'
    list.sort((a, b) => ratingOf(b) - ratingOf(a) || (b.reviews_count ?? 0) - (a.reviews_count ?? 0) || a.name.localeCompare(b.name))
    const groups = regions.get(region) ?? []
    groups.push({ citySlug, cityName: info.name, venues: list })
    regions.set(region, groups)
  }
  return [...regions.entries()]
    .map(([region, cities]) => ({
      region,
      count: cities.reduce((n, c) => n + c.venues.length, 0),
      cities: cities.sort((a, b) => b.venues.length - a.venues.length || a.cityName.localeCompare(b.cityName)),
    }))
    .sort((a, b) => {
      const ia = REGION_ORDER.indexOf(a.region), ib = REGION_ORDER.indexOf(b.region)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
}

/** FAQ answers computed from the listed venues, so they are always true of the page. */
export function hubFaqs(hub: HubConfig, venues: HubVenue[], places: number): { question: string; answer: string }[] {
  const n = venues.length
  const withAges = venues.filter((v) => v.age_range_min != null && v.age_range_max != null)
  const withPrice = venues.filter((v) => v.price_from != null && Number(v.price_from) > 0)
  const booking = venues.filter((v) => v.prebooking_required === true).length
  const cafe = venues.filter((v) => v.cafe === true).length
  const prices = withPrice.map((v) => Number(v.price_from)).sort((a, b) => a - b)
  const median = prices.length ? prices[Math.floor(prices.length / 2)] : null
  const faqs: { question: string; answer: string }[] = [
    {
      question: `How do I find ${hub.label} near me?`,
      answer: `This page lists ${n} venues across ${places} UK towns and cities, grouped by region. Find your nearest town, then open its page to see every soft play venue there.`,
    },
    {
      question: `How do you decide which venues are listed for ${hub.label}?`,
      answer: hub.basis + ' Details change, so check with the venue before you travel.',
    },
  ]
  if (hub.priceFaq !== false && prices.length >= 5) {
    faqs.push({
      question: 'How much does entry cost?',
      answer: `Of the venues listed here, ${prices.length} publish a child entry price. Their lowest child prices run from £${prices[0].toFixed(2)} to £${prices[prices.length - 1].toFixed(2)}, with a typical starting price of about £${median!.toFixed(2)}. Each venue page shows the prices we hold and when they were checked.`,
    })
  }
  if (withAges.length >= 5) {
    const maxes = withAges.map((v) => v.age_range_max!).sort((a, b) => a - b)
    faqs.push({
      question: 'What ages are these venues for?',
      answer: `${withAges.length} of the listed venues state an age range. Their upper age limits run from ${maxes[0]} to ${maxes[maxes.length - 1]}. The rest don’t publish one, so ask the venue if you have older siblings with you.`,
    })
  }
  faqs.push({
    question: 'Do I need to book?',
    answer: booking > 0
      ? `${booking} of the ${n} venues listed here ${booking === 1 ? 'says' : 'say'} you need to book in advance. For the others we don’t hold a booking rule, so check the venue page or call ahead, especially at weekends and in school holidays.`
      : 'We don’t hold a booking rule for most of these venues, so check the venue page or call ahead, especially at weekends and in school holidays.',
  })
  if (hub.slug !== 'play-cafes' && cafe > 0) {
    faqs.push({
      question: 'Do these venues have a café?',
      answer: `${cafe} of the ${n} venues listed here ${cafe === 1 ? 'has' : 'have'} a confirmed café. For the rest we haven’t confirmed one either way.`,
    })
  }
  return faqs
}

/** Blog guides and the national hubs they should send readers to (Phase 5 linking plan). */
export const GUIDE_HUBS: Record<string, HubSlug[]> = {
  'baby-and-toddler-soft-play-uk': ['baby-soft-play', 'toddler-soft-play', 'play-cafes'],
  'baby-and-toddler-soft-play-in-brighton-and-worthing': ['baby-soft-play', 'toddler-soft-play'],
  'best-toddler-soft-play-in-hull': ['toddler-soft-play'],
  'sen-friendly-soft-play-uk': ['sen-soft-play'],
  'play-cafes-uk-guide': ['play-cafes', 'baby-soft-play'],
  'soft-play-party-cost-uk': ['soft-play-parties'],
  'soft-play-closed-party-booking': ['soft-play-parties'],
  'soft-play-hire-for-parties-uk': ['soft-play-parties'],
  'kids-party-venues-in-worthing': ['soft-play-parties'],
  'santa-at-soft-play-uk': ['soft-play-parties'],
}
