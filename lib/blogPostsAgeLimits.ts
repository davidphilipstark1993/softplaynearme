/**
 * UK guide to soft play age limits, height limits, baby/toddler zones and adult rules. Hand-written; every age,
 * height and session detail was checked on the centre's own website on 28 November 2026 (sources listed in
 * /workspace/softplay/blog/pending/soft-play-age-limits-uk/sources.md). One centre per UK nation/English region,
 * only venues already listed on the site whose postcode belongs to their hub, and none of the towns used in
 * blogPostsPrices.ts.
 */
import type { BlogPost } from './blogPosts'

const link = (href: string, label: string) => `<a href="${href}" class="text-purple-700 hover:underline">${label}</a>`
const v = (path: string, label: string) => link(`/soft-play/${path}`, label)
const ext = (href: string, label: string) =>
  `<a href="${href}" class="text-purple-700 hover:underline" target="_blank" rel="noopener nofollow">${label}</a>`

export const ageLimitsPosts: BlogPost[] = [
  {
    slug: 'soft-play-age-limits-uk',
    title: 'What Age Is Soft Play For? Age and Height Limits at UK Centres (2026)',
    metaTitle: 'Soft Play Age & Height Limits UK (2026) | Soft Play Near Me',
    metaDescription:
      'What age is soft play for? Upper age and height limits, baby and toddler zones, toddler sessions and adult rules at 12 UK centres, checked Nov 2026.',
    city: 'UK',
    excerpt:
      'Most soft play centres are built for children from babies up to about 10 to 12, but every centre sets its own limits, and some also use a height limit. We checked the age and height rules of 12 centres listed on Soft Play Near Me, one in each UK nation and English region, on 28 November 2026. Here is who can play where, what older children and adults can do, and when toddlers get the place to themselves.',
    publishedAt: '2026-11-28T00:00:00.000Z',
    updatedAt: '2026-11-28T00:00:00.000Z',
    datePublished: '2026-11-28T00:00:00.000Z',
    dateModified: '2026-11-28T00:00:00.000Z',
    verifiedOn: '28 November 2026',
    contentHtml: `<h2>What age is soft play for?</h2>
<p>Usually from babies up to around 10 to 12, but it depends on the centre. These are the age ranges each centre gives on its own website (Peak Adventure only lists ticket bands), checked on 28 November 2026 (regions in alphabetical order):</p>
<ul>
  <li><strong>East Midlands:</strong> ${v('matlock/peak-adventure-indoor-soft-play-centre', 'Peak Adventure')}, Rowsley, near Matlock: tickets for babies up to 11 months, ages 1 to 3 and ages 4 to 11. ${ext('https://peak-adventure.co.uk/soft-play/', 'Source')}</li>
  <li><strong>East of England:</strong> ${v('southend/kids-kingdom-southend', 'Kids Kingdom')}, Southend: children aged 0 to 12 and under 5ft 2in may use the frame. ${ext('https://www.kidskingdom-southend.co.uk/faqs/', 'Source')}</li>
  <li><strong>London:</strong> ${v('london/clowntown', 'Clowntown')}, Finchley: ages 0 to 11, with a height limit of 4ft 9in on the main frame. ${ext('https://clowntown.co.uk/faq', 'Source')}</li>
  <li><strong>North East:</strong> ${v('stanley/krazy-kingdom', 'Krazy Kingdom')}, Stanley: only children under 12 may play on the play frame. ${ext('https://krazykingdom.com/rules-of-play/', 'Source')}</li>
  <li><strong>North West:</strong> ${v('chester/zippys-playworld-chester', 'Zippy’s Playworld')}, Chester: ages 0 to 10, with a 4ft 9in height limit. ${ext('https://www.zippysplayworld.co.uk/faqs/', 'Source')}</li>
  <li><strong>Northern Ireland:</strong> ${v('omagh/duff-land-ni-ltd', 'Duff Land')}, near Omagh: soft play for children up to 11. ${ext('https://www.dufflandni.co.uk/', 'Source')}</li>
  <li><strong>Scotland:</strong> ${v('edinburgh/wonder-world-soft-play-and-kids-group-party-venue-edinburgh-leith-edinburgh', 'WonderWorld')}, Leith, Edinburgh: ages 0 to 12. ${ext('https://www.wonderworldsoftplay.co.uk/edinburgh/frequently-asked-questions/', 'Source')}</li>
  <li><strong>South East:</strong> ${v('horley/lets-explore-soft-play', 'Lets Explore')}, Horley: babies up to age 10. ${ext('https://lets-explore.com/soft-play-centre', 'Source')}</li>
  <li><strong>South West:</strong> ${v('taunton/space-adventurers-soft-play', 'Space Adventurers')}, Taunton: children up to 12. ${ext('https://spaceadventurers.co.uk/', 'Source')}</li>
  <li><strong>Wales:</strong> ${v('swansea/playzone', 'Playzone')}, Swansea: ages 0 to 14. ${ext('https://www.theplayzone.co.uk/home-swansea/', 'Source')}</li>
  <li><strong>West Midlands:</strong> ${v('rugby/the-adventure-zone-soft-play', 'The Adventure Zone')}, Rugby: ages 0 to 12. ${ext('https://theadventurezone.co.uk/the-adventure-zone/admission-prices/', 'Source')}</li>
  <li><strong>Yorkshire and the Humber:</strong> ${v('huddersfield/playworld', 'PlayWorld')}, Huddersfield: 6 months to 10 years. ${ext('https://playworldhuddersfield.co.uk/', 'Source')}</li>
</ul>
<p>Our summary: seven of the 12 state a top age of 11 or 12, three state 10, and Playzone in Swansea goes up to 14. Peak Adventure does not state a top age, but its oldest ticket band is 4 to 11. This is a snapshot of 12 centres, not a national rule, so check your own centre before you go.</p>

<h2>Is there a height limit at soft play?</h2>
<p>At some centres, yes, and it can rule out a tall child who is still within the age range. Clowntown’s rules set a maximum of 4ft 9in on the main frame (the same page also gives this as 149cm, which is a little taller than 4ft 9in, so check with the centre if your child is close to the limit), and no child taller than 3ft 7in (109cm) may play in the toddler area. Its reception staff check heights against a measuring sign. Zippy’s Playworld also has a 4ft 9in limit and points out that some 10-year-olds may be taller than that. Kids Kingdom’s limit is under 5ft 2in. The reason Clowntown gives is simple: keeping bigger children apart from smaller ones means fewer collisions.</p>
<p>If your child is tall for their age, check the height limit before you go, not just the age range.</p>

<h2>Can older children and 12-year-olds go to soft play?</h2>
<p>Sometimes, but at some centres only as helpers. At Krazy Kingdom, only children under 12 may play on the frame, and anyone older may accompany younger children. Its rules do not say what applies to a child who is exactly 12, so ask the centre. Clowntown says older siblings are welcome too. Zippy’s Playworld welcomes older children to help supervise younger brothers and sisters, but an adult over 18 must be there, and children over its height limit are charged the adult rate if the ratio of adults to children goes above 2:1.</p>
<p>For older children, look for centres with a higher age limit or a separate area. Playzone in Swansea welcomes children up to 14. Duff Land has The Junk Yard, a separate adventure centre for children aged 6 and over, aimed at parties, group bookings, sports teams and school groups and not included in standard Duff Land admission.</p>

<h2>Where do babies and toddlers play?</h2>
<p>Seven of the 12 centres we checked have a separate baby or toddler area, and some keep older children out of it. Six are listed below; PlayWorld in Huddersfield also has baby and toddler areas:</p>
<ul>
  <li><strong>Peak Adventure:</strong> children over 3 are not allowed in the baby area.</li>
  <li><strong>Clowntown:</strong> a toddler section for ages 0 to 4, with a baby area too. The main frame is for children over 4, and younger children should not go on it unaccompanied.</li>
  <li><strong>Space Adventurers:</strong> three separate areas for ages 0 to 2, 2 to 4 and 5 to 12.</li>
  <li><strong>Lets Explore:</strong> a baby zone, a toddler corner, and three levels of play for children aged 3 and over.</li>
  <li><strong>Playzone:</strong> a toddler area for under-4s, and everyone over 5, parents included, is encouraged to try the main play area.</li>
  <li><strong>The Adventure Zone:</strong> a separate “little adventurers” area for ages 0 to 4, alongside a main frame for ages 1 to 12.</li>
</ul>
<p>Our ${link('/blog/baby-and-toddler-soft-play-uk', 'baby and toddler soft play guide')} has more on what makes a good under-fives area, and ${link('/blog/play-cafes-uk-guide', 'play cafés')} are another gentle option for the very youngest.</p>

<h2>Are there toddler-only sessions?</h2>
<p>Two of the centres we checked list toddler sessions, both on weekdays in term time. At Krazy Kingdom, Toddler Time runs Monday to Friday in term time, between 9:30am and 2:30pm, with no need to book and no time limit. PlayWorld in Huddersfield runs Toddler &amp; Tots in term time on Thursdays and Fridays from 9:30am to 3pm, listed at £5.00 when we checked. Kids Kingdom says that at busy times, such as weekends and school holidays, under-5s and adults cannot use its Jelly Mountain, but it tries to hold under-5 sessions then (it cannot guarantee them).</p>
<p>Session times change, so check the centre’s website or social media on the day.</p>

<h2>Do slides and attractions have their own age limits?</h2>
<p>Yes, some do. WonderWorld’s Volcano Slide is for children aged 5 or over, and adults are not allowed on it. Kids Kingdom’s drop slide is also for children aged five and over, and staff can refuse anyone they think is younger. Look out for signs on the frame itself.</p>

<h2>Can adults go on soft play?</h2>
<p>At some centres, yes. WonderWorld says its play frame is designed for adults and children, as long as you take your shoes off and wear socks. Playzone tells parents they can go in too, and runs over-18s-only adult nights on the first and third Friday of each month. Clowntown says most of its play areas are designed for adults to join in. Others are stricter: Krazy Kingdom only lets children under 12 play on the frame. If you are not sure, ask at reception.</p>

<h2>Who has to supervise, and how many children can one adult bring?</h2>
<p>Every centre we checked that publishes supervision rules says a parent or guardian must supervise their children at all times, and staff do not take that responsibility over: Duff Land, for example, says its staff do not provide supervision. Clowntown says one adult aged 18 or over must stay in the centre throughout the visit, and Zippy’s Playworld says an adult is a parent or guardian over 18, so an older sibling cannot be in charge on their own there. Krazy Kingdom requires all children aged 12 and under to be accompanied by a responsible adult carer who stays in the building. Zippy’s Playworld recommends one adult for every four children.</p>
<p>If your child has additional needs, many centres run quieter sessions: see our ${link('/blog/sen-friendly-soft-play-uk', 'SEN-friendly soft play guide')}.</p>

<h2>Find soft play near you</h2>
<p>Browse the centres in ${v('matlock', 'Matlock')}, ${v('southend', 'Southend')}, ${v('london', 'London')}, ${v('stanley', 'Stanley')}, ${v('chester', 'Chester')}, ${v('omagh', 'Omagh')}, ${v('edinburgh', 'Edinburgh')}, ${v('horley', 'Horley')}, ${v('taunton', 'Taunton')}, ${v('swansea', 'Swansea')}, ${v('rugby', 'Rugby')} and ${v('huddersfield', 'Huddersfield')}, or open your ${link('/soft-play', 'town or city page')}. Then check the centre’s own age and height rules before you set off. Planning a birthday? See our ${link('/blog/soft-play-party-cost-uk', 'soft play party cost guide')}.</p>`,
    faq: [
      {
        q: 'What age is soft play for?',
        a: 'Of the 12 centres we checked, most are for children from babies up to about 10 to 12. On 28 November 2026, seven stated a top age of 11 or 12, three stated 10 and one (Playzone in Swansea) stated 14; Peak Adventure states none, but its oldest ticket band is 4 to 11.',
      },
      {
        q: 'Is there a height limit for soft play?',
        a: 'At some centres. Clowntown in London and Zippy’s Playworld in Chester both have a 4ft 9in limit on the main play area, and Kids Kingdom in Southend allows children under 5ft 2in. Clowntown also limits its toddler area to children no taller than 3ft 7in (109cm).',
      },
      {
        q: 'Can a 12-year-old go to soft play?',
        a: 'It depends on the centre. Some, such as WonderWorld in Edinburgh and The Adventure Zone in Rugby, include 12-year-olds. At Krazy Kingdom in Stanley, only under-12s may play on the frame and anyone older may accompany younger children; its rules do not say what applies to 12-year-olds, so ask the centre. Playzone in Swansea goes up to 14.',
      },
      {
        q: 'Are babies and toddlers allowed in the main soft play area?',
        a: 'Most of the centres we checked have a separate baby or toddler area, and some keep older children out of it. Some also limit the main frame: Clowntown’s is for children over 4, and younger children should not go on it unaccompanied. Check the centre’s rules before you go.',
      },
      {
        q: 'Can adults go on the soft play equipment?',
        a: 'At some centres, yes. WonderWorld in Edinburgh says its frame is designed for adults and children, and Playzone in Swansea welcomes parents in and runs over-18s adult nights. Expect to need socks: WonderWorld and Lets Explore both say adults must wear them.',
      },
    ],
  },
]
