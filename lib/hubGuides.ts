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
import { rankTopRated, MIN_REVIEWS_FOR_TOP_RATED, type StatsVenue } from './cityStats'
import { getLondonAreaSlug, LONDON_AREAS } from './londonAreas'

export const VERIFIED_ON = '25 October 2026'

export interface GuideSection {
  heading: string
  paragraphs: string[]
}

export interface HubGuide {
  /**
   * 'verified' (default): hand-written from each venue's own website on VERIFIED_ON (Worthing, Brighton).
   * 'listings': built at render time from the hub's own listing data (see buildDataGuide) — no claim of
   * having read venue websites, and it is always as current as the listings.
   */
  kind?: 'verified' | 'listings'
  /** When the guide's facts were checked (shown under the guide). Defaults to VERIFIED_ON. */
  verifiedOn?: string
  /**
   * ISO date the guide's text last changed. The sitemap uses it as the hub's lastmod when it is
   * later than the newest venue change, so Google sees rewritten hub copy as an update.
   */
  contentUpdated?: string
  /** The name the hub's title, H1 and FAQ use when it differs from the city name ("Brighton & Hove"). */
  areaName?: string
  /**
   * Which of the generic data FAQs (lib/cityContent.ts buildCityFaqs) to keep, matched on the question.
   * Unset: the generic FAQ fills whatever room the guide's own FAQs leave (up to MAX_FAQS).
   */
  keepGenericFaqs?: RegExp[]
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

/** Prices quoted below were read from each venue's own website on this date. */
export const PRICES_ON = '27 October 2026'
/** Opening hours quoted in the FAQs below are as listed on the venue pages on this date. */
export const HOURS_ON = '16 November 2026'

const GUIDES: Record<string, HubGuide> = {
  worthing: {
    contentUpdated: '2026-11-16',
    keepGenericFaqs: [/^How many soft play/, /^How much does soft play cost/],
    nearbyHubs: [
      { slug: 'brighton', label: 'Brighton & Hove' },
      { slug: 'bognor-regis', label: 'Bognor Regis' },
    ],
    sections: [
      {
        heading: 'Soft play in Worthing: what is here',
        paragraphs: [
          "Worthing's soft play is independent and community-run rather than big chains, and it is spread along the coast rather than in the town centre. In Worthing itself we list [Hope Hive](/soft-play/worthing/hope-hive) on St Dunstan's Road and [The Lighthouse](/soft-play/worthing/the-lighthouse-soft-play-and-cafe) on South Farm Road; [Space Station](/soft-play/worthing/space-station-soft-play-ltd) is a few minutes east in Lancing, and [The Little Play Village](/soft-play/worthing/the-little-play-village), a ticketed role-play village, is in Goring-by-Sea.",
          "The two biggest venues are just outside the town and are listed under nearby towns below: [Out of Bounds](/soft-play/worthing/out-of-bounds) in Angmering and [Harbour Park](/soft-play/worthing/harbour-park-indoor-soft-play) in Littlehampton. [Flying Fortress](/soft-play/bognor-regis/flying-fortress) at Ford, further west, is listed under [soft play in Bognor Regis](/soft-play/bognor-regis).",
        ],
      },
      {
        heading: 'Babies and toddlers',
        paragraphs: [
          "Space Station in Lancing describes its play centre as for ages 0–12 and runs timed sessions; it takes walk-ins but can't guarantee a space when full, so ring ahead. Harbour Park in Littlehampton has a separate baby soft play for 0–18 months and says you can pay on arrival without booking. Out of Bounds in Angmering runs a pre-school Climb 'n' Soft Play session. The Lighthouse lists entry prices for babies from birth.",
        ],
      },
      {
        heading: 'Older children',
        paragraphs: [
          "Out of Bounds combines soft play with ten-pin bowling, laser tag, high ropes and adventure golf, so it suits a mixed-age group. Harbour Park's soft play is for children up to 9. Flying Fortress at Ford prices children up to age 13.",
        ],
      },
      {
        heading: 'Birthday parties',
        paragraphs: [
          "Space Station has two party rooms and a private hire option. The Lighthouse lists party bookings on its site, and Out of Bounds and Harbour Park each publish party information. The Little Play Village in Goring also runs parties. Packages and prices change, so check the venue's own page before you book.",
        ],
      },
      {
        heading: 'Trampoline parks near Worthing',
        paragraphs: [
          "We don't list a trampoline park in Worthing. The nearest we list is [Flip Out Chichester](/soft-play/chichester/flip-out-chichester), about 17 miles west in a straight line. For bouncing closer to home, Out of Bounds in Angmering has high ropes and laser tag alongside its soft play.",
        ],
      },
      {
        heading: 'Rainy days and opening days',
        paragraphs: [
          "All of these are indoors. Opening days differ: The Lighthouse's website lists Wednesday to Friday only, and Hope Hive is open mornings to early afternoon. Check before you set off.",
          "Heading east? See [soft play in Brighton](/soft-play/brighton) and Hove.",
        ],
      },
    ],
    faqs: [
      {
        question: 'Which soft play in Worthing is best for toddlers?',
        answer:
          "For babies, Harbour Park in Littlehampton has a separate baby soft play for 0–18 months, and The Lighthouse in Worthing lists entry prices from birth. Space Station in Lancing is for ages 0–12 and runs timed sessions, and Out of Bounds in Angmering runs a pre-school Climb 'n' Soft Play session.",
      },
      {
        question: 'Is any soft play near Worthing open late?',
        answer:
          `Out of Bounds in Angmering is the latest we list: until 8pm on Fridays and Saturdays (6pm other days, closed Mondays). Harbour Park in Littlehampton is open until 7pm on Mondays and 6pm the rest of the week. In Worthing and Lancing, Space Station closes at 5:15pm (3:15pm Monday to Wednesday), The Lighthouse at 5pm at the latest, and Hope Hive closes by 1:30pm. Hours as listed on ${HOURS_ON}; they change in school holidays, so check before you go.`,
      },
      {
        question: 'Is there SEN-friendly soft play in Worthing?',
        answer:
          "Hope Hive on St Dunstan's Road in Worthing is listed with SEN sessions. Ask the venue which sessions are quieter or SEN-only, and when.",
      },
      {
        question: 'Where can I have a kids party in Worthing?',
        answer:
          "Space Station in Lancing has two party rooms and a private hire option, and The Lighthouse in Worthing lists party bookings on its website. Out of Bounds (Angmering), Harbour Park (Littlehampton) and The Little Play Village (Goring) also publish party information, and Flying Fortress at Ford (listed under Bognor Regis) does too. Packages and prices are set by each venue, so check their pages for current details.",
      },
      {
        question: 'Are there trampoline parks in Worthing?',
        answer:
          "Not one we list. The nearest trampoline park we list is Flip Out Chichester, about 17 miles west. Out of Bounds in Angmering has high ropes, laser tag and bowling alongside soft play.",
      },
    ],
  },

  brighton: {
    contentUpdated: '2026-11-16',
    areaName: 'Brighton & Hove',
    keepGenericFaqs: [/^How many soft play/],
    nearTowns: [{ name: 'Peacehaven', lat: 50.7934, lng: -0.0045 }],
    nearbyHubs: [
      { slug: 'worthing', label: 'Worthing' },
      { slug: 'hastings', label: 'Hastings & Eastbourne' },
    ],
    sections: [
      {
        heading: 'Soft play in Brighton & Hove: what is here',
        paragraphs: [
          "Brighton & Hove has few big soft play centres, so it helps to know what is where. Inside the city we list three soft play centres: [Level Up](/soft-play/brighton/level-up-soft-play) at Withdean Sports Complex, [Funplex](/soft-play/brighton/funplex) on the Hyde Business Park off Auckland Drive (BN2), and [Palace Play](/soft-play/brighton/palace-play) on Brighton Palace Pier. Three community venues run weekly soft play sessions: [Hangleton Community Centre](/soft-play/brighton/hangleton-community-centre-soft-play) in Hove, [Old Boat Corner](/soft-play/brighton/old-boat-corner-soft-play) in Hollingbury and [King Alfred Leisure Centre](/soft-play/brighton/king-alfred-soft-play-sessions) on the Hove seafront.",
          "We don't list a soft play venue in Portslade or Shoreham-by-Sea; the nearest are [Two by Two](/soft-play/brighton/two-by-two-softplay) in Southwick and the Hove sessions. The larger venues families drive to are in Peacehaven, Lewes, Henfield, Burgess Hill and near Uckfield, listed under nearby towns below. Playcafé, a term-time toddler café at St Matthias Church, and FunPlay Leisure at Brighton Marina are listed under other family activities.",
        ],
      },
      {
        heading: 'Prices: the cheapest soft play in Brighton',
        paragraphs: [
          `The community sessions are the cheapest: Hangleton Community Centre lists soft play from 9:30am to 2pm, Monday to Friday, at £2 per family; Old Boat Corner lists Tuesday and Wednesday mornings (9:30am–12pm) at £3.50; and King Alfred Leisure Centre lists Tuesday (9am–12:30pm) and Friday sessions from £5.25 for one child. Of the centres, Palace Play charges £6.50 under 0.9m and £9 over 0.9m for all day (nobody over 1.5m), and Funplex charges £7.45 in term time and £9.95 at peak times (weekends, inset days and school holidays), plus £2.25 per adult. Prices as published by each venue on ${PRICES_ON}; check before you travel.`,
        ],
      },
      {
        heading: 'Toddlers and babies',
        paragraphs: [
          "Level Up at Withdean has a main play frame and a sensory toddler zone for ages 0–3; sessions last 1 hour 30 minutes and socks must be worn. Funplex has multi-level play frames, three slides, a four-cannon ball area and a two-level toddler area. [Meridian Mayhem](/soft-play/brighton/meridian-mayhem) in Peacehaven has a baby and toddler zone for children aged 5 and under. [The Doves Play Barn](/soft-play/brighton/the-doves-play-barn) at Furner's Green, near Uckfield, describes a toddler-safe area alongside hidden spaces, rope bridges and slides, with a café, and says it is open seven days a week, 9am to 5pm.",
        ],
      },
      {
        heading: 'SEN-friendly sessions',
        paragraphs: [
          "Level Up runs SEN sessions, and Meridian Mayhem in Peacehaven runs SEND sessions. [Sharky's](/soft-play/brighton/sharkys), at Henfield Leisure Centre, lists SEN sessions on the first and third Thursday of each month and is a nut-free site with a café; its website says sessions are often fully booked, so book ahead.",
        ],
      },
      {
        heading: 'Birthday parties',
        paragraphs: [
          "Level Up has party rooms. Meridian Mayhem in Peacehaven publishes four party packages and has a first-floor café; it recommends booking online at weekends and in school holidays. [Monkey Bizness in Lewes](/soft-play/brighton/monkey-bizness-lewes) publishes three party packages (Funky Monkey, Mega Monkey and Pizza Party), each for a minimum of 12 children and 2 hours, with 90 minutes of play. Sharky's, The Doves Play Barn and [Jumpin Fun in Burgess Hill](/soft-play/brighton/jumpin-fun-inflatable-park-burgess-hill) also have party pages. Check the venue's site for current prices.",
        ],
      },
      {
        heading: 'Trampoline parks in Brighton',
        paragraphs: [
          "There is no open trampoline park in Brighton & Hove that we can confirm. Sky High Trampoline Park in Peacehaven is shown by Google as permanently closed; the indoor play centre Meridian Mayhem now operates in Peacehaven. The nearest venue with trampolines that we list is [Fun Abounds Trampoline & Gymnastics Centre](/soft-play/brighton/fun-abounds-trampoline-gymnastics-centre) in Uckfield, about 14 miles north-east in a straight line; check its website for which sessions are open to the public.",
          "For bouncing nearer the city, Jumpin Fun in Burgess Hill is a 25,000 sq ft inflatable park with a mega slide, ball pit and ninja course. It is an inflatable park, not a trampoline park.",
        ],
      },
      {
        heading: 'Looking west?',
        paragraphs: [
          "Several well-regarded centres are nearer Worthing than Brighton, in Lancing, Angmering and Littlehampton: see [soft play in Worthing](/soft-play/worthing).",
        ],
      },
    ],
    faqs: [
      {
        question: "What's the cheapest soft play in Brighton?",
        answer:
          `The weekly community sessions: Hangleton Community Centre in Hove at £2 per family (Monday to Friday, 9:30am–2pm), Old Boat Corner in Hollingbury at £3.50 (Tuesday and Wednesday mornings) and King Alfred Leisure Centre from £5.25 for one child. Of the soft play centres, Palace Play starts at £6.50 for under-0.9m children and Funplex at £7.45 in term time. Prices as published on ${PRICES_ON}.`,
      },
      {
        question: 'Which soft play in Brighton is best for toddlers?',
        answer:
          "Level Up at Withdean has a sensory toddler zone for ages 0–3, and Funplex has a two-level toddler area. Just outside the city, Meridian Mayhem in Peacehaven has a baby and toddler zone for under-5s, and The Doves Play Barn near Uckfield describes a toddler-safe area with a café. Hangleton Community Centre's weekday sessions are an inexpensive option for little ones.",
      },
      {
        question: 'Is any soft play in Brighton open late?',
        answer:
          `Level Up at Withdean is open latest inside the city: 9am–7:30pm Monday to Friday and 9am–6pm on Saturday. Funplex is open 10am–6pm every day, and Palace Play 11am–5pm on weekdays and 10am–6pm at weekends. Nearby, Monkey Bizness in Lewes and Magic Castle at Peacehaven Leisure Centre are open until 6pm every day. Hours as listed on ${HOURS_ON}; they change in school holidays, so check before you go.`,
      },
      {
        question: 'Is there SEN-friendly soft play in Brighton?',
        answer:
          "Level Up at Withdean runs SEN sessions, and Meridian Mayhem in Peacehaven runs SEND sessions. Sharky's at Henfield Leisure Centre lists SEN sessions on the first and third Thursday of each month; they are often fully booked, so book ahead.",
      },
      {
        question: 'Where can I have a kids party in Brighton?',
        answer:
          "Level Up at Withdean has party rooms, and Funplex and Palace Play are both listed for parties. Meridian Mayhem in Peacehaven publishes four party packages, and Monkey Bizness in Lewes three (each for a minimum of 12 children). Sharky's in Henfield, The Doves Play Barn near Uckfield and Jumpin Fun in Burgess Hill also have party pages. Prices and availability are set by each venue.",
      },
      {
        question: 'Are there trampoline parks in Brighton?',
        answer:
          "Not one we can confirm as open. Sky High Trampoline Park in Peacehaven is shown by Google as permanently closed. The nearest venue with trampolines we list is Fun Abounds Trampoline & Gymnastics Centre in Uckfield, about 14 miles away; Jumpin Fun in Burgess Hill is an inflatable park, not a trampoline park.",
      },
    ],
  },

  hull: {
    // Prices and venue notes: the hand-checked Hull list (data/hullCuratedVenues.ts, approved
    // 14 September 2026, from each venue's own website). Areas: our listings' postcodes.
    verifiedOn: '14 September 2026',
    contentUpdated: '2026-11-17',
    keepGenericFaqs: [/^How many soft play/, /best rated/],
    nearbyHubs: [
      { slug: 'beverley', label: 'Beverley' },
      { slug: 'bridlington', label: 'Bridlington' },
    ],
    sections: [
      {
        heading: 'Soft play in Hull: where it is',
        paragraphs: [
          "Hull's soft play is spread across the city rather than in one retail park. In west Hull (HU5) there are [Big Fun](/soft-play/hull/big-fun-hull) and [Adventure Play Town](/soft-play/hull/adventure-play-town-hull), an imagination town for younger children. North Hull (HU6) has [Ping Pong Tots](/soft-play/hull/ping-pong-tots) on Clough Road and [Little Monkeys at Active+](/soft-play/hull/little-monkeys-active-plus). Bransholme and Kingswood (HU7) have [Monkey Bizness](/soft-play/hull/monkey-bizness) and [Simsory Sensory](/soft-play/hull/simsory-sensory-hull). East Hull (HU9) has [East Coast Crazy Kids](/soft-play/hull/crazy-kids-hull), [Let's Play Hull](/soft-play/hull/let-s-play), a fantasy role-play village, and [the Freedom Centre](/soft-play/hull/the-freedom-centre-hull) on Preston Road.",
          "In and around the city centre are [Little Astronauts](/soft-play/hull/little-astronauts-hull), [Rock Up](/soft-play/hull/rock-up) at St Stephen's, which offers soft play alongside climbing, and the Crazy Club soft play at [Superbowl UK](/soft-play/hull/superbowl-uk) in Princes Quay. Bowling, trampoline and arcade venues such as Gravity Active, Funstation and Hollywood Bowl are listed under other family activities rather than as soft play.",
        ],
      },
      {
        heading: 'What soft play costs in Hull',
        paragraphs: [
          "Prices published by the venues themselves: Adventure Play Town charges £6.50 per child and £2.50 per adult, with pre-walkers free, for a 90-minute session. Let's Play Hull charges £7 for children aged 1–7, £5 for babies under 12 months and £2 for adults, also for 90 minutes. Crazy Club at Superbowl is £6.50 for ages 1+ off-peak (adults free) and £7.50 at peak times (adults £1), with under-1s £2. Ping Pong Tots has published midweek soft play at £10, and our listing for Little Astronauts shows prices from £8.95. Just outside the city, Blue Kangaroo in Cottingham charges £6.95 for ages 1–8, and Kingstown Wacky Warehouse in Hedon around £5 for general play and £3.50 for tots. Little Monkeys at Active+ doesn't publish soft play prices clearly, so ask the venue.",
        ],
      },
      {
        heading: 'Babies and toddlers',
        paragraphs: [
          "Let's Play Hull has a baby soft play area within its fantasy village, and babies under 12 months pay less than older children. Adventure Play Town lets pre-walkers in free. Ping Pong Tots combines soft play with role play. In Cottingham, [Blue Kangaroo](/soft-play/hull/blue-kangaroo-hull) is for children up to about 8, so younger ones aren't sharing the frame with much older children, and it lets babies up to 8 months in free. [Kingstown Wacky Warehouse](/soft-play/hull/kingstown-wacky-warehouse-hull) in Hedon has a separate tots price.",
        ],
      },
      {
        heading: 'SEN and sensory play',
        paragraphs: [
          "Let's Play Hull is listed with SEN sessions, and Simsory Sensory in Bransholme is a sensory play venue. Session times change through the year, so check with the venue before you go, and ask whether a quieter session is available.",
        ],
      },
      {
        heading: 'Older children',
        paragraphs: [
          "Once a frame stops being a challenge, Rock Up Hull adds climbing walls to its soft play, and [Inflata Nation](/soft-play/hull/inflata-nation-inflatable-theme-park) is an inflatable park; both price by booking, so book online for current prices. Gravity Active Hull is a trampoline park. [William's Den](/soft-play/hull/william-s-den-hull) near North Cave is an adventure play barn and says on its own site that it is not soft play.",
        ],
      },
      {
        heading: 'Just outside Hull',
        paragraphs: [
          "Venues in the surrounding towns are listed separately below the Hull list: [Our Imagination Station](/soft-play/hull/our-imagination-station-hull) in Hessle, Blue Kangaroo in Cottingham, [The Secret Village](/soft-play/hull/the-secret-village-hull) role-play centre in Anlaby, Kingstown Wacky Warehouse in Hedon, and [Beach Cove](/soft-play/hull/beach-cove-adventure-play-area-hull) at Hornsea Village, which has indoor and outdoor play. For Beverley and Bridlington, see [soft play in Beverley](/soft-play/beverley) and [soft play in Bridlington](/soft-play/bridlington).",
          "More Hull guides: [cheap soft play in Hull](/blog/cheap-soft-play-in-hull), [toddler soft play in Hull](/blog/best-toddler-soft-play-in-hull) and [rainy day ideas in Hull](/blog/rainy-day-activities-hull).",
        ],
      },
    ],
    faqs: [
      {
        question: 'How much does soft play cost in Hull?',
        answer:
          "Most published prices in Hull are £6.50–£7 per child: Adventure Play Town £6.50 (adults £2.50, pre-walkers free), Let's Play Hull £7 for ages 1–7 (babies £5, adults £2) and Crazy Club at Superbowl £6.50 off-peak or £7.50 at peak times. Ping Pong Tots has published £10 midweek, and Little Astronauts is listed from £8.95. Prices as published by the venues; check before you go.",
      },
      {
        question: 'Which soft play in Hull is best for babies and toddlers?',
        answer:
          "Let's Play Hull has a baby soft play area and a lower price for under-12-months, Adventure Play Town lets pre-walkers in free, and Ping Pong Tots mixes soft play with role play. Just outside the city, Blue Kangaroo in Cottingham is for children up to about 8, with babies up to 8 months free.",
      },
      {
        question: 'Where is soft play in east and west Hull?',
        answer:
          "In east Hull (HU9): East Coast Crazy Kids, Let's Play Hull and the Freedom Centre on Preston Road. In west Hull (HU5): Big Fun and Adventure Play Town. North Hull and Bransholme have Ping Pong Tots, Little Monkeys at Active+ and Monkey Bizness, and the city centre has Little Astronauts, Rock Up and Crazy Club at Princes Quay.",
      },
      {
        question: 'Is there SEN-friendly or sensory soft play in Hull?',
        answer:
          "Let's Play Hull is listed with SEN sessions, and Simsory Sensory in Bransholme is a sensory play venue. Session times change, so ask the venue which sessions are quieter or SEN-only.",
      },
      {
        question: 'What is there for older children in Hull?',
        answer:
          "Rock Up Hull combines soft play with climbing walls, Inflata Nation is an inflatable park and Gravity Active Hull is a trampoline park; all three price by online booking. William's Den near North Cave is an adventure play barn rather than soft play.",
      },
    ],
  },

  nottingham: {
    // From our listings (Google Places addresses and types, checked 17 November 2026) — no
    // venue prices are held for Nottingham, so none are quoted.
    kind: 'listings',
    contentUpdated: '2026-11-17',
    keepGenericFaqs: [/^How many soft play/, /best rated/],
    nearbyHubs: [
      { slug: 'derby', label: 'Derby' },
      { slug: 'leicester', label: 'Leicester' },
      { slug: 'loughborough', label: 'Loughborough' },
    ],
    sections: [
      {
        heading: 'Soft play in Nottingham: where it is',
        paragraphs: [
          "In the city centre, [Planet Bounce](/soft-play/nottingham/planet-bounce-inflatable-park) on Huntingdon Street is an inflatable park, and [Devastation Station](/soft-play/nottingham/devastation-station-play-cafe) is a play café. To the north, [Pirates Play, Party & Laser Centre](/soft-play/nottingham/pirates-play-party-laser-centre-nottingham) (NG5) and [Tumble Town](/soft-play/nottingham/tumble-town-play-centre-ltd-nottingham) in Arnold. West of the centre, [Tiny Town Adventures](/soft-play/nottingham/tiny-town-adventures-role-play-centre-nottingham) on Radford Road and [Robyn's World](/soft-play/nottingham/robyn-s-world-nottingham) are role-play centres, and [Kidz Kaboom](/soft-play/nottingham/kidz-kaboom-nursery-and-soft-play-centre-nottingham) is a nursery with a soft play centre. [Meadows Play Centre](/soft-play/nottingham/meadows-play-centre-soft-play-nottingham) is just south of the centre, and [Fun Valley](/soft-play/nottingham/fun-valley) is east, in Carlton.",
          "Beeston and Stapleford have [Hocus Pocus](/soft-play/nottingham/hocus-pocus-soft-play-and-party-venue-nottingham), [Little Foxes Play Town](/soft-play/nottingham/little-foxes-play-town-nottingham) on Chilwell Road, [The Square Play Cafe](/soft-play/nottingham/the-square-play-cafe-nottingham) and [Mighty Monsters](/soft-play/nottingham/mighty-monsters-nottingham). Hucknall has [Squiggles Playden](/soft-play/nottingham/squiggles-playden-nottingham), [Oceans of Fun](/soft-play/nottingham/oceans-of-fun-nottingham) and [My Little World](/soft-play/nottingham/my-little-world-play-centre).",
        ],
      },
      {
        heading: 'Role play, inflatables and play cafés',
        paragraphs: [
          "Not every Nottingham venue is a climbing frame. Tiny Town Adventures, Robyn's World and Little Foxes Play Town are built around role play, which suits imaginative younger children. Planet Bounce is an inflatable park and Pirates adds laser games to its soft play, which suit older children. The Square Play Cafe in Beeston and Devastation Station in the city centre are play cafés, smaller and calmer than the big frames.",
        ],
      },
      {
        heading: 'Trampoline parks near Nottingham',
        paragraphs: [
          "We don't list a trampoline park inside Nottingham. The nearest we list are [Freestyle Trampoline Park](/soft-play/nottingham/freestyle-trampoline-park-soft-play-and-inflatable-nottingham) in Kirkby-in-Ashfield, which also has soft play and inflatables, and [i FUN Trampoline & Soft Play](/soft-play/nottingham/i-fun-trampoline-soft-play-mansfield) in Mansfield Woodhouse.",
        ],
      },
      {
        heading: 'Just outside Nottingham',
        paragraphs: [
          "Venues in nearby towns are listed separately below the Nottingham list. Long Eaton has [Cyril's Fun House](/soft-play/nottingham/cyrils-fun-house-nottingham), Cyril's Nut Hut and [Plank & Leggit Wacky Warehouse](/soft-play/nottingham/plank-leggit-wacky-warehouse-nottingham). Further out are [Treetops Activity Centre](/soft-play/nottingham/treetops-activity-centre-nottingham) in Riddings, near Alfreton, [Dinky Dino's](/soft-play/nottingham/dinky-dino-s-soft-play-nottingham) in Heanor, [Ed & Molly's Playbarn](/soft-play/nottingham/ed-molly-s-playbarn-nottingham) on the Fosse Way at East Bridgford, [Supernova Stay and Play](/soft-play/nottingham/supernova-stay-and-play-nottingham) in Southwell, and Jimmy Beans and Bizzy Beans around Sutton-in-Ashfield. For Derby, see [soft play in Derby](/soft-play/derby).",
        ],
      },
    ],
    faqs: [
      {
        question: 'Where is soft play in Nottingham city centre?',
        answer:
          "Planet Bounce, an inflatable park on Huntingdon Street, and Devastation Station, a play café, are in the city centre. Tiny Town Adventures and Robyn's World (role play) and Kidz Kaboom are just west of the centre, and Meadows Play Centre is just south.",
      },
      {
        question: 'Is there role-play soft play in Nottingham?',
        answer:
          "Yes. Tiny Town Adventures on Radford Road, Robyn's World and Little Foxes Play Town in Beeston are all built around themed role-play rather than a climbing frame, which suits imaginative younger children.",
      },
      {
        question: 'Are there trampoline parks near Nottingham?',
        answer:
          "Not inside the city in our listings. The nearest we list are Freestyle Trampoline Park in Kirkby-in-Ashfield, which also has soft play and inflatables, and i FUN Trampoline & Soft Play in Mansfield Woodhouse. Planet Bounce in the city centre is an inflatable park.",
      },
      {
        question: 'Is there SEN-friendly soft play in Nottingham?',
        answer:
          "The Square Play Cafe in Beeston is listed with SEN-friendly sessions as well as toddler and baby areas. Smaller play cafés and role-play centres are often calmer than the big frames; ask any venue whether it runs a quieter session.",
      },
      {
        question: 'Where can I have a kids party in Nottingham?',
        answer:
          "Hocus Pocus in Beeston is a soft play and party venue, and Pirates Play, Party & Laser Centre adds laser games. Pop and Play by Holly in Keyworth and Playmania in Mansfield are also listed for parties. Packages and prices are set by each venue, so ask them directly.",
      },
    ],
  },

  birmingham: {
    // From our listings (Google Places addresses and types, checked 17 November 2026).
    kind: 'listings',
    contentUpdated: '2026-11-17',
    keepGenericFaqs: [/^How many soft play/, /best rated/],
    nearbyHubs: [
      { slug: 'solihull', label: 'Solihull' },
      { slug: 'walsall', label: 'Walsall' },
      { slug: 'dudley', label: 'Dudley' },
      { slug: 'coventry', label: 'Coventry' },
    ],
    sections: [
      {
        heading: 'Soft play in Birmingham: where it is',
        paragraphs: [
          "Near the city centre, [360 Play](/soft-play/birmingham/360-play-birmingham) and [Rock Up](/soft-play/birmingham/rock-up-birmingham), which combines climbing with soft play, share Broadway Plaza on Ladywood Middleway, and [Teenie Weenies](/soft-play/birmingham/teenie-weenies-softplay-and-nursery-birmingham) is on Park Street. East of the centre are [Monster Mayhem](/soft-play/birmingham/monster-mayhem-birmingham) at Star City, [Bounce Mania](/soft-play/birmingham/bounce-mania-birmingham), [The Play Station](/soft-play/birmingham/the-play-station-birmingham) in Saltley, [Inflata Nation](/soft-play/birmingham/inflata-nation-inflatable-theme-park) at Stechford Retail Park, [Tumble & Giggle](/soft-play/birmingham/tumble-giggle-birmingham) in Yardley and the Fuzzy Ed's at [St Bernards Grange](/soft-play/birmingham/fuzzy-eds-st-bernards-grange-sheldon) in Sheldon.",
          "South Birmingham has the most choice: [Air Nation](/soft-play/birmingham/air-nation-birmingham) and [Berzerk Active Play](/soft-play/birmingham/berzerk-active-play) in Kings Heath, [The Soft Play Café](/soft-play/birmingham/the-soft-play-caf-birmingham) in Stirchley, [Humpty Dumpty's](/soft-play/birmingham/humpty-dumpty-s-birmingham) in Selly Oak, [Little Tinkers](/soft-play/birmingham/little-tinkers-birmingham) in Weoley Castle, [Treasure Island](/soft-play/birmingham/treasure-island-play-ltd-birmingham) on the Bristol Road and [Little Dots Play Village](/soft-play/birmingham/little-dots-play-village-birmingham) near Maypole. Harborne has [The Little High Street](/soft-play/birmingham/the-little-high-street) and the [Old House At Home Wacky Warehouse](/soft-play/birmingham/old-house-at-home-wacky-warehouse-birmingham). In the north, Erdington has [Flamingoo](/soft-play/birmingham/flamingoo-soft-play-birmingham), [Neverland Fun House](/soft-play/birmingham/neverland-fun-house-under-new-management-birmingham) and [Party and Play](/soft-play/birmingham/party-and-play), and Great Barr has [Wibbly Wobbly World of Play](/soft-play/birmingham/wibbly-wobbly-world-of-play-birmingham) and [Grapevine](/soft-play/birmingham/grapevine-soft-play-great-barr).",
        ],
      },
      {
        heading: 'Inflatable parks, trampolines and climbing',
        paragraphs: [
          "For older children, Inflata Nation in Stechford and Air Nation in Kings Heath are inflatable parks, and Rock Up adds climbing walls to its soft play. Birmingham's trampoline parks, [AirHop](/soft-play/birmingham/airhop-adventure-trampoline-park-birmingham-formerly-rush-birmingham) in Kings Norton and [Gravity Active](/soft-play/birmingham/gravity-active) at Star City, are listed under other family activities.",
        ],
      },
      {
        heading: 'Toddlers, SEN and play cafés',
        paragraphs: [
          "The Soft Play Café in Stirchley, Little latte Land in Quinton and The Little High Street in Harborne are smaller, café-style venues that suit toddlers. Fuzzy Ed's at St Bernards Grange is listed with a toddler area. Monster Mayhem and Rock Up are listed with SEN sessions; ask either venue for current times.",
        ],
      },
      {
        heading: 'Just outside Birmingham',
        paragraphs: [
          "Venues in nearby towns are listed separately below the Birmingham list: [Pippatopia](/soft-play/birmingham/pippatopia-smethwick) in Smethwick (ages 0–7), [360 Play](/soft-play/birmingham/360-play-redditch) and [Monster Mayhem](/soft-play/birmingham/monster-mayhem-redditch) in Redditch, [Imagination Street](/soft-play/birmingham/imagination-street-redditch) at Astwood Bank and the [Wacky Warehouse at The Broadway](/soft-play/birmingham/wacky-warehouse-broadway-willenhall) in Willenhall. See also [soft play in Solihull](/soft-play/solihull) and [soft play in Walsall](/soft-play/walsall).",
        ],
      },
    ],
    faqs: [
      {
        question: 'Where is soft play in south Birmingham?',
        answer:
          "South Birmingham has the most choice: Air Nation and Berzerk Active Play in Kings Heath, The Soft Play Café in Stirchley, Humpty Dumpty's in Selly Oak, Little Tinkers in Weoley Castle, Treasure Island on the Bristol Road and Little Dots Play Village near Maypole. AirHop trampoline park is in Kings Norton.",
      },
      {
        question: 'Where is soft play in north Birmingham and Erdington?',
        answer:
          "Erdington has Flamingoo, Neverland Fun House and Party and Play, and Great Barr has Wibbly Wobbly World of Play and Grapevine. Fuzzy Ed's at the Hare & Hounds is at Minworth, near Sutton Coldfield.",
      },
      {
        question: 'Are there trampoline and inflatable parks in Birmingham?',
        answer:
          "Yes. AirHop in Kings Norton and Gravity Active at Star City are trampoline parks, and Inflata Nation in Stechford and Air Nation in Kings Heath are inflatable parks. Rock Up on Ladywood Middleway combines climbing walls with soft play.",
      },
      {
        question: 'Is there SEN-friendly soft play in Birmingham?',
        answer:
          "Monster Mayhem at Star City and Rock Up Birmingham are listed with SEN sessions. Session times change, so ask the venue which sessions are quieter or SEN-only.",
      },
      {
        question: 'Where can I have a kids party in Birmingham?',
        answer:
          "360 Play and Rock Up on Ladywood Middleway, Party and Play in Erdington, Little Tinkers in Weoley Castle and Grapevine in Great Barr are all listed for parties. Packages and prices are set by each venue, so ask them directly.",
      },
    ],
  },

  liverpool: {
    // From our listings (Google Places addresses, types and status, checked 17 November 2026).
    kind: 'listings',
    contentUpdated: '2026-11-17',
    keepGenericFaqs: [/^How many soft play/, /best rated/],
    nearbyHubs: [
      { slug: 'manchester', label: 'Manchester' },
      { slug: 'chester', label: 'Chester' },
    ],
    sections: [
      {
        heading: 'Soft play in Liverpool: where it is',
        paragraphs: [
          "In the city centre, [Slimeville](/soft-play/liverpool/slimeville-kids-playground-liverpool) is on Duke Street. North Liverpool has [Cirq d-Play](/soft-play/liverpool/cirq-d-play-kids-indoor-play-centre-liverpool) on Great Homer Street, [Sector 8](/soft-play/liverpool/sector-8-inflatable-theme-park), an inflatable park in Norris Green, and [Amaisleys](/soft-play/liverpool/amaisleys-liverpool) and [Happy Dayz](/soft-play/liverpool/happy-dayz-liverpool) in Clubmoor, with [Imagine That!](/soft-play/liverpool/imagine-that-liverpool) nearby on Faraday Road. Around Aintree and Bootle are [Crazy Town Aintree](/soft-play/liverpool/crazy-town-aintree-liverpool), [Play Away](/soft-play/liverpool/play-away-liverpool), [Time Out](/soft-play/liverpool/time-out-liverpool) and [Manu's Wonderland](/soft-play/liverpool/manu-s-wonderland-play-centre-liverpool), and [Speckled Frogs](/soft-play/liverpool/speckled-frogs-playcentre-liverpool) is in Crosby.",
          "South Liverpool has [Jungle Fun](/soft-play/liverpool/jungle-fun-children-s-activity-centre-liverpool) in Belle Vale, [Frankie + Lola's](/soft-play/liverpool/frankie-lola-s) in Hunts Cross, [Volair Adventure Cove](/soft-play/liverpool/volair-adventure-cove-soft-play-liverpool) in Halewood and [Family Day Out](/soft-play/liverpool/family-day-out) at Otterspool. To the east are [Fun Time](/soft-play/liverpool/fun-time-soft-play-centre-liverpool) in Kirkby, [Kids Adventure Cabin](/soft-play/liverpool/kids-adventure-cabin-liverpool) in Huyton, and [Spaceworld](/soft-play/liverpool/spaceworld-soft-play-liverpool) and [Little Legend's Playhouse](/soft-play/liverpool/little-legend-s-playhouse-liverpool) in Prescot.",
        ],
      },
      {
        heading: 'Trampolines, inflatables and ninja courses',
        paragraphs: [
          "For older children, Liverpool has [Flip Out Liverpool](/soft-play/liverpool/flip-out) in the city centre and [Flip Out Aintree](/soft-play/liverpool/flip-out-aintree-liverpool), the [Ninja Warrior UK Adventure Park](/soft-play/liverpool/ninja-warrior-uk-adventure-park) at Speke, and Sector 8, an inflatable park in Norris Green; these are listed under other family activities. Jump Inc in Hunts Cross, Bounce House and Yellow Sub are shown by Google as permanently closed, so we no longer list them.",
        ],
      },
      {
        heading: 'The Wirral and nearby towns',
        paragraphs: [
          "Venues across the Mersey and in nearby towns are listed separately below the Liverpool list. On the Wirral: [Adventureland](/soft-play/liverpool/adventureland-liverpool) and [Bubbles' World of Play](/soft-play/liverpool/bubbles-world-of-play-liverpool) at New Brighton, [Monkey House](/soft-play/liverpool/monkey-house-liverpool) in Wallasey, [Little Edenville](/soft-play/liverpool/little-edenville-liverpool) and [Rascalz](/soft-play/liverpool/rascalz-play-centre-liverpool) in Birkenhead, [The Madhouse](/soft-play/liverpool/the-madhouse-liverpool) in Bebington and [Cub and Calf](/soft-play/liverpool/cub-and-calf-parent-hub-limited-liverpool) in West Kirby. North of the city: [The Fun Factor](/soft-play/liverpool/the-fun-factor-liverpool) and [KidzCove](/soft-play/liverpool/kidzcove-play-party-centre-liverpool) in Maghull, [Jungle Play](/soft-play/liverpool/jungle-play-formby-liverpool) in Formby, [JJ's Jungle](/soft-play/liverpool/jj-s-jungle-liverpool) in Ormskirk and [The Jungle](/soft-play/liverpool/the-jungle-skelmersdale-liverpool) in Skelmersdale. East: [Air Nation](/soft-play/liverpool/air-nation-liverpool) in St Helens and [Jellybeans](/soft-play/liverpool/jellybeans-play-centre-liverpool) and [The Hive](/soft-play/liverpool/the-hive-leisure-park-liverpool) in Widnes.",
        ],
      },
    ],
    faqs: [
      {
        question: 'Where is soft play in north Liverpool?',
        answer:
          "Cirq d-Play on Great Homer Street, Sector 8 inflatable park in Norris Green, Amaisleys and Happy Dayz in Clubmoor and Imagine That! on Faraday Road. Around Aintree and Bootle are Crazy Town Aintree, Play Away, Time Out and Manu's Wonderland.",
      },
      {
        question: 'Where is soft play in south Liverpool?',
        answer:
          "Jungle Fun in Belle Vale, Frankie + Lola's in Hunts Cross, Volair Adventure Cove in Halewood and Family Day Out at Otterspool. The Ninja Warrior UK Adventure Park is at Speke.",
      },
      {
        question: 'Are there trampoline parks in Liverpool?',
        answer:
          "Yes: Flip Out Liverpool in the city centre and Flip Out Aintree. The Ninja Warrior UK Adventure Park at Speke and Sector 8 inflatable park in Norris Green also suit older children. Jump Inc in Hunts Cross is shown by Google as permanently closed.",
      },
      {
        question: 'Is there soft play on the Wirral?',
        answer:
          "Yes, listed under nearby towns on this page: Adventureland and Bubbles' World of Play at New Brighton, Monkey House in Wallasey, Little Edenville and Rascalz in Birkenhead, The Madhouse in Bebington and Cub and Calf in West Kirby.",
      },
      {
        question: 'Where can I have a kids party in Liverpool?',
        answer:
          "KidzCove Play & Party Centre in Maghull and Rascalz in Birkenhead are listed for parties, and most soft play centres take party bookings. Packages and prices are set by each venue, so ask them directly.",
      },
    ],
  },

  blackpool: {
    // From our listings (Google Places addresses, types and status, checked 17 November 2026).
    kind: 'listings',
    contentUpdated: '2026-11-17',
    keepGenericFaqs: [/^How many soft play/, /best rated/],
    nearbyHubs: [{ slug: 'lancaster', label: 'Lancaster' }],
    sections: [
      {
        heading: 'Soft play in Blackpool and the Fylde coast',
        paragraphs: [
          "In Blackpool itself, [Bounce Play Centre](/soft-play/blackpool/bounce-play-centre-blackpool) is on Moor Park Avenue in Bispham and the [Air Balloon Wacky Warehouse](/soft-play/blackpool/air-balloon-wacky-warehouse-blackpool) is on Squires Gate Lane by the airport. Along the Fylde coast, [Funtastic Play](/soft-play/blackpool/funtastic-play-blackpool) and [Harry's Play Centre](/soft-play/blackpool/harry-s-play-centre-blackpool) are in Lytham St Annes, [Tea and Tumbles](/soft-play/blackpool/tea-and-tumbles-blackpool) is in Thornton-Cleveleys, [Thingamajigz](/soft-play/blackpool/thingamajigz-blackpool) is on Poulton Business Park, and [Play and Bee](/soft-play/blackpool/play-and-bee-role-play-centre-blackpool), a role-play centre, is at Hambleton.",
        ],
      },
      {
        heading: 'Trampolines and family attractions',
        paragraphs: [
          "[AirHop Blackpool](/soft-play/blackpool/airhop-adventure-trampoline-park) on Cornford Road is a trampoline and adventure park. The [Blackpool Zoo Playbarn](/soft-play/blackpool/blackpool-zoo-playbarn-blackpool) and [Coral Island](/soft-play/blackpool/coral-island-blackpool) on the Promenade are listed under other family activities, as is Funland, an arcade on the Promenade. Roarsome Roleplay in Lytham St Annes is shown by Google as permanently closed, so we no longer list it.",
        ],
      },
      {
        heading: 'Preston and Southport',
        paragraphs: [
          "Venues further afield are listed separately below the Blackpool list: [Little Beans Play Cafe](/soft-play/blackpool/little-beans-play-cafe-blackpool) and [The Kinder Hub](/soft-play/blackpool/the-kinder-hub-blackpool) in Cottam, both in Preston, and [Kinderworld Play Barn](/soft-play/blackpool/kinderworld-play-barn) in Southport. For Lancaster, see [soft play in Lancaster](/soft-play/lancaster).",
        ],
      },
    ],
    faqs: [
      {
        question: 'Where is soft play in Blackpool?',
        answer:
          "In Blackpool, Bounce Play Centre is in Bispham and the Air Balloon Wacky Warehouse is on Squires Gate Lane. Along the Fylde coast there are Funtastic Play and Harry's Play Centre in Lytham St Annes, Tea and Tumbles in Thornton-Cleveleys, Thingamajigz in Poulton and Play and Bee at Hambleton.",
      },
      {
        question: 'Is there soft play in Lytham St Annes?',
        answer:
          "Yes: Funtastic Play on Snowdon Road and Harry's Play Centre at the YMCA on St Alban's Road. Roarsome Roleplay, which shared Snowdon Road, is shown by Google as permanently closed.",
      },
      {
        question: 'Is there a trampoline park in Blackpool?',
        answer:
          "Yes: AirHop Adventure & Trampoline Park on Cornford Road. Coral Island and the Blackpool Zoo Playbarn are other indoor options for a wet day, listed under family activities.",
      },
      {
        question: 'Is there role-play soft play near Blackpool?',
        answer:
          "Play and Bee Role Play Centre at Hambleton, near Poulton-le-Fylde, is built around role play. Most other Fylde coast venues are traditional soft play frames.",
      },
      {
        question: 'Is there soft play near Preston?',
        answer:
          "Little Beans Play Cafe on Fylde Road and The Kinder Hub at Cottam are both in Preston, and are listed separately on this page under nearby towns.",
      },
    ],
  },
}

/**
 * A category page (/toddler, /birthday-parties, /sen-friendly) is only indexable with this many
 * matching venues. Guide hubs are small, so a one-venue category is a thin duplicate of the hub.
 */
export function minFilterVenues(citySlug: string): number {
  return GUIDES[citySlug] ? 2 : 1 // data guides (below) are for large hubs and don't change this
}

export function getHubGuide(citySlug: string): HubGuide | undefined {
  return GUIDES[citySlug]
}

/** `Soft Play in Brighton & Hove: 6 Indoor Play Centres (2026)` — N is the live main-list count. */
export function buildGuideTitle(name: string, total: number, year: number): string {
  if (total <= 0) return `Soft Play in ${name}`
  return `Soft Play in ${name}: ${total} Indoor Play ${total === 1 ? 'Centre' : 'Centres'} (${year})`
}

/**
 * A guide hub's FAQ: the generic data questions it keeps (keepGenericFaqs), then its own.
 * Without keepGenericFaqs, the generic list fills the room the guide's FAQs leave. Capped at MAX_FAQS.
 */
export function composeGuideFaqs(guide: HubGuide, generic: Faq[]): Faq[] {
  const hasParty = guide.faqs.some((f) => /part(y|ies)/i.test(f.question))
  const kept = guide.keepGenericFaqs
    ? generic.filter((f) => guide.keepGenericFaqs!.some((re) => re.test(f.question)))
    : generic.filter((f) => !(hasParty && /birthday party/i.test(f.question))).slice(0, Math.max(0, MAX_FAQS - guide.faqs.length))
  return [...kept, ...guide.faqs].slice(0, MAX_FAQS)
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
  // A venue's town is only worth naming when it differs from the hub ("Adventure Play Town in Hull" on the Hull page says nothing).
  const areaOf = (slug: string) => {
    const area = venues.find((v) => v.slug === slug)?.area
    return area && area.toLowerCase() !== name.toLowerCase() ? area : null
  }
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


// ── Data-driven guides ────────────────────────────────────────────────────────────────────
//
// For big hubs, a guide built entirely from the hub's own listing data at render time: counts,
// which venues list a toddler area / parties / SEN-friendliness, and the best-rated venues
// (20+ reviews). Nothing is written by hand about a venue, so nothing can be stale or invented;
// where the data has no answer the section is omitted. Names are only used when the listing's
// postcode sits in the hub's own area (`postcodeAreas`), so a venue wrongly filed under the hub
// (a Glasgow listing under Birmingham, say) is never presented as local.

export interface GuideVenue extends StatsVenue {
  postcode?: string | null
  area?: string | null
  baby_area?: boolean
}

interface DataGuideConfig {
  /** Outward postcodes (e.g. "LS14") whose venues may be named. Omit = no restriction. */
  allow?: RegExp
  nearbyHubs: { slug: string; label: string }[]
  londonAreas?: boolean
}

const DATA_GUIDES: Record<string, DataGuideConfig> = {
  london: { londonAreas: true, nearbyHubs: [{ slug: 'dartford', label: 'Dartford' }, { slug: 'southend', label: 'Southend-on-Sea' }] },
  birmingham: { allow: /^(B|CV|DY|WS|WV|TF|WR)\d/, nearbyHubs: [{ slug: 'stoke', label: 'Stoke-on-Trent' }] },
  manchester: { allow: /^(M|SK)\d/, nearbyHubs: [{ slug: 'bolton', label: 'Bolton' }, { slug: 'mossley', label: 'Mossley' }, { slug: 'liverpool', label: 'Liverpool' }] },
  edinburgh: { allow: /^EH\d/, nearbyHubs: [{ slug: 'glasgow', label: 'Glasgow' }] },
  liverpool: { allow: /^L\d/, nearbyHubs: [{ slug: 'manchester', label: 'Manchester' }] },
  bristol: { allow: /^BS\d/, nearbyHubs: [{ slug: 'cardiff', label: 'Cardiff' }] },
  leeds: { allow: /^LS\d/, nearbyHubs: [{ slug: 'bradford', label: 'Bradford' }, { slug: 'halifax', label: 'Halifax' }, { slug: 'huddersfield', label: 'Huddersfield' }, { slug: 'york', label: 'York' }] },
  swansea: { allow: /^SA([1-9]|1[0-3])$/, nearbyHubs: [{ slug: 'llanelli', label: 'Llanelli' }, { slug: 'cardiff', label: 'Cardiff' }] },
  glasgow: { allow: /^G\d/, nearbyHubs: [{ slug: 'edinburgh', label: 'Edinburgh' }] },
  sheffield: { allow: /^S([1-9]|1\d|2\d|3[0-6])$/, nearbyHubs: [{ slug: 'barnsley', label: 'Barnsley' }, { slug: 'doncaster', label: 'Doncaster' }] },
}

export function hasDataGuide(citySlug: string): boolean {
  return citySlug in DATA_GUIDES
}

const outward = (pc: string | null | undefined) => pc?.trim().toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/)?.[1] ?? null
const postcodeArea = (pc: string | null | undefined) => outward(pc)?.match(/^[A-Z]+/)?.[0] ?? null

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function link(citySlug: string, v: GuideVenue): string {
  const label = v.name.replace(/[\[\]()]/g, '').trim()
  return `[${label}](/soft-play/${citySlug}/${v.slug})`
}

/** "[A](/…) (M14), [B](/…) (M20) and 3 more" — most-reviewed first, so the choice is data, not taste. */
function nameList(citySlug: string, venues: GuideVenue[], limit = 8): string {
  const sorted = [...venues].sort((a, b) => Number(b.review_count ?? 0) - Number(a.review_count ?? 0) || a.name.localeCompare(b.name))
  const shown = sorted.slice(0, limit).map((v) => {
    const d = outward(v.postcode)
    return `${link(citySlug, v)}${d ? ` (${d})` : ''}`
  })
  const more = sorted.length - shown.length
  const parts = more > 0 ? [...shown, `${more} more`] : shown
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * The guide for a hub in DATA_GUIDES, from its main-list venues; undefined for any other hub or if
 * there are fewer than 4 venues. `blog` is the hub's own "best of" post, linked as editorial picks.
 */
export function buildDataGuide(
  citySlug: string,
  cityName: string,
  venues: GuideVenue[],
  blog?: { slug: string; title: string } | null
): HubGuide | undefined {
  const cfg = DATA_GUIDES[citySlug]
  if (!cfg || venues.length < 4) return undefined

  const n = venues.length
  const nameable = cfg.allow ? venues.filter((v) => cfg.allow!.test(outward(v.postcode) ?? '')) : venues
  const toddler = nameable.filter((v) => v.toddler_area)
  const baby = nameable.filter((v) => v.baby_area && !v.toddler_area)
  const parties = nameable.filter((v) => v.parties)
  const sen = nameable.filter((v) => v.sen_friendly)
  const top = rankTopRated(nameable, 5)
  const sections: GuideSection[] = []
  // When only some listings can be named (the rest have a postcode outside the hub's area), say so
  // rather than implying the named venues are all of them.
  const inCity = nameable.length < n ? `${cityName}'s own postcodes` : cityName

  // 1. overview
  const counts: string[] = []
  const nT = venues.filter((v) => v.toddler_area).length
  const nB = venues.filter((v) => v.baby_area).length
  const nP = venues.filter((v) => v.parties).length
  const nS = venues.filter((v) => v.sen_friendly).length
  if (nT) counts.push(`${nT} ${nT === 1 ? 'lists' : 'list'} a toddler area`)
  if (nB) counts.push(`${nB} ${nB === 1 ? 'lists' : 'list'} a baby area`)
  if (nP) counts.push(`${nP} ${nP === 1 ? 'offers' : 'offer'} birthday parties`)
  if (nS) counts.push(`${nS} ${nS === 1 ? 'is' : 'are'} marked SEN-friendly`)
  const countText = counts.length <= 1 ? counts.join('') : `${counts.slice(0, -1).join(', ')} and ${counts[counts.length - 1]}`
  const overview = [
    `We list ${plural(n, 'soft play centre')} in ${cityName}${counts.length ? `. Of those, ${countText}` : ''}.`,
  ]
  if (!cfg.londonAreas) {
    const byDistrict = new Map<string, number>()
    for (const v of venues) {
      const d = outward(v.postcode)
      if (d) byDistrict.set(d, (byDistrict.get(d) ?? 0) + 1)
    }
    const busiest = [...byDistrict.entries()].filter(([, k]) => k >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4)
    if (busiest.length >= 2) overview.push(`The postcode districts with the most listings are ${busiest.map(([d, k]) => `${d} (${k})`).join(', ')}.`)
  }
  if (blog) overview.push(`For our editorial picks, read [${blog.title}](/blog/${blog.slug}); this page is the complete, current list.`)
  sections.push({ heading: `Soft play in ${cityName}: a local guide`, paragraphs: [overview.join(' ')] })

  // 2. London areas (postcode prefixes from lib/londonAreas.ts)
  if (cfg.londonAreas) {
    const lines: string[] = []
    for (const area of LONDON_AREAS) {
      const inArea = venues.filter((v) => getLondonAreaSlug(v.postcode) === area.slug)
      if (!inArea.length) continue
      const prefixes = [...new Set(inArea.map((v) => postcodeArea(v.postcode)).filter((x): x is string => !!x))].sort()
      lines.push(`${area.name} (${prefixes.join(', ')}): ${plural(inArea.length, 'centre')}, including ${nameList(citySlug, inArea, 3)}.`)
    }
    if (lines.length) sections.push({ heading: `Soft play in London by area`, paragraphs: lines })
  }

  // 3. toddlers and babies
  if (toddler.length || baby.length) {
    const p: string[] = []
    if (toddler.length) p.push(`${plural(toddler.length, 'venue')} in ${inCity} ${toddler.length === 1 ? 'lists' : 'list'} a toddler area: ${nameList(citySlug, toddler)}.`)
    if (baby.length) p.push(`${baby.length === 1 ? 'Another lists' : `${baby.length} more list`} a baby area: ${nameList(citySlug, baby)}.`)
    sections.push({ heading: 'Babies and toddlers', paragraphs: p })
  }

  // 4. parties
  if (parties.length) {
    sections.push({
      heading: 'Birthday parties',
      paragraphs: [`${plural(parties.length, 'venue')} in ${inCity} ${parties.length === 1 ? 'is' : 'are'} listed as offering birthday parties: ${nameList(citySlug, parties)}. Packages and prices are set by each venue, so ask them for a current quote.`],
    })
  }

  // 5. SEN
  if (sen.length) {
    sections.push({
      heading: 'SEN-friendly soft play',
      paragraphs: [`${plural(sen.length, 'venue')} in ${inCity} ${sen.length === 1 ? 'is' : 'are'} listed as SEN-friendly: ${nameList(citySlug, sen)}. What that means varies — quiet sessions, sensory rooms, smaller groups — so ask the venue what it offers and when.`],
    })
  }

  // 6. best rated
  if (top.length) {
    const bySlug = new Map(nameable.map((v) => [v.slug, v]))
    const items = top.map((t) => `${link(citySlug, bySlug.get(t.slug)!)} ${t.rating.toFixed(1)} from ${t.reviews.toLocaleString('en-GB')} reviews`)
    sections.push({
      heading: 'Highest rated',
      paragraphs: [`Venues with ${MIN_REVIEWS_FOR_TOP_RATED} or more reviews, best rated first: ${items.join('; ')}.`],
    })
  }

  return { kind: 'listings', sections, faqs: [], nearbyHubs: cfg.nearbyHubs }
}
