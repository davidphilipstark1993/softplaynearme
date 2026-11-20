/**
 * UK guide to the cost of a birthday party at a soft play centre. Hand-written; every price and inclusion was
 * checked on the centre's own party page on 20 November 2026 (sources listed in
 * /workspace/softplay/blog/pending/soft-play-party-cost-uk/sources.md). One centre per UK nation/English region,
 * only venues already listed on the site. Mobile/equipment hire is covered separately in blogPostsHire.ts.
 */
import type { BlogPost } from './blogPosts'

const link = (href: string, label: string) => `<a href="${href}" class="text-purple-700 hover:underline">${label}</a>`
const v = (path: string, label: string) => link(`/soft-play/${path}`, label)
const ext = (href: string, label: string) =>
  `<a href="${href}" class="text-purple-700 hover:underline" target="_blank" rel="noopener nofollow">${label}</a>`

export const partyCostPosts: BlogPost[] = [
  {
    slug: 'soft-play-party-cost-uk',
    title: 'Soft Play Party Cost UK (2026): Per-Child Prices and What’s Included',
    metaTitle: 'Soft Play Party Cost UK 2026: Prices Per Child | Soft Play Near Me',
    metaDescription:
      'How much is a soft play birthday party? Per-child prices, what is included and extras to ask about, from 12 UK centres checked in November 2026.',
    city: 'UK',
    excerpt:
      'We checked the party pages of 12 soft play centres listed on Soft Play Near Me, one in each UK nation and English region, on 20 November 2026. At the nine that list a per-child price for a standard party with food, prices ran from £11 to £20 per child. Most of the parties we looked at last between 90 minutes and two hours, and character or private options usually cost more. Here is what you typically get, whether adults pay, and the extras worth asking about.',
    publishedAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    datePublished: '2026-11-20T00:00:00.000Z',
    dateModified: '2026-11-20T00:00:00.000Z',
    verifiedOn: '20 November 2026',
    contentHtml: `<h2>How much does a soft play party cost per child?</h2>
<p>Most soft play centres price parties per child, with a minimum number of children. These are the prices published on each centre’s own party page when we checked on 20 November 2026, one centre per nation or region (regions in alphabetical order):</p>
<ul>
  <li><strong>East Midlands:</strong> ${v('kettering/tigers-indoor-play', 'Tigers Indoor Play')}, Kettering: £17 per child for two hours, minimum 15 children. ${ext('https://tigersplaykettering.co.uk/birthday-party/', 'Party page')}</li>
  <li><strong>East of England:</strong> ${v('bedford/kids-world', 'Kids World')}, Bedford: Pizza &amp; Play party from £14.50 per child (minimum 8), Mega Party from £19 per child (12 to 26 children). ${ext('https://kidsworldbedford.co.uk/parties/', 'Party page')}</li>
  <li><strong>London:</strong> ${v('london/clowntown', 'Clowntown')}, North London (N12): from £15 per child off-peak and from £20 peak, for two hours; toddler parties from £10 off-peak. ${ext('https://clowntown.co.uk/parties', 'Party page')}</li>
  <li><strong>North East:</strong> ${v('morpeth/castlemania-indoor-adventure-play', 'Castle Mania')}, Amble, Northumberland: themed parties at £12.50 per head, disco and football parties at £13, for 10 to 30 children. ${ext('https://castle-mania.co.uk/birthday-parties', 'Party page')}</li>
  <li><strong>North West:</strong> ${v('carlisle/wee-rascalz-adventure-world', 'Wee Rascalz Adventure World')}, Carlisle: £5.50 per child for a party during opening hours, with food extra or brought by you (party boxes £4.50 per child). ${ext('https://www.weerascalzadventureworld.co.uk/public-parties', 'Party page')}</li>
  <li><strong>Northern Ireland:</strong> ${v('lisburn/happy-days-lisburn', 'Happy Days')}, Lisburn: £11 per child Tuesday to Friday and £12 on Saturdays, minimum 10 children. ${ext('https://happydayslisburn.com/parties', 'Party page')}</li>
  <li><strong>Scotland:</strong> ${v('ayr/kidz-play', 'Kidz Play')}, Prestwick: £14 per child for a two-hour party, for 12 to 25 children. ${ext('https://kidz-play.co.uk/', 'Centre website')}</li>
  <li><strong>South East:</strong> ${v('rochester/monkey-bizz', 'Monkey Bizz')}, Strood, Medway: £20 per head for a standard party or £23 themed, minimum 10 children. ${ext('https://monkeybizzmedway.co.uk/parties/', 'Party page')}</li>
  <li><strong>South West:</strong> ${v('exeter/iplay-exeter', 'iPlay')}, Exeter: £115 per party covering six children aged 1 to 7 and six adults, then £10.95 per extra child, up to 16 children. ${ext('https://iplay-softplay.co.uk/parties.php', 'Party page')}</li>
  <li><strong>Wales:</strong> ${v('llandudno/bonkerz-fun-centre', 'Bonkerz Fun Centre')}, Llandudno: £13.95 per child on weekdays and £15.95 at weekends, minimum 10 children. ${ext('https://bonkerzfuncentre.co.uk/parties/', 'Party page')}</li>
  <li><strong>West Midlands:</strong> ${v('rugby/the-adventure-zone-soft-play', 'The Adventure Zone')}, Rugby: £13.95 per child on selected weekdays and £15.95 on selected weekends, minimum 10 children. ${ext('https://theadventurezone.co.uk/the-adventure-zone/birthday-parties/', 'Party page')}</li>
  <li><strong>Yorkshire and the Humber:</strong> ${v('barnsley/playgroots-adventure-cafe', 'Playgroots Adventure Café')}, Barnsley: from £220 for up to 16 children with two hours of exclusive play, then £12 per extra child (maximum 25). ${ext('https://barnsleyplayarea.co.uk/', 'Centre website')}</li>
</ul>
<p>Of the 12 centres we checked, nine list a per-child price for a standard party that includes food, and those prices ran from £11 (Happy Days, weekdays) to £20 (Monkey Bizz standard party, and Clowntown peak “from” price). We left out the other three because their prices are not like for like: Wee Rascalz’s £5.50 does not include food (with its £4.50 party boxes it comes to £10 per child), iPlay charges per party, and Playgroots’ price is for an exclusive package. Toddler-only parties can cost less, such as Clowntown’s from £10 off-peak. Character packages cost more: Kids World’s Build-A-Bear party is from £26 per child. Prices change, so always confirm with the centre.</p>

<h2>What is usually included in a soft play party?</h2>
<p>Packages vary, but the parties we looked at usually combine play time on the frame, food in a party room or reserved area, and drinks for the children. For example, Tigers includes two hours of party time, a hot buffet, unlimited cordial, a party host team and exclusive use of its party room during your session. Happy Days gives 60 minutes of soft play and 30 minutes in its party room, with a hot meal and ice cream. Bonkerz includes a hot or cold meal, a party host and unlimited sugar-free squash. A birthday cake is usually down to you: Castle Mania and Bonkerz both say the cake is not included.</p>

<h2>How many children can you invite?</h2>
<p>Most of the centres that state a minimum ask for at least 10 children. Some charge for the minimum even if fewer come: Tigers charges for 15, and Wee Rascalz charges for 20. For standard parties, maximums ranged from 16 children (iPlay) to 35 (Wee Rascalz) on the pages we checked. For bigger groups, look at private hire.</p>

<h2>Do adults pay at a soft play party?</h2>
<p>It depends on the centre, so check before you send invitations. Tigers includes one free adult ticket with each child guest. Monkey Bizz allows one free adult per child, with extra adults at £3.50 each. iPlay’s price covers six adults, then £2 per extra adult. Kids World includes free adult entry with its Pizza &amp; Play party and four free adult entries with its Mega Party, with an adult pass at £12.</p>

<h2>Private hire or a shared party: which costs more?</h2>
<p>A shared party uses the play frame during normal opening hours, with a private room or table for food. Private (exclusive) hire gives your group the whole centre, often in the early evening or at quieter times, and is not always more expensive per child. Kidz Play lists private parties at £12 per child on Monday to Thursday evenings (minimum 20), compared with £14 for its standard party. Happy Days lists private hire at £14 per child (minimum 15). The Adventure Zone lists private hire at £395 for 16 children, and Castle Mania offers a no-frills private hire at £330 for at least 35 children, bringing your own food.</p>
<p>If you are thinking of hiring soft play equipment for your home or a hall instead, see our ${link('/blog/soft-play-hire-for-parties-uk', 'guide to soft play hire for parties')}.</p>

<h2>What hidden extras should you ask about?</h2>
<ul>
  <li><strong>Deposits and booking fees.</strong> Castle Mania takes a £20 non-refundable booking fee, Kidz Play a £20 deposit, Wee Rascalz a £30 non-refundable deposit, and Happy Days a £50 deposit, as does Monkey Bizz for standard parties. Clowntown adds a £4 booking transaction fee for non-members.</li>
  <li><strong>Food rules.</strong> Kids World charges £30 if you bring your own food to an exclusive hire. Kidz Play does not allow outside food and drink.</li>
  <li><strong>Party bags and add-ons.</strong> Kids World’s upgrade (party bag, balloon, slush and vouchers) is £4 extra per child. Playgroots lists party bags at £1.50 each and a mascot visit at £30, and Monkey Bizz lists mascots at £35.</li>
  <li><strong>Changing your date.</strong> Tigers says its pre-payment is non-refundable, but you may be able to rearrange for a £50 admin fee at the management’s discretion.</li>
</ul>

<h2>How far ahead should you book?</h2>
<p>Book once you know your date: at least six of the 12 centres we checked ask for a deposit or booking fee to secure a party, and Kids World advises booking its exclusive hire early. Also note the deadlines before the party: Wee Rascalz needs final numbers and the balance seven days before, and Tigers asks for the balance on the Thursday before your party.</p>

<h2>Find a party venue near you</h2>
<p>Open your ${link('/soft-play', 'town or city page')} to find soft play centres near you, then check each centre’s party page for current prices. Our guides to ${link('/blog/baby-and-toddler-soft-play-uk', 'baby and toddler soft play')} and ${link('/blog/sen-friendly-soft-play-uk', 'SEN-friendly soft play')} may help you choose the right kind of venue.</p>`,
    faq: [
      {
        q: 'How much does a soft play birthday party cost per child in the UK?',
        a: 'Of the 12 UK centres we checked on 20 November 2026, nine list a per-child price for a standard party with food, ranging from £11 to £20 per child. Toddler-only parties, and parties where food is extra, can cost less. Character packages cost more, for example from £26 per child for a Build-A-Bear party at Kids World in Bedford.',
      },
      {
        q: 'What is included in a soft play party?',
        a: 'Usually play time on the soft play frame, food in a party room or reserved area, and drinks for the children, often for 90 minutes to two hours. Many centres add a party host. The birthday cake is often not included.',
      },
      {
        q: 'Is there a minimum number of children for a soft play party?',
        a: 'Usually. Most of the centres we checked that state a minimum ask for at least 10 children, and some charge for the minimum even if fewer children come.',
      },
      {
        q: 'Do adults have to pay at a soft play party?',
        a: 'It varies. Some centres include one free adult per child guest, some include a set number of adults, and others charge for extra adults, for example £3.50 each at Monkey Bizz or £2 each at iPlay in Exeter.',
      },
      {
        q: 'Is private hire of a soft play centre more expensive than a normal party?',
        a: 'Not always. Kidz Play in Prestwick lists private evening parties at £12 per child (minimum 20) against £14 for its standard party, while other centres charge a fixed fee, such as £395 for 16 children at The Adventure Zone in Rugby.',
      },
    ],
  },
]
