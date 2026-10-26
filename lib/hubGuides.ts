/**
 * Editorial guides for hubs that have one (Brighton, Worthing). Everything here
 * was read from a venue's own website or from Google Places on `VERIFIED_ON`;
 * nothing is estimated. Where a fact could not be confirmed (parking, floor
 * area, most prices) it is left out rather than hedged. Re-check against the
 * venues' sites before changing `VERIFIED_ON`.
 *
 * Text may contain `[label](/path)` links; components/location/HubGuide.tsx renders them.
 */
import type { Faq } from './cityContent'
import { rankTopRated, type StatsVenue } from './cityStats'

export const VERIFIED_ON = '25 October 2026'

export interface GuideSection {
  heading: string
  paragraphs: string[]
}

export interface HubGuide {
  sections: GuideSection[]
  /** Appended to the data-driven FAQ (capped at MAX_FAQS in total by the page). */
  faqs: Faq[]
  /** Hubs shown in the "Nearby" block, in order. */
  nearbyHubs: { slug: string; label: string }[]
  /**
   * Towns people search for that have no soft play of their own and no hub page. The hub gets a
   * "Soft play near <town>" section listing the closest real venues by distance (approximate
   * town-centre coordinates), instead of thin or invented town pages.
   */
  nearTowns?: { name: string; lat: number; lng: number }[]
}

export const MAX_FAQS = 7

const GUIDES: Record<string, HubGuide> = {
  worthing: {
    nearbyHubs: [
      { slug: 'brighton', label: 'Brighton & Hove' },
    ],
    sections: [
      {
        heading: 'Soft play in Worthing: a local guide',
        paragraphs: [
          "Worthing's soft play is mostly independent and community-run rather than big chains. Space Station is in Lancing, and three larger activity venues sit just outside the town, in Angmering, Ford and Littlehampton. We list those separately under nearby towns.",
        ],
      },
      {
        heading: 'Babies and toddlers',
        paragraphs: [
          "[Space Station](/soft-play/worthing/space-station-soft-play-ltd) in Lancing describes its play centre as for ages 0–12 and runs timed sessions; it takes walk-ins but can't guarantee a space when full, so ring ahead. [Harbour Park](/soft-play/worthing/harbour-park-indoor-soft-play) in Littlehampton has a separate baby soft play for 0–18 months and says you can pay on arrival without booking. [Out of Bounds](/soft-play/worthing/out-of-bounds) in Angmering runs a pre-school Climb 'n' Soft Play session. [The Lighthouse](/soft-play/worthing/the-lighthouse-soft-play-and-cafe) lists entry prices for babies from birth.",
        ],
      },
      {
        heading: 'Older children',
        paragraphs: [
          "Out of Bounds combines soft play with ten-pin bowling, laser tag, high ropes and adventure golf, so it suits a mixed-age group. [Flying Fortress](/soft-play/worthing/flying-fortress) in Ford prices children up to age 13. Harbour Park's soft play is for children up to 9.",
        ],
      },
      {
        heading: 'Birthday parties',
        paragraphs: [
          "Space Station has two party rooms and a private hire option. The Lighthouse lists party bookings on its site, and Out of Bounds, Flying Fortress and Harbour Park each publish party information. [The Little Play Village](/soft-play/worthing/the-little-play-village), a role-play village based in Goring, also runs parties. Packages and prices change, so check the venue's own page before you book.",
        ],
      },
      {
        heading: 'Rainy days and opening days',
        paragraphs: [
          "All of these are indoors. Opening days differ: The Lighthouse's website lists Wednesday to Friday only, and Flying Fortress is closed on Mondays. Check before you set off.",
          "The Little Play Village is a role-play experience rather than a conventional soft play centre, and it runs on ticketed event dates, so book ahead.",
        ],
      },
    ],
    faqs: [
      {
        question: 'Where can I have a kids party in Worthing?',
        answer:
          "Space Station in Lancing has two party rooms and a private hire option, and The Lighthouse in Worthing lists party bookings on its website. Out of Bounds (Angmering), Flying Fortress (Ford), Harbour Park (Littlehampton) and The Little Play Village (Goring) also publish party information. Packages and prices are set by each venue, so check their pages for current details.",
      },
      {
        question: 'Do I need to book soft play in Worthing?',
        answer:
          "It depends on the venue. Space Station says it accepts walk-ins but cannot guarantee a space if it is at capacity. Harbour Park says there is no need to book and you can pay on arrival, though peak times may limit play to a one-hour session. For weekends and school holidays, ring first.",
      },
    ],
  },

  brighton: {
    nearTowns: [{ name: 'Peacehaven', lat: 50.7934, lng: -0.0045 }],
    nearbyHubs: [
      { slug: 'worthing', label: 'Worthing' },
      { slug: 'hastings', label: 'Hastings & Eastbourne' },
    ],
    sections: [
      {
        heading: 'Soft play in Brighton and Hove: a local guide',
        paragraphs: [
          "Brighton and Hove has few traditional indoor soft play centres. Inside the city we list [Level Up](/soft-play/brighton/level-up-soft-play) at Withdean Sports Complex, Funplex (BN2), Playcafe (BN1), FunPlay Leisure at Brighton Marina and Palace Play on Brighton Palace Pier, plus weekly soft play sessions at community venues: Hangleton Community Centre, Old Boat Corner in Hollingbury and King Alfred Leisure Centre in Hove. Most larger venues are a drive away in Peacehaven, Lewes, Henfield, Burgess Hill and Uckfield, and are listed under nearby towns.",
        ],
      },
      {
        heading: 'Toddlers and babies',
        paragraphs: [
          "[Level Up](/soft-play/brighton/level-up-soft-play) at Withdean describes a sensory toddler zone for ages 0–3, and [Meridian Mayhem](/soft-play/brighton/meridian-mayhem) in Peacehaven has a baby and toddler zone for children aged 5 and under. [The Doves Play Barn](/soft-play/brighton/the-doves-play-barn) at Furner's Green, near Uckfield, describes a toddler-safe area alongside hidden spaces, rope bridges and slides, with a café, and says it is open seven days a week, 9am to 5pm.",
        ],
      },
      {
        heading: 'SEN-friendly sessions',
        paragraphs: [
          "[Sharky's](/soft-play/brighton/sharkys), at Henfield Leisure Centre, lists SEN sessions on the first and third Thursday of each month, and is a nut-free site with a café. Its website says sessions are often fully booked, so book ahead.",
        ],
      },
      {
        heading: 'Birthday parties',
        paragraphs: [
          "[Monkey Bizness in Lewes](/soft-play/brighton/monkey-bizness-lewes) publishes three party packages (Funky Monkey, Mega Monkey and Pizza Party), each for a minimum of 12 children and 2 hours, with 90 minutes of play. Sharky's, The Doves Play Barn and [Jumpin Fun in Burgess Hill](/soft-play/brighton/jumpin-fun-inflatable-park-burgess-hill) also have party pages. Check the venue's site for current prices.",
        ],
      },
      {
        heading: 'Trampoline and inflatable parks',
        paragraphs: [
          "We don't list an open trampoline park in Brighton and Hove: Google shows Sky High Trampoline Park in Peacehaven as permanently closed, and the indoor play centre [Meridian Mayhem](/soft-play/brighton/meridian-mayhem) now operates in Peacehaven. The nearest bounce-style venue we list is Jumpin Fun in Burgess Hill, an inflatable park with a mega slide, ball pit and ninja course, which is not a trampoline park.",
        ],
      },
    ],
    faqs: [
      {
        question: 'Are there trampoline parks in Brighton?',
        answer:
          "Not one we can confirm as open. Sky High Trampoline Park in Peacehaven is shown by Google as permanently closed. Jumpin Fun in Burgess Hill is an inflatable park, not a trampoline park, and is the nearest bounce-style venue we list.",
      },
      {
        question: "What's the biggest soft play in Brighton?",
        answer:
          "We don't hold floor areas for the venues in Brighton and Hove, so we can't rank them by size. Jumpin Fun in Burgess Hill describes itself as a 25,000 sq ft inflatable theme park; it is an inflatable park rather than soft play. Check each venue's website for its own figures.",
      },
      {
        question: 'Where can I have a kids party near Brighton?',
        answer:
          "Monkey Bizness in Lewes publishes three party packages for a minimum of 12 children. Sharky's in Henfield, The Doves Play Barn near Uckfield and Jumpin Fun in Burgess Hill also have party pages. Prices and availability are set by each venue.",
      },
    ],
  },
}

/**
 * A category page (/toddler, /birthday-parties, /sen-friendly) is only indexable with this many
 * matching venues. Guide hubs are small, so a one-venue category is a thin duplicate of the hub.
 */
export function minFilterVenues(citySlug: string): number {
  return GUIDES[citySlug] ? 2 : 1
}

export function getHubGuide(citySlug: string): HubGuide | undefined {
  return GUIDES[citySlug]
}

/** `Soft Play in Worthing – 4 Indoor Play Centres (2026 Guide)` — N is the live main-list count. */
export function buildGuideTitle(name: string, total: number, year: number): string {
  if (total <= 0) return `Soft Play in ${name}`
  return `Soft Play in ${name} – ${total} Indoor Play ${total === 1 ? 'Centre' : 'Centres'} (${year} Guide)`
}

function joinList(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * Two sentences that answer "where is the best soft play in X?" from the hub's own data:
 * the highest-rated venues (20+ reviews) with their town, then the live counts. Null when
 * no venue has enough reviews to rank, so nothing is claimed.
 */
export function buildAnswerFirst(input: {
  name: string
  venues: (StatsVenue & { area: string | null })[]
  nearbyCount: number
  nearbyTowns: string[]
}): string | null {
  const { name, venues, nearbyCount, nearbyTowns } = input
  const top = rankTopRated(venues, 3)
  if (top.length === 0) return null
  const areaOf = (slug: string) => venues.find((v) => v.slug === slug)?.area
  const first = top[0]
  const where = areaOf(first.slug)
  const rest = top.slice(1).map((t) => (areaOf(t.slug) ? `${t.name} (${areaOf(t.slug)})` : t.name))
  const nearby = nearbyCount > 0 ? ` and ${nearbyCount} more in nearby ${nearbyTowns.length ? `towns (${joinList(nearbyTowns)})` : 'towns'}` : ''
  return (
    `The highest-rated soft play in ${name} is ${first.name}${where ? ` in ${where}` : ''}, ` +
    `rated ${first.rating.toFixed(1)} from ${first.reviews.toLocaleString('en-GB')} reviews` +
    `${rest.length ? `, followed by ${joinList(rest)}` : ''}. ` +
    `We list ${venues.length} soft play ${venues.length === 1 ? 'centre' : 'centres'} in ${name}${nearby}.`
  )
}
