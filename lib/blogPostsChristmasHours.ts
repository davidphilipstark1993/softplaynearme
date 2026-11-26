/**
 * Seasonal guide: soft play opening over Christmas Eve, Christmas Day, Boxing Day, New Year's Eve and New Year's Day
 * 2026/27. Hand-written 22 November 2026. Every opening time below was read on the venue's own website on
 * 22 November 2026 (bank holiday dates from GOV.UK); sources in
 * /workspace/softplay/blog/pending/soft-play-christmas-opening-times-uk/sources.md.
 * One venue per region/nation, regions in alphabetical order; only venues already listed on the site.
 * Drop in as lib/blogPostsChristmasHours.ts and add `...christmasHoursPosts` to the posts list in lib/blogPosts.ts.
 */
import type { BlogPost } from './blogPosts'

const link = (href: string, label: string) => `<a href="${href}" class="text-purple-700 hover:underline">${label}</a>`
const v = (path: string, label: string) => link(`/soft-play/${path}`, label)
const ext = (href: string, label: string) =>
  `<a href="${href}" class="text-purple-700 hover:underline" target="_blank" rel="noopener nofollow">${label}</a>`

export const christmasHoursPosts: BlogPost[] = [
  {
    slug: 'soft-play-christmas-opening-times-uk',
    title: 'Is Soft Play Open on Christmas Eve, Boxing Day and New Year’s Day? (2026)',
    metaTitle: 'Soft Play Christmas Opening Times 2026 | Soft Play Near Me',
    metaDescription:
      'Is soft play open on Christmas Eve, Boxing Day or New Year’s Day? Festive 2026 opening times from one listed centre in each UK region, checked 22 Nov.',
    city: 'UK',
    excerpt:
      'Most soft play centres close on Christmas Day, and many also close on Boxing Day and New Year’s Day, but it varies a lot. Of the 12 listed centres we checked on 22 November 2026, all 10 whose websites cover Christmas Day say they are closed that day, several open on Christmas Eve and New Year’s Eve with shorter hours, and a few open on New Year’s Day. Always check your centre’s own website or ring ahead before you travel.',
    publishedAt: '2026-11-26T00:00:00.000Z',
    updatedAt: '2026-11-26T00:00:00.000Z',
    datePublished: '2026-11-26T00:00:00.000Z',
    dateModified: '2026-11-26T00:00:00.000Z',
    verifiedOn: '22 November 2026',
    contentHtml: `<h2>Is soft play open over Christmas?</h2>
<p>Usually yes, apart from a few key days. The days that catch families out are Christmas Eve (Thursday 24 December 2026), Christmas Day (Friday 25), Boxing Day (Saturday 26), New Year’s Eve (Thursday 31) and New Year’s Day (Friday 1 January 2027). Because Boxing Day falls on a Saturday this year, the Boxing Day bank holiday moves to Monday 28 December across the UK, and Scotland also has a 2nd January holiday on Monday 4 January 2027, according to ${ext('https://www.gov.uk/bank-holidays', 'GOV.UK’s bank holiday list')}. Some centres change their hours on bank holidays too, so it is worth checking those days as well.</p>
<p>Here is what we found when we checked the websites of centres listed on Soft Play Near Me on 22 November 2026: all 10 of the 12 centres whose websites cover Christmas Day and Boxing Day say they are closed on both days (Washbrooks by saying it closes on Christmas Eve and reopens on 2 January); Christmas Eve and New Year’s Eve often mean shorter hours; and New Year’s Day is split, with some open and some closed.</p>

<h2>Which soft play centres are open on Christmas Eve, Boxing Day and New Year’s Day?</h2>
<p>These are one listed centre per region or nation, in alphabetical order, using what each centre’s own website said on 22 November 2026. Hours can change, so check before you set off.</p>

<h3>East Midlands</h3>
<p>${v('lincoln/playzone-lincoln', 'Playzone')}, Lincoln: closed on Christmas Eve, Christmas Day, Boxing Day and New Year’s Day. It closes at 5pm on bank holidays, and at peak times (weekends, school holidays and bank holidays) each session lasts two hours. ${ext('https://www.playiscool.co.uk/site/index.php/times-and-prices.html', 'Playzone times and prices')}</p>

<h3>East of England</h3>
<p>${v('southend/funtopia-indoor-amusement-park', 'Funtopia Indoor Amusement Park')}, Southend-on-Sea: open daily from 11am, 363 days a year, and closed on Christmas Day and Boxing Day. Closing times vary, so check on the day. ${ext('https://www.funtopiaindooramusementpark.co.uk/opening-times/', 'Funtopia opening times')}</p>

<h3>London</h3>
<p>${v('london/kidspace-romford', 'Kidspace Romford')}: its December calendar shows 9am to 7.30pm from 21 to 23 December, 9am to 5.30pm on Christmas Eve, closed on Christmas Day and Boxing Day, 9am to 7.30pm from 27 to 30 December, and 9am to 5.30pm on New Year’s Eve. Last admission is an hour before closing. ${ext('https://kidspaceadventures.com/romford/plan-your-visit/opening-times/?month=2026-12-01&attractionId=9022', 'Kidspace Romford opening times')}</p>

<h3>North East</h3>
<p>${v('stocksfield/brocksbushes-play-barn', 'Brocksbushes Play Barn')}, near Stocksfield, Northumberland: no festive opening hours were posted when we checked, but it has four Christmas sessions before the big day. There is a Christmas disco on Sunday 20 and Tuesday 22 December (£12.50 per child), and a Little Elf Workshop on Monday 21 and Wednesday 23 December. It recommends booking early. ${ext('https://www.brocksbushes.co.uk/blogs/news/christmas-fun-is-coming-to-the-play-barn', 'Christmas at the Play Barn')}</p>

<h3>North West</h3>
<p>${v('bolton/red-robin-wacky-warehouse-bolton-preston', 'Red Robin Wacky Warehouse')}, Wigan: its Christmas 2026 page describes a Christmas Eve Pyjama Party (an evening of stories, crafts, music and play) and a New Year’s Eve Disco for kids, but gives no dates, times or prices, and the venue’s own Christmas events page lists only Breakfast with Santa. The same descriptions appear on other Wacky Warehouse pages, so ring the venue to check whether these events are running this year. The page doesn’t give Christmas Day or Boxing Day hours for the play area either. ${ext('https://www.wackywarehouse.co.uk/play-area/lancashire/red-robin/christmas', 'Christmas at Red Robin')}</p>

<h3>Northern Ireland</h3>
<p>${v('belfast/airtastic-entertainment-centre', 'Airtastic Belfast (Newtownabbey)')}: Airtastic says its centres are open all year round except Christmas Day, Boxing Day (St Stephen’s Day) and Easter Sunday, but asks families to check with their local centre, as other closures may apply. ${ext('https://air-tastic.com/faqs', 'Airtastic FAQs')}</p>

<h3>Scotland</h3>
<p>${v('ayr/kidz-play', 'Kidz Play')}, Prestwick: open 9.30am to 6pm every day except Christmas Day, Boxing Day and New Year’s Day. It doesn’t take bookings for general play. Entry is walk-in only, on a first come, first served basis, with two-hour sessions at busy times. ${ext('https://kidz-play.co.uk/', 'Kidz Play')}</p>

<h3>South East</h3>
<p>${v('brighton/washbrooks-family-farm-brighton', 'Washbrooks Family Farm')}, Hurstpierpoint, West Sussex: on Christmas Eve the farm closes at 3pm (the tearoom at 2pm), and it reopens at 9.30am on 2 January, so it is closed for the days in between. ${ext('https://washbrooks.co.uk/opening-hours/', 'Washbrooks opening hours')}</p>

<h3>South West</h3>
<p>${v('helston/ferdis-indoor-play', 'Ferdi’s Indoor Play')}, Helston, Cornwall: 10am to 4.30pm on 19 and 20 December, 10am to 4pm from 21 to 23 December, closed on Christmas Eve, Christmas Day and Boxing Day, 10am to 4.30pm on Sunday 27 December, 10am to 4pm from 28 to 30 December, closed on New Year’s Day, then 10am to 4.30pm on 2 and 3 January. The list doesn’t mention New Year’s Eve, so ring to check. Last admission is an hour before closing. ${ext('https://www.ferdisindoorplay.co.uk/', 'Ferdi’s Indoor Play')}</p>

<h3>Wales</h3>
<p>${v('aberaeron/the-moody-calf-play-barn', 'The Moody Calf Play Barn')}, Moody Meadows, near Aberaeron: 9.30am to 3.45pm on Christmas Eve, closed on Christmas Day and Boxing Day, 9.30am to 3.45pm on New Year’s Eve, and 11.45am to 6pm on New Year’s Day. Moody Meadows says it is open as usual on days it doesn’t list. ${ext('https://www.moodymeadows.co.uk/christmas/', 'Christmas at Moody Meadows')}</p>

<h3>West Midlands</h3>
<p>${v('coventry/jam-jam-boomerang-coventry', 'Jam Jam Boomerang')}, Coventry: open every day from 9.30am to 6pm, but it closes at 5pm on Christmas Eve and is closed on Christmas Day, Boxing Day and New Year’s Day. Visits have a two-hour maximum stay. ${ext('https://www.jamjamboomerang.co.uk/', 'Jam Jam Boomerang')}</p>

<h3>Yorkshire and the Humber</h3>
<p>${v('york/oxygen', 'Oxygen York')}: festive hours are 9am to 4pm on Christmas Eve, closed on Christmas Day and Boxing Day, 9am to 7pm from 27 to 30 December, 9am to 4pm and 5pm to 7pm on New Year’s Eve, and 10am to 7pm on New Year’s Day. ${ext('https://oxygenactiveplay.co.uk/activity-parks/york/', 'Oxygen York')}</p>

<h2>Is soft play busier between Christmas and New Year?</h2>
<p>Some of the centres we checked treat school holidays as peak time. Playzone in Lincoln counts school holidays and bank holidays as peak, with two-hour sessions, and Kidz Play in Prestwick runs two-hour sessions at busy times. Kidspace Romford opens longer hours (9am to 7.30pm) on most days between Christmas and New Year. If a centre takes online bookings, booking ahead is the safest way to get in. If it is walk-in only, like Kidz Play, arriving early in the day may help.</p>

<h2>How can I check my local centre’s Christmas hours?</h2>
<ul>
  <li><strong>Look at the centre’s own website first.</strong> Several centres we checked post festive hours on the opening times page, while others put them on a Christmas or events page.</li>
  <li><strong>Check the date is for this year.</strong> Some festive pages are left up from previous years. A quick check that the dates match the right days of the week (for example, Christmas Day 2026 is a Friday) helps you spot old information.</li>
  <li><strong>Ring ahead</strong> if the hours aren’t posted, especially for Christmas Eve, New Year’s Eve and the bank holiday Mondays.</li>
  <li><strong>Find centres near you</strong> on your ${link('/soft-play', 'town page')}, and see our ${link('/blog/soft-play-closed-party-booking', 'guide to checking a centre is still open')} before you travel.</li>
</ul>

<h2>Are there special Christmas Eve or New Year’s Eve sessions?</h2>
<p>Some centres run them. Brocksbushes runs festive discos and elf workshops in the days before Christmas, and Red Robin Wacky Warehouse in Wigan describes a Christmas Eve Pyjama Party and a New Year’s Eve Disco on its Christmas page, though without dates or times, so check with the venue first. For grottos and breakfast with Santa, see our ${link('/blog/santa-at-soft-play-uk', 'Santa at soft play guide')}. If your child prefers a quieter visit, our ${link('/blog/sen-friendly-soft-play-uk', 'SEN-friendly soft play guide')} has tips.</p>

<h2>Run a soft play centre?</h2>
<p>If your centre is listed on Soft Play Near Me, you can ${link('/add-venue', 'claim or update your listing')} for free and keep your opening hours and details up to date for local parents.</p>`,
    faq: [
      {
        q: 'Is soft play open on Christmas Day?',
        a: 'Very rarely. All 10 listed centres we checked on 22 November 2026 whose websites cover Christmas Day say they are closed that day, including Kidspace Romford, Oxygen York, Kidz Play in Prestwick and Jam Jam Boomerang in Coventry.',
      },
      {
        q: 'Is soft play open on Boxing Day?',
        a: 'Mostly not. All 10 of the centres we checked whose websites cover Boxing Day say they are closed that day (Saturday 26 December 2026). The Boxing Day bank holiday moves to Monday 28 December this year, and some centres change their hours on bank holidays, so check that day too.',
      },
      {
        q: 'Is soft play open on Christmas Eve?',
        a: 'Often, but with shorter hours. Kidspace Romford is open 9am to 5.30pm, Oxygen York 9am to 4pm and The Moody Calf Play Barn 9.30am to 3.45pm on Christmas Eve, and Jam Jam Boomerang in Coventry closes at 5pm, while Playzone in Lincoln and Ferdi’s Indoor Play in Helston are closed.',
      },
      {
        q: 'Is soft play open on New Year’s Day?',
        a: 'It depends on the centre. Oxygen York opens 10am to 7pm and The Moody Calf Play Barn 11.45am to 6pm on New Year’s Day 2027, but Playzone in Lincoln, Kidz Play, Jam Jam Boomerang and Ferdi’s Indoor Play are closed.',
      },
      {
        q: 'Do I need to book soft play over the Christmas holidays?',
        a: 'It is a good idea where booking is offered, as some centres treat school holidays as peak time and some limit sessions to two hours. Some centres, such as Kidz Play in Prestwick, are walk-in only for general play.',
      },
    ],
  },
]
