/**
 * Deterministic location content generator for SEO.
 *
 * Generates unique background intro paragraphs (300-600 words) for each
 * location using a slug-seeded hash. (Titles, meta descriptions, the summary
 * under the H1 and the FAQ are built from live venue data instead — see
 * lib/cityMeta.ts and lib/cityContent.ts.) This ensures:
 *   - Same slug always produces the same content (stable for SSG/ISR)
 *   - Different slugs produce different combinations (unique for Google)
 *   - Zero external dependencies
 */

import type { CityConfig } from './venues'
import { getRegionForCounty, getCityBySlug, cities } from './venues'

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
  h1: string
}

function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
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
  `Prices at soft play centres in {name} vary by venue, by the child\u2019s age, and by whether you visit at a peak or off-peak time. Some venues price babies, toddlers and older children differently, and many offer sibling discounts, multi-visit passes or membership. Venue pages show a starting price where the venue has published one \u2014 otherwise check the venue\u2019s own website before you go.`,

  `Planning your visit? Most soft play centres in {name} don't require booking for general play sessions, though it's increasingly common during busy periods like weekends and school holidays. Birthday parties almost always need to be booked in advance — especially at popular venues where weekends fill up quickly.`,

  `A typical visit to soft play in {name} lasts between one and two hours. Some venues run timed sessions, particularly at peak times, while others offer unlimited play. It's worth checking before you go so you know what to expect. Don't forget socks — most venues require them for hygiene and safety reasons.`,

  `Before heading out, it's useful to know what to bring. Socks are essential at almost every soft play in {name} (grip socks are ideal). A change of clothes for younger children is sensible, along with a water bottle. Many venues allow you to bring your own snacks, though most also have cafes on-site.`,

  `Soft play sessions in {name} are priced in different ways: per child, by age band, by session length, or as unlimited play. Off-peak weekday sessions are often cheaper than weekends and school holidays, and some venues sell multi-visit passes or monthly memberships. Check the venue\u2019s own website for its current prices.`,

  `Getting to soft play in {name} depends on the venue — parking and public transport links vary, so check each venue\u2019s page for directions. If you're driving from the surrounding {county} area, journey times are usually short. Check individual venue pages for directions and parking information.`,
]

const INTRO_P4: string[] = [
  `Many soft play centres in {name} run dedicated [SEN-friendly sessions](/soft-play/{slug}/sen-friendly) with reduced noise, lower lighting, and fewer children. These sessions are invaluable for families with children who have additional needs. If SEN provision is important to you, use our filters to find venues that offer it.`,

  `[Birthday parties](/soft-play/{slug}/birthday-parties) are one of the most popular reasons to visit soft play in {name}. Most venues offer packages that include exclusive use of a party room, food, and dedicated play time. Some also provide party bags, invitations, and a host to help things run smoothly. Book well in advance for weekend slots.`,

  `If you have a toddler, you'll be pleased to know that many soft play centres in {name} have dedicated under-3s or under-4s areas. Browse our [toddler-friendly venues in {name}](/soft-play/{slug}/toddler) for sections with age-appropriate equipment, softer surfaces, and a calmer atmosphere. Some venues also run specific toddler sessions during quieter weekday mornings.`,

  `For families with children across different age groups, finding a soft play in {name} that keeps everyone happy can be a challenge. Look for venues with clearly separated age zones — this way, toddlers can explore safely while older children enjoy the bigger frames and slides.`,

  `Accessibility matters, and several soft play venues in {name} have made real efforts to be inclusive. From wheelchair-accessible facilities and accessible toilets to sensory rooms and quiet sessions, the options are improving. Browse [SEN-friendly venues in {name}](/soft-play/{slug}/sen-friendly) to plan with confidence.`,

  `If you're visiting {name} during school holidays, soft play centres can be a lifesaver. Many venues run special holiday activities, themed sessions, and extended opening hours. Check which venues are [open now in {name}](/soft-play/{slug}/open-now) or book ahead during half-terms and summer holidays, as popular venues get busy quickly.`,
]

const INTRO_P5: string[] = [
  `Beyond {name} itself, families in {county} also have options in nearby towns including {nearbyLinks}. Our directory covers venues across the wider area, so you can find soft play wherever you are. [Search by postcode](/search) or browse by location to explore what's nearby.`,

  `If you can't find exactly what you're looking for in {name}, don't worry — there are also soft play options in nearby areas like {nearbyLinks}. The wider {county} area has a good spread of venues, and many are just a short drive away. Browse our nearby area links below to expand your search.`,

  `We're continually updating our listings for {name} and the surrounding {county} area. If you know of a venue we've missed, or if you're a venue owner and want to update your information, we'd love to hear from you. Our aim is to be the most complete and accurate guide to [soft play in {name}](/soft-play/{slug}).`,

  `{name} is well-positioned for families who want to explore different soft play venues across {county}. With options in {nearbyLinks}, you could try a different venue each week. Each one has its own character and specialities, so it's worth visiting a few to find your family's favourite.`,

  `Venue details change, and the people best placed to keep them right are the venues themselves. If you run a soft play venue in {name} or {county}, you can claim your listing for free and manage your own profile \u2014 hours, photos and facilities \u2014 and if we've missed a venue, you can add it.`,

  `Choosing the right soft play in {name} depends on what your family needs. Some parents prioritise a good cafe and comfortable seating, others want the biggest climbing frame. [Search for venues near you](/search) and use our filters to compare what matters most to you across all the options in {county}.`,
]

// ── Main generation function ───────────────────────────────────────────

export function generateLocationContent(
  input: LocationContentInput
): GeneratedLocationContent {
  const { slug, name, county, nearbyAreas, venueCount } = input
  const hash = slugHash(slug)

  // Build template variables
  const nearbyList = nearbyAreas.length > 0
    ? nearbyAreas.slice(0, 4).join(', ')
    : 'the surrounding area'

  // Build nearby links with markdown syntax for areas that have city pages
  const cityNames = new Map(cities.map(c => [c.name.toLowerCase(), c.slug]))
  const nearbyLinks = nearbyAreas.length > 0
    ? nearbyAreas.slice(0, 4).map(area => {
        const areaSlug = cityNames.get(area.toLowerCase())
        return areaSlug
          ? `[${area}](/soft-play/${areaSlug})`
          : area
      }).join(', ')
    : 'the surrounding area'

  const vars: Record<string, string> = {
    name,
    slug,
    county,
    region: input.region || getRegionForCounty(county) || county,
    nearbyList,
    nearbyLinks,
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

  return { intro, h1: `Soft Play in ${name}` }
}

// ── Integration helper ─────────────────────────────────────────────────

/**
 * The long "About soft play in X" text and the H1 for a city hub.
 *
 * Titles, meta descriptions, the intro under the heading and the FAQ are NOT
 * made here any more: they are built from each city's live venue data
 * (lib/cityMeta.ts, lib/cityContent.ts) so they only state what the data holds.
 * What is left is editorial background text: a hand-written intro when one is
 * substantial, otherwise a deterministic template intro (no prices or other
 * figures — see the INTRO_* pools).
 */
export function getLocationContent(
  slug: string,
  cityConfig: CityConfig | undefined,
  staticTown: { name: string; slug: string } | null,
  venueCount?: number
): GeneratedLocationContent {
  const name = cityConfig?.name || staticTown?.name || slug
  const generated = generateLocationContent({
    slug,
    name,
    county: cityConfig?.county || '',
    region: cityConfig?.region || (cityConfig?.county ? getRegionForCounty(cityConfig.county) : undefined),
    nearbyAreas: cityConfig?.nearbyAreas || [],
    venueCount,
  })

  // Hull's copy (2026-09) went through an explicit Fact Checker PASS / Publisher
  // APPROVED review and must be used exactly as approved, never blended with
  // generated text. Hand-written intros elsewhere are used when substantial
  // (200+ words) rather than discarded for random template text.
  const MIN_HANDWRITTEN_INTRO_WORDS = 200
  if (cityConfig && (slug === 'hull' || getWordCount(cityConfig.intro) >= MIN_HANDWRITTEN_INTRO_WORDS)) {
    return { intro: cityConfig.intro, h1: `Soft Play in ${name}` }
  }

  return generated
}
