/**
 * Deterministic location content generator for SEO.
 *
 * Generates unique intro paragraphs (300-600 words) and FAQs (8 items)
 * for each location using a slug-seeded hash. This ensures:
 *   - Same slug always produces the same content (stable for SSG/ISR)
 *   - Different slugs produce different combinations (unique for Google)
 *   - Zero external dependencies
 */

import type { CityConfig } from './venues'
import { getRegionForCounty } from './venues'

// ── Types ──────────────────────────────────────────────────────────────

export interface LocationContentInput {
  slug: string
  name: string
  county: string
  region?: string
  nearbyAreas: string[]
  venueCount?: number
}

export interface GeneratedLocationContent {
  intro: string           // Multi-paragraph, separated by \n\n
  faqs: { question: string; answer: string }[]
  metaTitle: string
  metaDescription: string
  h1: string
}

// ── Deterministic hash + seeded picker ─────────────────────────────────

/**
 * Simple deterministic hash from a string.
 * Returns a positive 32-bit integer.
 */
function slugHash(slug: string): number {
  let hash = 5381
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) + hash + slug.charCodeAt(i)) & 0x7fffffff
  }
  return hash
}

/**
 * Seeded linear congruential generator.
 * Returns the next seed and a value 0..max-1.
 */
function nextRandom(seed: number, max: number): [number, number] {
  const next = (seed * 1103515245 + 12345) & 0x7fffffff
  return [next, next % max]
}

/**
 * Pick `count` unique items from `items` using a deterministic seed.
 */
function seededPick<T>(items: T[], count: number, seed: number): T[] {
  const pool = [...items]
  const result: T[] = []
  let s = seed

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    let idx: number
    ;[s, idx] = nextRandom(s, pool.length)
    result.push(pool[idx])
    pool.splice(idx, 1)
  }

  return result
}

/**
 * Pick a single item from `items` using a deterministic seed.
 */
function seededPickOne<T>(items: T[], seed: number): T {
  const [, idx] = nextRandom(seed, items.length)
  return items[idx]
}

// ── Template interpolation ─────────────────────────────────────────────

function interpolate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || key)
}

// ── Intro paragraph templates ──────────────────────────────────────────
// Each slot has 6+ variants. Variables: {name}, {county}, {region}, {nearbyList}

const INTRO_P1: string[] = [
  `Looking for the best indoor play centres in {name}? Whether you're a local family or visiting {county} for the day, soft play is one of the easiest ways to keep children entertained, active, and happy — rain or shine. Our directory helps you compare venues so you can pick the right one for your family.`,

  `Welcome to our guide to soft play centres in {name}, {county}. If you're searching for a fun, safe, indoor activity for the kids, you've come to the right place. We've gathered all the soft play options in {name} so you can compare facilities, check what's available, and plan your visit.`,

  `Soft play centres in {name} offer families a brilliant way to spend a few hours — whether it's a rainy Tuesday or a busy weekend. With venues catering to babies, toddlers, and older children alike, there's something for every age group. Browse our listings below to find the perfect venue for your family.`,

  `Finding great soft play in {name} doesn't have to be hard. Our directory brings together all the indoor play options across {county} in one place, so you can quickly compare what each venue offers — from toddler zones and cafes to birthday party packages and SEN-friendly sessions.`,

  `{name} has a growing number of soft play centres and indoor play venues that cater to families with children of all ages. Whether you're looking for a quick play session on a weekday morning or planning a birthday party, this guide will help you find exactly what you need.`,

  `If you're a parent or carer in {name}, chances are you've already discovered how valuable a good soft play centre can be. They're perfect for burning off energy, socialising with other children, and giving grown-ups a chance to sit down with a coffee. Here's what's available locally.`,
]

const INTRO_P2: string[] = [
  `Most soft play centres in {name} feature multi-level climbing frames, slides, ball pits, and dedicated areas for under-3s. Many also have on-site cafes where parents can relax while keeping an eye on the children. Some venues go further with sensory rooms, role-play areas, and outdoor play spaces.`,

  `Indoor play venues in {name} range from large adventure centres with multi-storey frames and go-karts to smaller, cosier spaces ideal for babies and toddlers. The best venues combine safe, well-maintained equipment with good facilities for parents — think decent coffee, free WiFi, and clean baby-changing areas.`,

  `What makes {name}'s soft play scene worth exploring is the variety. You'll find everything from large commercial centres with slides, zip lines, and climbing walls to intimate spaces designed specifically for little ones. Many venues also offer themed play zones and seasonal activities during school holidays.`,

  `The soft play venues in {name} cater to a wide range of ages and interests. Toddler-specific areas with soft mats and gentle slides sit alongside bigger frames for older children. Look out for venues with separate sections — it means younger children can play safely without being overwhelmed.`,

  `Across {county}, soft play centres have become much more than just climbing frames and ball pits. Modern venues in {name} often include imaginative play zones, sensory areas, trampolines, and interactive features. Parents benefit from comfortable seating, charging points, and quality food and drink options.`,

  `Whether your child is 6 months or 10 years old, soft play centres in {name} have something to offer. Baby areas with soft textures and mirrors sit alongside adventure zones for older kids. The best venues strike a balance between exciting play and a welcoming environment for parents.`,
]

const INTRO_P3: string[] = [
  `Prices at soft play centres in {name} generally range from around \u00A34 to \u00A38 per child for a standard session, though this varies depending on the venue, day of the week, and whether you visit during peak or off-peak times. Many venues offer discounts for siblings, and under-1s often go free. It's always worth checking for deals or loyalty cards.`,

  `Planning your visit? Most soft play centres in {name} don't require booking for general play sessions, though it's increasingly common during busy periods like weekends and school holidays. Birthday parties almost always need to be booked in advance — especially at popular venues where weekends fill up quickly.`,

  `A typical visit to soft play in {name} lasts between one and two hours. Some venues run timed sessions, particularly at peak times, while others offer unlimited play. It's worth checking before you go so you know what to expect. Don't forget socks — most venues require them for hygiene and safety reasons.`,

  `Before heading out, it's useful to know what to bring. Socks are essential at almost every soft play in {name} (grip socks are ideal). A change of clothes for younger children is sensible, along with a water bottle. Many venues allow you to bring your own snacks, though most also have cafes on-site.`,

  `Soft play sessions in {name} are typically priced between \u00A34 and \u00A310 per child, with under-1s usually free. Off-peak weekday sessions tend to be cheaper. Some venues sell multi-visit passes or monthly memberships which can save money if you're a regular. Party packages usually start from around \u00A310-15 per child.`,

  `Getting to soft play in {name} is generally straightforward — most venues offer free parking, and several are close to public transport. If you're driving from the surrounding {county} area, journey times are usually short. Check individual venue pages for directions and parking information.`,
]

const INTRO_P4: string[] = [
  `Many soft play centres in {name} run dedicated SEN-friendly sessions with reduced noise, lower lighting, and fewer children. These sessions are invaluable for families with children who have additional needs. If SEN provision is important to you, use our filters to find venues that offer it.`,

  `Birthday parties are one of the most popular reasons to visit soft play in {name}. Most venues offer packages that include exclusive use of a party room, food, and dedicated play time. Some also provide party bags, invitations, and a host to help things run smoothly. Book well in advance for weekend slots.`,

  `If you have a toddler, you'll be pleased to know that many soft play centres in {name} have dedicated under-3s or under-4s areas. These sections feature age-appropriate equipment, softer surfaces, and a calmer atmosphere. Some venues also run specific toddler sessions during quieter weekday mornings.`,

  `For families with children across different age groups, finding a soft play in {name} that keeps everyone happy can be a challenge. Look for venues with clearly separated age zones — this way, toddlers can explore safely while older children enjoy the bigger frames and slides.`,

  `Accessibility matters, and several soft play venues in {name} have made real efforts to be inclusive. From wheelchair-accessible facilities and accessible toilets to sensory rooms and quiet sessions, the options are improving. Our directory highlights venues with SEN and accessibility features so you can plan with confidence.`,

  `If you're visiting {name} during school holidays, soft play centres can be a lifesaver. Many venues run special holiday activities, themed sessions, and extended opening hours. It's worth booking ahead during half-terms and summer holidays, as popular venues get busy quickly.`,
]

const INTRO_P5: string[] = [
  `Beyond {name} itself, families in {county} also have options in nearby towns including {nearbyList}. Our directory covers venues across the wider area, so you can find soft play wherever you are. Use the search or browse by location to explore what's nearby.`,

  `If you can't find exactly what you're looking for in {name}, don't worry — there are also soft play options in nearby {nearbyList}. The wider {county} area has a good spread of venues, and many are just a short drive away. Browse our nearby area links below to expand your search.`,

  `We're continually updating our listings for {name} and the surrounding {county} area. If you know of a venue we've missed, or if you're a venue owner and want to update your information, we'd love to hear from you. Our aim is to be the most complete and accurate guide to soft play in {name}.`,

  `{name} is well-positioned for families who want to explore different soft play venues across {county}. With options in {nearbyList}, you could try a different venue each week. Each one has its own character and specialities, so it's worth visiting a few to find your family's favourite.`,

  `Our {name} soft play guide is updated regularly with new venues, changed opening times, and updated facilities. We work with local venue owners to keep information accurate. If you're a venue owner in {name} or {county}, you can claim your listing for free and manage your own profile.`,

  `Choosing the right soft play in {name} depends on what your family needs. Some parents prioritise a good cafe and comfortable seating, others want the biggest climbing frame. Use our filters and venue pages to compare what matters most to you across all the options in {county}.`,
]

// ── FAQ templates ──────────────────────────────────────────────────────
// Each FAQ has 2-3 answer variants for additional uniqueness

interface FAQTemplate {
  question: string
  answers: string[]
}

const FAQ_TEMPLATES: FAQTemplate[] = [
  {
    question: 'How much does soft play cost in {name}?',
    answers: [
      'Soft play prices in {name} typically range from \u00A34 to \u00A38 per child for a standard session. Under-1s often go free, and many venues offer sibling discounts. Off-peak weekday sessions are usually cheaper than weekends and school holidays. Birthday party packages start from around \u00A310-15 per child.',
      'You can expect to pay between \u00A34 and \u00A310 per child at most soft play centres in {name}. Prices vary depending on the venue size, time of day, and whether you visit during peak or off-peak periods. Babies under 12 months are usually free, and some venues offer loyalty cards or multi-visit deals.',
      'Admission to soft play in {name} generally costs \u00A34-8 per child. Some larger venues with more facilities charge up to \u00A310. Accompanying adults are usually free. Check individual venue pages for current pricing, as rates can change seasonally.',
    ],
  },
  {
    question: 'Are there toddler-friendly soft play centres in {name}?',
    answers: [
      'Yes, many soft play centres in {name} have dedicated areas for babies and toddlers (usually under 3s or under 4s). These sections feature age-appropriate equipment like soft mats, gentle slides, and sensory toys. Some venues also run specific toddler sessions during quieter weekday mornings.',
      'Absolutely. Most soft play venues in {name} include a separate toddler zone with equipment designed for little ones. These areas have softer surfaces, lower structures, and are kept separate from older children. Some venues run dedicated toddler-only sessions too.',
    ],
  },
  {
    question: 'Can I book a birthday party at soft play in {name}?',
    answers: [
      'Yes, most soft play centres in {name} offer birthday party packages. These typically include a private party room, food, and a set amount of play time. Packages often come with invitations, party bags, and a dedicated host. Book early, especially for weekend slots, as they fill up fast.',
      'Birthday parties are very popular at soft play venues in {name}. Packages usually cover play time, a party room, food for children, and sometimes extras like party bags and balloons. Prices start from around \u00A310-15 per child. Weekend availability goes quickly, so book well in advance.',
    ],
  },
  {
    question: 'Is there parking at soft play centres in {name}?',
    answers: [
      'Most soft play centres in {name} have free on-site parking or are located near public car parks. A few town-centre venues may have limited parking, so it\u2019s worth checking before you visit. Our individual venue pages include location details and directions.',
      'The majority of soft play venues in {name} offer free parking. Some town-centre locations may require you to use nearby pay-and-display car parks. Check the venue\u2019s page on our site for specific parking information and directions.',
    ],
  },
  {
    question: 'Do I need socks for soft play in {name}?',
    answers: [
      'Yes, almost all soft play centres in {name} require children (and sometimes adults) to wear socks while playing. This is for hygiene and safety reasons. Grip socks are ideal but regular socks are fine. Most venues sell socks at reception if you forget to bring them.',
      'Socks are required at nearly every soft play venue in {name}. Grip socks are recommended for better traction on slides and climbing frames. If you forget, don\u2019t worry \u2014 most venues sell them at the entrance for a small fee.',
    ],
  },
  {
    question: 'Are there SEN-friendly soft play sessions in {name}?',
    answers: [
      'Several soft play centres in {name} offer dedicated SEN (Special Educational Needs) sessions. These typically feature reduced numbers, lower music and lighting levels, and additional staff support. Session times vary by venue, so check individual listings for details.',
      'Yes, a growing number of soft play venues in {name} run SEN-friendly sessions designed for children with additional needs. These sessions offer a calmer environment with reduced sensory stimulation. Use our SEN filter to find venues that provide these sessions.',
      'SEN provision is improving across soft play centres in {name}. Many venues now run regular quiet sessions with adjusted lighting and sound, smaller group sizes, and trained staff. Check our SEN-friendly filter or individual venue pages for session times.',
    ],
  },
  {
    question: 'What time do soft play centres open in {name}?',
    answers: [
      'Opening times vary between venues, but most soft play centres in {name} open between 9:00am and 10:00am and close between 5:00pm and 6:00pm. Weekend hours may differ, and some venues extend their hours during school holidays. Check individual venue pages for up-to-date times.',
      'Most soft play venues in {name} are open from around 9:30am to 5:30pm on weekdays, with slightly different hours at weekends. Holiday periods often bring extended opening times. We recommend checking the specific venue page before visiting.',
    ],
  },
  {
    question: 'Do soft play centres in {name} have cafes?',
    answers: [
      'Yes, the majority of soft play centres in {name} have on-site cafes serving hot and cold drinks, snacks, and meals. Many offer decent coffee, children\u2019s meal deals, and healthier options. Some venues also have free WiFi so parents can work or browse while the children play.',
      'Most soft play venues in {name} include a cafe area for parents and carers. You can usually get hot drinks, light meals, and children\u2019s food. Some venues allow outside food and drinks as well. Use our filters to find venues with cafe facilities.',
    ],
  },
  {
    question: 'What should I bring to soft play in {name}?',
    answers: [
      'The essentials for soft play in {name} are socks (grip socks are ideal), a water bottle, and a change of clothes for younger children. Many venues have baby-changing facilities, but it\u2019s worth bringing your own supplies. Some places allow outside snacks, though most have cafes on-site.',
      'We recommend bringing socks (required at most venues), a spare set of clothes for little ones, water bottles, and any snacks if the venue allows outside food. Baby-changing facilities are available at most soft play centres in {name}. Leave valuables in the car if you can \u2014 most venues have lockers.',
    ],
  },
  {
    question: 'What age is soft play suitable for in {name}?',
    answers: [
      'Soft play in {name} caters to children from babies right through to around 11-12 years old. Most venues have separate areas for under-3s/4s to ensure younger children can play safely. Some centres also welcome older children during quieter periods.',
      'Soft play centres in {name} typically welcome children aged 0-12, with dedicated baby and toddler areas for the youngest visitors. The upper age limit varies by venue, but most set it at around 11 or 12. Adults usually supervise from the cafe area rather than playing.',
    ],
  },
  {
    question: 'Do I need to book soft play in {name}?',
    answers: [
      'For general play sessions, most soft play centres in {name} operate on a walk-in basis \u2014 no booking needed. However, some venues have introduced timed sessions during busy periods (weekends and school holidays) that may require pre-booking. Birthday parties always need to be booked in advance.',
      'Booking is not usually required for standard play sessions in {name}, though some venues now offer online booking for busy periods. It\u2019s always worth checking the venue\u2019s website before visiting at weekends or during holidays. Party bookings should always be made well in advance.',
    ],
  },
  {
    question: 'When is the best time to visit soft play in {name}?',
    answers: [
      'The quietest times at soft play centres in {name} are usually weekday mornings, especially Tuesday to Thursday. Weekends and school holidays are the busiest periods. If you prefer a calmer experience, aim for early morning sessions or check if the venue offers dedicated quiet times.',
      'For a less crowded experience, visit soft play in {name} on a weekday morning outside of school holidays. Tuesdays and Wednesdays tend to be the quietest days. If you must visit at the weekend, arriving as soon as the venue opens usually means fewer crowds.',
    ],
  },
  {
    question: 'What can I do with kids on a rainy day in {name}?',
    answers: [
      'Soft play is the perfect rainy-day activity in {name}. Indoor play centres give children a safe, warm, dry environment to run around and burn off energy. With cafes on-site, it\u2019s a good option for parents too. Browse our {name} listings to find a venue near you.',
      'A rainy day in {name} is the ideal time to visit soft play. Children get to run, climb, and slide in a safe indoor environment, and parents can enjoy a hot drink in the cafe. Many venues also offer craft activities and themed play during school holiday periods.',
    ],
  },
  {
    question: 'Are there soft play centres near {name}?',
    answers: [
      'Yes, besides venues in {name} itself, families in {county} can also visit soft play centres in nearby areas including {nearbyList}. Our directory covers the wider region so you can find options wherever you are. Use the search feature or browse by location to explore nearby venues.',
      'If you\u2019re open to a short drive from {name}, there are additional soft play options in {nearbyList}. The wider {county} area has a good selection of venues, many within 15-30 minutes. Check our nearby area links on the {name} page to expand your search.',
    ],
  },
  {
    question: 'Is soft play busy during school holidays in {name}?',
    answers: [
      'Yes, school holidays are the busiest time at soft play centres in {name}. Expect longer queues and a livelier atmosphere, particularly during half-term and summer holidays. Some venues run timed sessions during these periods to manage numbers. Arriving early or booking online where possible is recommended.',
      'Soft play in {name} gets noticeably busier during school holidays. Many venues run extended hours and special activities to cater for the extra demand. If you prefer a quieter visit, aim for the first session of the day or consider a weekday during term time.',
    ],
  },
]

// ── Meta title/description templates ───────────────────────────────────

const META_TITLES: string[] = [
  'Soft Play in {name} | Best Indoor Play Centres ({county})',
  'Soft Play Centres in {name} | Find Indoor Play Near You',
  '{name} Soft Play | Compare Indoor Play Venues & Prices',
  'Best Soft Play in {name}, {county} | Family Guide',
]

const META_DESCRIPTIONS: string[] = [
  'Find the best soft play centres in {name}, {county}. Compare venues, check opening times, prices, and facilities. Toddler areas, birthday parties, and SEN sessions.',
  'Discover soft play in {name}. Browse indoor play centres with cafes, parking, toddler zones, and party packages. Compare all venues in {county} in one place.',
  'Looking for soft play in {name}? Compare indoor play venues across {county}. Check opening times, facilities, prices, and book birthday parties.',
]

// ── Main generation function ───────────────────────────────────────────

export function generateLocationContent(
  input: LocationContentInput
): GeneratedLocationContent {
  const { slug, name, county, nearbyAreas, venueCount } = input
  const region = input.region || getRegionForCounty(county) || county
  const hash = slugHash(slug)

  // Build template variables
  const nearbyList = nearbyAreas.length > 0
    ? nearbyAreas.slice(0, 4).join(', ')
    : 'the surrounding area'

  const vars: Record<string, string> = {
    name,
    county,
    region,
    nearbyList,
    venueCount: venueCount ? String(venueCount) : 'several',
  }

  // Select one variant per paragraph slot (5 paragraphs)
  const p1 = seededPickOne(INTRO_P1, hash)
  const p2 = seededPickOne(INTRO_P2, hash + 1)
  const p3 = seededPickOne(INTRO_P3, hash + 2)
  const p4 = seededPickOne(INTRO_P4, hash + 3)
  const p5 = seededPickOne(INTRO_P5, hash + 4)

  const intro = [p1, p2, p3, p4, p5]
    .map((p) => interpolate(p, vars))
    .join('\n\n')

  // Select 8 FAQs from the pool
  const selectedFAQs = seededPick(FAQ_TEMPLATES, 8, hash + 10)
  const faqs = selectedFAQs.map((template, i) => {
    const answerVariant = seededPickOne(template.answers, hash + 20 + i)
    return {
      question: interpolate(template.question, vars),
      answer: interpolate(answerVariant, vars),
    }
  })

  // Meta title and description
  const metaTitle = interpolate(seededPickOne(META_TITLES, hash + 50), vars)
  const metaDescription = interpolate(
    seededPickOne(META_DESCRIPTIONS, hash + 60),
    vars
  )

  const h1 = `Soft Play Centres in ${name}`

  return { intro, faqs, metaTitle, metaDescription, h1 }
}

// ── Integration helper ─────────────────────────────────────────────────

/**
 * Returns hand-written CityConfig content if rich enough,
 * otherwise generates content deterministically.
 *
 * "Rich enough" = intro > 100 chars AND 4+ FAQs.
 */
export function getLocationContent(
  slug: string,
  cityConfig: CityConfig | undefined,
  staticTown: { name: string; slug: string } | null,
  venueCount?: number
): GeneratedLocationContent {
  // If there's a city config with substantial hand-written content, use it
  if (
    cityConfig &&
    cityConfig.intro.length > 100 &&
    cityConfig.faqs.length >= 4
  ) {
    return {
      intro: cityConfig.intro,
      faqs: cityConfig.faqs,
      metaTitle: cityConfig.metaTitle,
      metaDescription: cityConfig.metaDescription,
      h1: cityConfig.h1,
    }
  }

  // Otherwise generate content
  const name = cityConfig?.name || staticTown?.name || slug
  const county = cityConfig?.county || ''
  const region = cityConfig?.region || (county ? getRegionForCounty(county) : undefined)
  const nearbyAreas = cityConfig?.nearbyAreas || []

  return generateLocationContent({
    slug,
    name,
    county,
    region,
    nearbyAreas,
    venueCount,
  })
}
