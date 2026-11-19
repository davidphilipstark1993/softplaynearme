/**
 * Seasonal guide: Santa events at UK soft play centres, Christmas 2026. Hand-written; every date, price and
 * inclusion was checked on the venue's own website on 19 November 2026 (sources listed in
 * /workspace/softplay/blog/pending/santa-at-soft-play-uk/sources.md). One venue per region/nation,
 * regions in alphabetical order; only venues already listed on the site.
 */
import type { BlogPost } from './blogPosts'

const link = (href: string, label: string) => `<a href="${href}" class="text-purple-700 hover:underline">${label}</a>`
const v = (path: string, label: string) => link(`/soft-play/${path}`, label)
const ext = (href: string, label: string) =>
  `<a href="${href}" class="text-purple-700 hover:underline" target="_blank" rel="noopener nofollow">${label}</a>`

export const santaPosts: BlogPost[] = [
  {
    slug: 'santa-at-soft-play-uk',
    title: 'Santa at Soft Play 2026: Grottos and Breakfast with Santa Across the UK',
    metaTitle: 'Santa at Soft Play 2026: UK Grottos | Soft Play Near Me',
    metaDescription:
      'Santa grottos and breakfast with Santa at UK soft play centres for Christmas 2026: one venue per region, with dates, prices and what is included.',
    city: 'UK',
    excerpt:
      'Lots of soft play centres turn part of the building into a Santa’s grotto in December, and many include a play session in the ticket. On the venue websites we checked on 19 November 2026, per-child prices at the venues that list one ran from £9.50 (Santa and soft play, no gift) to £21.95 (Santa, a gift, a hat and two hours of soft play), on our reading of the listed prices. Most tickets are non-refundable and many slots are limited to a handful of December dates, so it pays to book early.',
    publishedAt: '2026-11-19T00:00:00.000Z',
    updatedAt: '2026-11-19T00:00:00.000Z',
    datePublished: '2026-11-19T00:00:00.000Z',
    dateModified: '2026-11-19T00:00:00.000Z',
    verifiedOn: '19 November 2026',
    contentHtml: `<h2>What does a soft play Santa visit include?</h2>
<p>Many soft play Santa events combine three things: a short private visit to Santa in a grotto, a small gift, and a soft play session before or after. Some add extras such as a letter-writing table, crafts, a Santa hat or a breakfast. The details vary a lot, so read exactly what the ticket covers. On the venue pages we checked:</p>
<ul>
  <li>Some tickets include play time. At ${v('harlow/little-monsters-house-of-fun', 'Little Monsters House of Fun')} the £21.95 ticket includes two hours of soft play, a gift and a Santa hat.</li>
  <li>Some don’t include a gift. At ${v('stourbridge/scallywags-indoor-play-centre-birmingham', 'Scallywags')} the cheapest £9.50 package (weekdays only) is Santa and soft play without a toy.</li>
  <li>Some need a separate entry ticket. At ${v('hastings/knockhatch-adventure-park-hastings', 'Knockhatch Adventure Park')} the £9.99 grotto ticket does not include park entry, which you buy separately.</li>
  <li>Adults are often cheap or free, but not always. Little Monsters charges adults £2.50, World of Wonder £1.50 and Scallywags £1 (adults are free at its SEN session), while Poppelwood says adults go free.</li>
</ul>

<h2>Grotto or breakfast with Santa: which suits toddlers?</h2>
<p>A grotto visit is usually the simpler choice for under-3s. The meeting with Santa is short (Little Monsters gives a 10-minute slot, World of Wonder books five-minute slots) and children play before or after, so there is less sitting still. A breakfast with Santa usually takes longer and includes a meal, which can suit older toddlers and pre-schoolers who enjoy a sense of occasion. Whichever you choose, book a session that fits around naps, and arrive at the start of your play session rather than at your grotto time if the venue asks you to. Little Monsters, for example, asks families to arrive at the beginning of the play session and sends an elf to collect you when it is your turn.</p>

<h2>Where can I see Santa at soft play this Christmas?</h2>
<p>These are venues already listed on Soft Play Near Me whose own websites showed Santa events for this December when we checked on 19 November 2026. We have included one per region or nation, in alphabetical order. Prices and dates can change and slots sell out, so always check the venue’s booking page before you travel.</p>

<h3>East of England</h3>
<p>${v('harlow/little-monsters-house-of-fun', 'Little Monsters House of Fun')}, Great Dunmow, Essex: Santa’s Grotto 2026 in a log cabin in the garden. £21.95 per child includes the visit, a gift, a Santa hat and two hours of soft play with a reserved table; adults £2.50. Groups are limited to six people per slot, and tickets are non-refundable. ${ext('https://www.littlemonstershof.co.uk/events/little-monsters-santas-grotto/', 'Little Monsters Santa’s Grotto')}</p>

<h3>East Midlands</h3>
<p>${v('nottingham/mighty-monsters-nottingham', 'Mighty Monsters')}, Stapleford, Nottingham: “Santa &amp; the Grinch” on Sunday 6 December, 10am to 1pm, with soft play, a Grinch and Santa show and a visit to Santa’s Grotto. Tickets are £30 for one child and one adult, or £55 for two children and one adult. ${ext('https://www.mightymonsterssoftplay.co.uk/christmas-2026', 'Christmas at Mighty Monsters')}</p>

<h3>London</h3>
<p>We haven’t yet confirmed a 2026 Santa event at a London soft play centre listed on our site. ${v('london/crazy-club-soft-play-soft-play-in-sidcup-kent-london', 'Crazy Club')} in Sidcup has a Santa’s Grotto page (£15 per ticket for one child and one adult, with soft play and a gift, plus SEN Santa sessions), but its page says the grotto opens 'from Sunday 17th December', and 17 December 2026 is a Thursday (17 December was a Sunday in 2023), so ask the centre for this year’s dates before booking. ${ext('https://www.crazy-club.co.uk/santas-grotto', 'Crazy Club Santa’s Grotto')}</p>

<h3>North East</h3>
<p>We haven’t confirmed a 2026 Santa event at a soft play centre listed in the North East yet. Check your ${link('/soft-play', 'town page')} and ask local centres directly.</p>

<h3>North West</h3>
<p>${v('liverpool/spaceworld-soft-play-liverpool', 'Spaceworld Play Centre')}, Prescot: the events page lists a Christmas Fair with Santa (19 December), Storytime with Santa (20 December), Breakfast with Santa and an SEN Playtime with Santa (23 December), and a Christmas Eve Breakfast with Santa, PJ Party with Santa and SEN PJ Party with Santa (24 December). The events page gives no prices; book through its online booking page. ${ext('https://www.spaceworldplaycentre.co.uk/events', 'Spaceworld events')}</p>

<h3>Northern Ireland</h3>
<p>${v('belfast/airtastic-entertainment-centre', 'Airtastic Belfast (Newtownabbey)')}: a Snow Ball Christmas Party in the soft play centre on Tuesday 15 December at 4.30pm, with 90 minutes of soft play, party food, festive games and a chance to meet Santa. Tickets are £14.95 per child for soft play members or £17.95 for non-members, bought in advance from the soft play reception. The same party runs at Airtastic Bangor and Craigavon. ${ext('https://air-tastic.com/latest-news/snow-ball-christmas-parties', 'Airtastic Snow Ball Parties')}</p>

<h3>Scotland</h3>
<p>${v('aberdeen/wynford-farm-park-aberdeen', 'Wynford Farm Park')}, Aberdeen: Santa’s Mega Grotto Experience from 27 November right up to Christmas, plus a Santa’s BIG Brunch Send-Off on 24 December. The farm park has indoor soft play in its PlayBarn. The website gives no prices on the page; check its booking pages. ${ext('https://www.wynfordfarm.com/', 'Wynford Farm Park')}</p>

<h3>South East</h3>
<p>${v('hastings/knockhatch-adventure-park-hastings', 'Knockhatch Adventure Park')}, Hailsham, East Sussex: a Father Christmas Grotto in the Froggies indoor soft play building on 5–6, 12–13 and 19–23 December, 11am to 1pm and 2pm to 5pm. £9.99 per child including a wrapped present; park entry is extra and needed for everyone. Grotto tickets are sold on the day and work on a virtual queue, and cannot be refunded or moved. ${ext('https://knockhatch.com/father-christmas-grotto', 'Knockhatch Father Christmas Grotto')}</p>

<h3>South West</h3>
<p>${v('barnstaple/world-of-wonder-soft-play', 'World of Wonder')}, Bideford, Devon: Santa’s Grotto on 18–22 December, 10am to 3pm. £15.95 for children up to 11 and £10.95 for under-2s, plus £1.50 per adult. The Santa page contradicts itself on play: it says the £15.95 children’s ticket 'includes admission to wow' and that two hours of play are included, but also says grotto tickets 'DO NOT include admission to WOW'. Ask World of Wonder which applies before you book. Gifts are confectionery, so list any allergies when booking; tickets are non-refundable. ${ext('https://www.worldofwonderdevon.co.uk/santas-grotto/', 'World of Wonder Santa’s Grotto')}</p>

<h3>Wales</h3>
<p>${v('cardiff/poppelwood-play-centre', 'Poppelwood Play Centre')}, Caerphilly: Santa’s Grotto at £11.50 per child, which includes Santa’s letter room, a visit to Santa in his woodland cabin and two hours of soft play. Each booking reserves a table for up to four people; adults and babies under 12 months go free. Bookings are non-refundable but can be rescheduled up to an hour before. ${ext('https://www.poppelwoodsoftplay.com/service-page/santa-s-grotto-1', 'Poppelwood Santa’s Grotto')}</p>

<h3>West Midlands</h3>
<p>${v('stourbridge/scallywags-indoor-play-centre-birmingham', 'Scallywags')}, Brierley Hill: Santa in a wooden grotto with soft play included. Packages are £9.50 (Santa and soft play, no gift, weekdays only), £13.95 with a toy, or £20.95 with a make-your-own Christmas bear. Adults are £1, and online bookings carry a £1 booking fee. There is also an SEN-friendly Santa evening with music off or very low and no flashing lights. Bookings last two hours and are non-refundable, but can be moved once. ${ext('https://scallywagsindoorplay.com/santas-grotto/', 'Scallywags Santa’s Grotto')}</p>

<h3>Yorkshire and the Humber</h3>
<p>${v('bradford/funopolis', 'Funopolis')}, Shipley, Bradford: Santa in his cabin with a gift for every child, a group photo, Christmas crafts and soft play, on Thursdays, Fridays and Saturdays from 28 November to 19 December, plus Wednesday 23 December. Its Christmas page lists £12.95 per child, or two children for £22, with adults free. A quieter Santa session for children who need a calmer visit runs on Thursday 10 December, 9am to 12pm. ${ext('https://funopolis.co.uk/christmas', 'Christmas at Funopolis')}</p>

<h2>When should I book a soft play Santa visit?</h2>
<p>As soon as you know your dates. Several of the events above run on only a few days (World of Wonder has five dates, Mighty Monsters one), slots are timed, and venues such as World of Wonder and Little Monsters ask you to pre-book. Knockhatch is the exception: its grotto tickets are sold on the day.</p>

<h2>What should I check before booking?</h2>
<ul>
  <li><strong>Refunds.</strong> Most tickets we saw are non-refundable. Some let you move a booking (Scallywags once; Poppelwood up to an hour before).</li>
  <li><strong>What is included.</strong> Check whether play, a gift and adult entry are in the price, and whether you need a separate admission ticket.</li>
  <li><strong>Allergies.</strong> If the gift is food, tell the venue about allergies when you book, as World of Wonder asks.</li>
  <li><strong>Group size.</strong> Small grottos limit numbers: six at Little Monsters, ten at Knockhatch, four per table at Poppelwood.</li>
  <li><strong>Calmer sessions.</strong> If your child finds busy, noisy places hard, look for SEN or quiet sessions such as those at Scallywags and Spaceworld. Our ${link('/blog/sen-friendly-soft-play-uk', 'SEN-friendly soft play guide')} has more tips.</li>
</ul>

<h2>Run a soft play centre with a Santa event?</h2>
<p>If your centre is listed on Soft Play Near Me, you can ${link('/add-venue', 'claim or update your listing')} so parents can find your festive events. For more ideas for little ones, see our ${link('/blog/baby-and-toddler-soft-play-uk', 'baby and toddler soft play guide')}.</p>`,
    faq: [
      {
        q: 'How much does it cost to see Santa at soft play?',
        a: 'On the venue websites we checked on 19 November 2026, per-child prices at the venues that list one ran from £9.50 for Santa and soft play without a gift (Scallywags, weekdays) to £21.95 for Santa, a gift, a hat and two hours of soft play (Little Monsters House of Fun), on our reading of the listed prices. Mighty Monsters’ Santa & the Grinch morning is £30 for one child and one adult. Some venues charge adults a small fee and some need a separate admission ticket.',
      },
      {
        q: 'Is soft play included with a Santa’s grotto ticket?',
        a: 'Often, but not always. Little Monsters, Poppelwood and Scallywags include a soft play session in the ticket, while Knockhatch sells the grotto ticket separately from park entry. Check what the ticket covers before you book.',
      },
      {
        q: 'Is a grotto or breakfast with Santa better for toddlers?',
        a: 'A grotto visit is usually easier for under-3s because the time with Santa is short and they can play before or after. Breakfast with Santa usually lasts longer and includes a meal, which can suit older toddlers and pre-schoolers.',
      },
      {
        q: 'Can I get a refund on a Santa’s grotto ticket?',
        a: 'Usually not. Most of the soft play Santa tickets we checked are non-refundable, although some venues let you move your booking to another date.',
      },
      {
        q: 'Are there quiet or SEN-friendly Santa sessions at soft play?',
        a: 'Some centres run them. Scallywags in Brierley Hill has an SEN-friendly Santa evening with music off or very low and no flashing lights, and Spaceworld in Prescot lists SEN Santa sessions on 23 and 24 December. Funopolis in Shipley has a quiet Santa morning on Thursday 10 December, limited to eight children per session. Ask your local centre if it offers one.',
      },
    ],
  },
]
