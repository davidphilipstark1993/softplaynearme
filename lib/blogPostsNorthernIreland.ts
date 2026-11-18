/**
 * Northern Ireland soft play roundup. Hand-written; venue facts were checked against each venue's own
 * website on 16 November 2026 (sources listed in /workspace/softplay/blog/pending/soft-play-northern-ireland/sources.md).
 * Only centres already listed on Soft Play Near Me with NI (BT) postcodes are included.
 */
import type { BlogPost } from './blogPosts'

const link = (href: string, label: string) => `<a href="${href}" class="text-purple-700 hover:underline">${label}</a>`
const v = (path: string, label: string) => link(`/soft-play/${path}`, label)

export const northernIrelandPosts: BlogPost[] = [
  {
    slug: 'soft-play-northern-ireland',
    title: 'Soft Play in Northern Ireland: Prices, Rules and Centres to Try (2026)',
    metaTitle: 'Soft Play in Northern Ireland: 2026 Guide | Soft Play Near Me',
    metaDescription:
      'Soft play in Northern Ireland, from Belfast and Lisburn to Derry, Portrush and Tyrone: prices, age limits, sock rules and session lengths, checked Nov 2026.',
    city: 'Northern Ireland',
    excerpt:
      'Northern Ireland has soft play centres from Belfast and Lisburn to Derry~Londonderry, Portrush and County Tyrone. In the centres we checked, a standard child ticket cost about £6 to £9.50, sessions often lasted around 90 minutes, and every one that publishes rules asks children to wear socks. Here is what to expect and where to start.',
    publishedAt: '2026-11-16T00:00:00.000Z',
    updatedAt: '2026-11-16T00:00:00.000Z',
    datePublished: '2026-11-16T00:00:00.000Z',
    dateModified: '2026-11-16T00:00:00.000Z',
    verifiedOn: '16 November 2026',
    contentHtml: `<p>This guide covers the Northern Ireland soft play centres listed on Soft Play Near Me, with details taken from each centre’s own website on 16 November 2026. It is not a ranking. Prices and opening times change, especially around school holidays and Christmas, so check with the centre before you set off.</p>

<h2>Where can I find soft play in Belfast?</h2>
<p>${v('belfast/roar-and-explore-dairy-farm-belfast', 'Roar and Explore')} at Dairy Farm Shopping Centre in west Belfast has a large play frame, a separate multi-level toddler area and Roary’s Café, where adults can sit and watch. Its website says it is open 9:30am to 6pm every day, with admission for 90 minutes and last admission strictly at 4:30pm, and that it is a social enterprise that reinvests its profits in the local community. Roar and Explore also runs a second play area at the Kennedy Centre, which has its own prices.</p>
<p>Just north of the city, our directory also lists ${v('belfast/airtastic-entertainment-centre', 'Airtastic Entertainment Centre')} and ${v('belfast/happy-littles-play-cafe', 'Happy Littles Play Cafe')}, both with Newtownabbey (BT36) postcodes. We have not yet checked their details against their own websites, so contact them directly for prices and times.</p>

<h2>Where is soft play in Lisburn and County Down?</h2>
<p>${v('lisburn/happy-days-lisburn', 'Happy Days')} on Moira Road, Lisburn, is a not-for-profit soft play and café based inside The Journey Church. It has a large frame plus a toddler zone, and its website says the play area suits children up to 10 years old or 5ft. It opens Tuesday to Saturday, 9:30am to 4pm, play sessions last 90 minutes, and there is no need to pre-book. You can also take your café order into the play area while you watch.</p>
<p>In Ballynahinch, ${v('ballynahinch/global-adventure-play-ltd', 'Global Adventure Play')} has a multi-level themed frame with zones such as Ancient Egypt, Vikings, dinosaurs and space, which it says are designed around the “World Around Us” topic in the Northern Ireland Key Stage 1 and 2 curriculum. There is a toddler zone and a baby zone for pre-walkers, and the centre describes itself as a nut-free zone. It recommends booking but welcomes walk-ins.</p>

<h2>Is there soft play in Derry~Londonderry?</h2>
<p>Yes. ${v('derry-londonderry/the-play-shed-uk-ltd', 'The Play Shed')} in the Waterside opened in April 2014 and has two play frames, one for babies and toddlers and one for juniors, with room for up to 112 children at a time. Its coffee shop serves food made to order. The website lists opening hours of 10am to 5pm on Monday, 10am to 6pm Tuesday to Saturday and 1pm to 5pm on Sunday, and says hours can change, so check its Facebook page first.</p>
<p>${v('derry-londonderry/bonkers-soft-play-derry', 'Bonkers Soft Play')} is also listed in Derry. Its website did not load when we checked, so please contact the centre directly.</p>

<h2>What about soft play on the North Coast and in Tyrone and Antrim?</h2>
<ul>
  <li><strong>Portrush:</strong> ${v('portrush/goldrush-portrush', 'Goldrush Portrush')} is home to Wacky Workshop, a three-level soft play area for children aged 9 and under, with a separate baby and toddler area for 0 to 3-year-olds. Its autumn opening times are Wednesday to Friday 11am to 6pm and weekends 10am to 6pm, closed Monday and Tuesday, though hours can vary with private parties. The building also has an amusement arcade, a café and a separate over-18s casino.</li>
  <li><strong>Near Omagh:</strong> ${v('omagh/duff-land-ni-ltd', 'Duff Land')}, just outside Beragh in County Tyrone, sells 90-minute Play Passes for children up to 11, and babies who stay in their pram go in free. Its Junk Yard, with Nerf and laser tag for children aged 6 and over, is a separate attraction and not included in standard admission. Its website lists opening hours of Saturday and Sunday, 11am to 5pm, with school holiday times posted on its Facebook page.</li>
  <li><strong>Randalstown:</strong> ${v('randalstown/little-izzies-play-cafe', 'Little Izzies Play Cafe')} is a family-run play café whose website lists Monday to Friday opening from 9am to 4:30pm, plus Sunday sessions.</li>
</ul>

<h2>How much does soft play cost in Northern Ireland?</h2>
<p>These are the prices on the centres’ own websites when we checked on 16 November 2026:</p>
<ul>
  <li><strong>Happy Days, Lisburn:</strong> under-1s free, ages 1 to 3 £6, ages 4 and over £7.</li>
  <li><strong>Roar and Explore, Dairy Farm:</strong> standard entry £7.95 per child; babies under 12 months and non-walkers £2; toddler mornings (9:30am to 12pm, Monday to Friday) £5.95, including free juice and toast until 11:30am.</li>
  <li><strong>Global Adventure Play, Ballynahinch:</strong> at weekends, under-1s free, ages 1 to 3 with one adult £8.50, ages 4 to 11 with one adult £9.50, each extra adult £2.50. Term-time toddler mornings on Monday, Thursday and Friday cost £5.50 with free juice and toast.</li>
  <li><strong>Little Izzies, Randalstown:</strong> child admission £7.95, pre-walkers £5, non-crawlers free.</li>
</ul>
<p>At the centres that run them, toddler mornings are usually the cheapest way in. Check whether an adult is included, whether babies pay, and whether sessions are timed.</p>

<h2>Do you need socks for soft play?</h2>
<p>Yes, at every centre we checked that publishes rules. Wacky Workshop in Portrush is blunt about it: “Socks must be worn at all times! NO SOCKS, NO ADMISSION!” Roar and Explore and Global Adventure Play also ask for shoes off and socks on. A few other rules worth knowing before you go:</p>
<ul>
  <li><strong>Clothing:</strong> Roar and Explore does not allow clothing with hoods or toggles in the play area, and Global Adventure Play asks for arms and legs to be covered.</li>
  <li><strong>Glasses and pockets:</strong> Wacky Workshop asks for jewellery, phones and coins to be removed, and for glasses to be taken off unless they have a retainer or shatterproof lenses.</li>
  <li><strong>Supervision:</strong> all three centres with published rules (Wacky Workshop, Roar and Explore and Global Adventure Play) say children must be supervised by an adult at all times; staff do not look after them.</li>
  <li><strong>Food:</strong> no food or drink on the play frames, and Roar and Explore and Global Adventure Play only allow food and drink bought on site.</li>
</ul>

<h2>What age is soft play for?</h2>
<p>Upper age limits vary from centre to centre: 9 at Wacky Workshop (with a height limit of 4ft 9in, or 1.45m), 10 at Roar and Explore and Happy Days, and 11 at Global Adventure Play and Duff Land. Most also have a separate area for babies and toddlers, such as Roar and Explore’s toddler area for under-3s.</p>

<h2>Find more soft play near you</h2>
<p>Browse every town on our ${link('/soft-play', 'soft play directory')}. If you are planning a birthday, our ${link('/blog/soft-play-hire-for-parties-uk', 'guide to soft play hire for parties')} covers what to ask, and our ${link('/blog/play-cafes-uk-guide', 'play café guide')} explains how smaller play cafés work. If you run a centre in Northern Ireland that we have missed, or a detail here has changed, please get in touch and we will update it.</p>`,
    faq: [
      {
        q: 'How much is soft play in Northern Ireland?',
        a: 'In the centres we checked in November 2026, a standard child ticket ranged from £6 (ages 1 to 3 at Happy Days, Lisburn) to £9.50 (ages 4 to 11 with one adult at Global Adventure Play, Ballynahinch, at weekends). Toddler mornings were cheaper, at £5.50 to £5.95, and babies were often free or £2.',
      },
      {
        q: 'Do children need socks at soft play?',
        a: 'Yes. Every Northern Ireland centre we checked that publishes rules asks children to remove shoes and wear socks at all times. Wacky Workshop in Portrush says “no socks, no admission”, so pack a spare pair.',
      },
      {
        q: 'Do I need to book soft play in Northern Ireland?',
        a: 'It depends on the centre. Happy Days in Lisburn says there is no need to pre-book. Global Adventure Play in Ballynahinch recommends booking online but welcomes walk-ins. Hours can change around private parties, so check before you go.',
      },
      {
        q: 'How long is a soft play session?',
        a: 'Happy Days in Lisburn, Duff Land near Omagh and Roar and Explore in Belfast all sell 90-minute sessions, and Wacky Workshop in Portrush limits play to 90 minutes at peak times. Global Adventure Play in Ballynahinch runs two-hour weekend sessions.',
      },
      {
        q: 'What is the age limit for soft play?',
        a: 'It varies. Wacky Workshop in Portrush is for children aged 9 and under; Roar and Explore and Happy Days go up to 10; Global Adventure Play and Duff Land go up to 11.',
      },
    ],
  },
]
