/**
 * Brighton and Worthing guides. Every venue fact below was read from the venue's own website (or
 * Google Places for opening status) on 25 October 2026 and matches lib/hubGuides.ts. Ratings, prices
 * and counts are deliberately NOT repeated here: they change, and the hub pages show them live.
 * Where a fact could not be verified it is left out.
 */
import type { BlogPost } from './blogPosts'

const PUBLISHED = '2026-10-26T00:00:00.000Z'
const CHECKED = '25 October 2026'
const link = (href: string, label: string) => `<a href="${href}" class="text-purple-700 hover:underline">${label}</a>`

const HUB_B = '/soft-play/brighton'
const HUB_W = '/soft-play/worthing'
const v = (hub: string, slug: string, label: string) => link(`${hub}/${slug}`, label)

const space = v(HUB_W, 'space-station-soft-play-ltd', 'Space Station')
const lighthouse = v(HUB_W, 'the-lighthouse-soft-play-and-cafe', 'The Lighthouse')
const outOfBounds = v(HUB_W, 'out-of-bounds', 'Out of Bounds')
const fortress = link('/soft-play/bognor-regis/flying-fortress', 'Flying Fortress')
const harbour = v(HUB_W, 'harbour-park-indoor-soft-play', 'Harbour Park')
const lpv = v(HUB_W, 'the-little-play-village', 'The Little Play Village')

export const sussexPosts: BlogPost[] = [
  {
    slug: 'best-soft-play-in-worthing',
    title: 'Best Soft Play in Worthing (2026 Parent Guide)',
    city: 'Worthing',
    excerpt:
      'A fact-checked guide to soft play in and around Worthing: what each centre says about ages, parties and booking, and which ones are in Lancing, Ford, Angmering and Littlehampton rather than Worthing itself.',
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    verifiedOn: CHECKED,
    contentHtml: `<p>Worthing's soft play is mostly independent and community-run. Several of the larger venues are a short drive outside the town, so it helps to know where each one actually is before you set off. This guide only states what the venues say on their own websites (checked ${CHECKED}); we leave out prices and opening hours because they change.</p>

<blockquote><p>👉 See all ${link(HUB_W, '<strong>soft play in Worthing</strong>')}, with ratings, opening hours and map details.</p></blockquote>

<h2>${space}, Lancing</h2>
<p>${space} describes its play centre as for ages 0–12 and runs timed sessions. It takes walk-ins but can't guarantee a space when it is full, so ring ahead. It has two party rooms and a private hire option.</p>

<h2>${lighthouse}, Worthing</h2>
<p>${lighthouse} lists entry prices for babies from birth on its website and takes party bookings. Its site lists Wednesday to Friday opening only, so check before you go.</p>

<h2>${outOfBounds}, Angmering</h2>
<p>The one for a mixed-age group: ${outOfBounds} combines soft play with ten-pin bowling, laser tag, high ropes and adventure golf, and runs a pre-school Climb 'n' Soft Play session. It publishes party information.</p>

<h2>${fortress}, Ford</h2>
<p>${fortress} prices children up to age 13 and publishes party information. It is closed on Mondays.</p>

<h2>${harbour}, Littlehampton</h2>
<p>${harbour}'s soft play is for children up to 9, with a separate baby soft play for 0–18 months. It says you can pay on arrival without booking, though peak times may limit play to a one-hour session. It publishes party information.</p>

<h2>${lpv}, Goring</h2>
<p>${lpv} is a role-play village rather than a conventional soft play centre. It runs on ticketed event dates, so book ahead, and it also runs parties.</p>

<h2>How to choose</h2>
<ul>
  <li><strong>Babies and toddlers:</strong> ${harbour} (baby area for 0–18 months), ${space} (ages 0–12) or ${lighthouse} (prices listed from birth). More in our ${link('/blog/baby-and-toddler-soft-play-in-brighton-and-worthing', 'baby and toddler guide')}.</li>
  <li><strong>Mixed ages or a bigger outing:</strong> ${outOfBounds}.</li>
  <li><strong>A party:</strong> see our ${link('/blog/kids-party-venues-in-worthing', 'Worthing party venue guide')}.</li>
  <li><strong>Wet weather:</strong> every venue above is indoors.</li>
</ul>

<h2>Before you go</h2>
<p>Opening days differ between venues, and weekends and school holidays fill up, so ring or check the venue's site first. For ratings, review counts and the full list, see ${link(HUB_W, 'soft play in Worthing')}. Heading east? Try ${link(HUB_B, 'soft play in Brighton')} and Hove.</p>`,
    faq: [
      {
        q: 'Is there soft play in Worthing itself?',
        a: 'The Lighthouse is in Worthing. Several other centres people search for under Worthing are just outside it: Space Station in Lancing, Out of Bounds in Angmering, Flying Fortress in Ford and Harbour Park in Littlehampton.',
      },
      {
        q: 'Do I need to book soft play in Worthing?',
        a: 'It depends on the venue. Space Station accepts walk-ins but cannot guarantee a space when full. Harbour Park says you can pay on arrival without booking. For weekends and school holidays, ring first.',
      },
      {
        q: 'Which Worthing soft play is best for older children?',
        a: 'Out of Bounds combines soft play with ten-pin bowling, laser tag, high ropes and adventure golf. Flying Fortress prices children up to age 13.',
      },
    ],
  },
  {
    slug: 'kids-party-venues-in-worthing',
    title: "Kids' Party Venues in Worthing (2026 Guide)",
    city: 'Worthing',
    excerpt:
      "Soft play party venues in and around Worthing, based on what each venue publishes: Space Station, The Lighthouse, Out of Bounds, Flying Fortress, Harbour Park and The Little Play Village.",
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    verifiedOn: CHECKED,
    contentHtml: `<p>These venues publish party information on their own websites (checked ${CHECKED}). Packages, prices and availability are set by each venue and change, so we don't quote them: use the venue's page for a current quote.</p>

<ul>
  <li><strong>${space} (Lancing):</strong> two party rooms and a private hire option.</li>
  <li><strong>${lighthouse} (Worthing):</strong> lists party bookings on its website.</li>
  <li><strong>${outOfBounds} (Angmering):</strong> soft play plus ten-pin bowling, laser tag, high ropes and adventure golf, so it suits older children too.</li>
  <li><strong>${fortress} (Ford):</strong> prices children up to age 13.</li>
  <li><strong>${harbour} (Littlehampton):</strong> publishes party information; its soft play is for children up to 9.</li>
  <li><strong>${lpv} (Goring):</strong> a role-play village rather than a conventional soft play centre; it also runs parties.</li>
</ul>

<h2>Before you book</h2>
<p>Ask what is included in the price, the minimum number of children, how long you get the room and whether food is provided. Book well ahead for weekends and school holidays. See the ${link(HUB_W + '/birthday-parties', 'Worthing birthday party page')} for venues flagged for parties, or ${link('/blog/best-soft-play-in-worthing', 'our Worthing soft play guide')}. For every venue, see ${link(HUB_W, 'soft play in Worthing')}; further east, ${link(HUB_B, 'soft play in Brighton')}.</p>`,
    faq: [
      {
        q: 'Where can I have a kids party in Worthing?',
        a: 'Space Station (Lancing) has two party rooms and a private hire option, and The Lighthouse (Worthing) lists party bookings. Out of Bounds, Flying Fortress, Harbour Park and The Little Play Village also publish party information.',
      },
      {
        q: 'How much does a soft play party cost in Worthing?',
        a: 'Prices are set by each venue and change, so we do not quote them. Check the venue page or ask for a current quote.',
      },
    ],
  },
  {
    slug: 'baby-and-toddler-soft-play-in-brighton-and-worthing',
    title: 'Baby and Toddler Soft Play in Brighton and Worthing (2026)',
    city: 'Brighton',
    excerpt:
      "Which soft play near Brighton and Worthing says it caters for babies and toddlers: Harbour Park's baby area, Space Station, The Lighthouse, Out of Bounds and The Doves Play Barn.",
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    verifiedOn: CHECKED,
    contentHtml: `<p>What each venue says about under-fives on its own website (checked ${CHECKED}). If a venue isn't listed, we couldn't confirm anything about baby or toddler provision.</p>

<h2>Near Worthing</h2>
<ul>
  <li>${harbour} (Littlehampton) has a separate baby soft play for 0–18 months and says you can pay on arrival without booking.</li>
  <li>${space} (Lancing) describes its play centre as for ages 0–12 and runs timed sessions; ring ahead because it can't guarantee a space when full.</li>
  <li>${lighthouse} (Worthing) lists entry prices for babies from birth.</li>
  <li>${outOfBounds} (Angmering) runs a pre-school Climb 'n' Soft Play session.</li>
</ul>

<h2>Near Brighton</h2>
<ul>
  <li>${v(HUB_B, 'the-doves-play-barn', 'The Doves Play Barn')} (Furner's Green, near Uckfield) describes a toddler-safe area alongside hidden spaces, rope bridges and slides, with a café.</li>
</ul>
<p>We couldn't read toddler details for the soft play centres inside Brighton and Hove, so we don't make claims about them; see ${link(HUB_B, 'soft play in Brighton')} and check with the venue.</p>

<p>More: ${link(HUB_W, 'soft play in Worthing')} · ${link('/blog/best-soft-play-in-worthing', 'Worthing soft play guide')} · ${link(HUB_B, 'soft play in Brighton')}.</p>

<p>Planning further afield? See our <a href="/blog/baby-and-toddler-soft-play-uk" class="text-purple-700 hover:underline">UK baby and toddler soft play guide</a>.</p>
`,
    faq: [
      {
        q: 'Is there baby soft play near Worthing?',
        a: 'Harbour Park in Littlehampton has a separate baby soft play for 0–18 months. The Lighthouse in Worthing lists entry prices for babies from birth.',
      },
      {
        q: 'Which soft play near Brighton has a toddler area?',
        a: 'The Doves Play Barn at Furner\'s Green, near Uckfield, describes a toddler-safe area, with a café.',
      },
    ],
  },
  {
    slug: 'rainy-day-things-to-do-with-kids-in-brighton',
    title: 'Rainy Day Things to Do with Kids in Brighton (2026)',
    city: 'Brighton',
    excerpt:
      'Indoor options for a wet day in and around Brighton and Hove: soft play, inflatable parks and role-play, with what each venue says about booking and opening.',
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    verifiedOn: CHECKED,
    contentHtml: `<p>Indoor options on our list, with only the facts the venues publish (checked ${CHECKED}). Ring before you go: wet days fill venues up.</p>

<h2>In Brighton and Hove</h2>
<p>${v(HUB_B, 'funplex', 'Funplex')} (BN2) and ${v(HUB_B, 'palace-play', 'Palace Play')} (Brighton Palace Pier) are the indoor play options we list in the city, alongside Level Up at Withdean. ${v(HUB_B, 'playcafe-brighton', 'Playcafé')} is a term-time toddler café at St Matthias Church. Check each one's current opening before you travel.</p>

<h2>Worth the drive</h2>
<ul>
  <li>${v(HUB_B, 'the-doves-play-barn', 'The Doves Play Barn')} near Uckfield says it is open seven days a week, 9am to 5pm.</li>
  <li>${v(HUB_B, 'jumpin-fun-inflatable-park-burgess-hill', 'Jumpin Fun')} in Burgess Hill is a 25,000 sq ft inflatable park with a mega slide, ball pit and ninja course.</li>
  <li>${v(HUB_B, 'sharkys', "Sharky's")} at Henfield Leisure Centre is a nut-free site with a café; sessions are often fully booked, so book ahead.</li>
  <li>${v(HUB_B, 'monkey-bizness-lewes', 'Monkey Bizness')} in Lewes publishes party packages if the rain lands on a birthday.</li>
</ul>

<h2>Towards Worthing</h2>
<p>Every venue in our ${link('/blog/best-soft-play-in-worthing', 'Worthing guide')} is indoors, from ${space} in Lancing to ${outOfBounds}, which adds bowling, laser tag and high ropes.</p>

<p>See all the options in ${link(HUB_B, 'soft play in Brighton')}, or ${link(HUB_W, 'soft play in Worthing')} if you're heading west.</p>`,
    faq: [
      {
        q: 'What can you do with kids in Brighton when it rains?',
        a: 'Indoor play options include Level Up, Funplex and Palace Play on Brighton Palace Pier. Bigger venues are in Lewes, Henfield, Burgess Hill and near Uckfield and Lindfield.',
      },
    ],
  },
  {
    slug: 'trampoline-parks-in-brighton-and-sussex',
    title: 'Trampoline Parks in Brighton and Sussex (2026)',
    city: 'Brighton',
    excerpt:
      "We can't confirm an open trampoline park in Brighton: Sky High in Peacehaven is shown as permanently closed. Here's what we can say, and the nearest bounce-style venue we list.",
    publishedAt: PUBLISHED,
    updatedAt: PUBLISHED,
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    verifiedOn: CHECKED,
    // Thin until a trampoline park is verified open — kept reachable but out of search and the sitemap.
    noindex: true,
    contentHtml: `<p>We don't list an open trampoline park in Brighton and Hove. Google shows Sky High Trampoline Park in Peacehaven as permanently closed (checked ${CHECKED}).</p>

<p>The nearest bounce-style venue we list is ${v(HUB_B, 'jumpin-fun-inflatable-park-burgess-hill', 'Jumpin Fun in Burgess Hill')}, a 25,000 sq ft inflatable park with a mega slide, ball pit and ninja course. It is an inflatable park, not a trampoline park.</p>

<p>If you know of an open trampoline park in Sussex, ${link('/add-venue', 'tell us')} and we'll verify it. In the meantime see ${link(HUB_B, 'soft play in Brighton')} and ${link(HUB_W, 'soft play in Worthing')}.</p>`,
    faq: [
      {
        q: 'Are there trampoline parks in Brighton?',
        a: 'Not one we can confirm as open. Sky High Trampoline Park in Peacehaven is shown by Google as permanently closed.',
      },
    ],
  },
]
