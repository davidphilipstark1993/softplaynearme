/**
 * UK-wide SEN-friendly / quieter soft play discovery guide. Hand-written (unlike blogPostsUk.ts, which is
 * generated), so it must NOT be overwritten by a guide generator.
 *
 * It states no session times, prices or availability: those are not held in our data, and the guide tells
 * parents to confirm them with each venue. City SEN filter links are only used where the route has venues
 * marked SEN-friendly in the directory; Scotland and Northern Ireland link to the city directories instead.
 */
import type { BlogPost } from './blogPosts'

const link = (href: string, label: string) => `<a href="${href}" class="text-purple-700 hover:underline">${label}</a>`

export const senPosts: BlogPost[] = [
  {
    slug: 'sen-friendly-soft-play-uk',
    title: 'SEN-friendly soft play UK: how to find quieter sessions',
    metaTitle: 'SEN-Friendly Soft Play UK: Quieter Sessions Guide | Soft Play Near Me',
    metaDescription:
      'How to find quieter or SEN-friendly soft play sessions across the UK. Checklist of questions to ask venues, plus links to city SEN listings where we have them.',
    city: 'UK',
    excerpt:
      'Use Soft Play Near Me’s city SEN-friendly filters where available, then confirm quieter or SEN sessions directly with each venue before you travel. A venue marked SEN-friendly in our directory means the listing reports that facility — it is not a medical assessment and not a guarantee the session will suit your child.',
    // DRAFT dates: set to the day this was drafted. Adjust publishedAt/datePublished to the real publish date when it goes live.
    publishedAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
    datePublished: '2026-11-07T00:00:00.000Z',
    dateModified: '2026-11-07T00:00:00.000Z',
    verifiedOn: '7 November 2026',
    contentHtml: `<h2>What “SEN-friendly” means here</h2>
<p>On Soft Play Near Me, a venue is marked <strong>SEN-friendly</strong> when its listing reports SEN-friendly facilities or sessions. That is information about the venue, not an assessment of any child’s needs, and not a promise about how a particular visit will feel. Venues also describe this in different ways: quieter, relaxed, sensory, reduced-capacity, SEN or SEND sessions can all mean different things, so the questions below matter more than the label.</p>
<p>Session times, prices and availability change, and many venues do not publish them. We do not list schedules here: always confirm the details with the venue before you travel.</p>

<h2>How to search on Soft Play Near Me</h2>
<ol>
  <li>Open the page for your town or city from the ${link('/soft-play', 'full list of towns and cities')}.</li>
  <li>Where the city has venues marked SEN-friendly, choose the <em>SEN-friendly</em> filter to see only those listings. Not every city has any, and a venue missing from the filter may still run quieter sessions that are not recorded in our data.</li>
  <li>Open a venue’s own page for the facilities it reports, then contact the venue to check the points in the next section.</li>
</ol>
<p>If your area has no SEN-friendly listings, or a listing is thin, the same checklist works for any soft play centre: ask directly.</p>

<h2>Questions to ask before you go</h2>
<p>Ask the venue, unless the answer is already on its own page:</p>
<ul>
  <li>Do you run quieter, relaxed, reduced-capacity, SEN or SEND sessions?</li>
  <li>What are the current dates and times, and does the session need to be booked?</li>
  <li>Is the music turned off or down, are the lights dimmed, and are there fewer announcements?</li>
  <li>Is capacity reduced, and can siblings come too?</li>
  <li>What are the carer or adult entry rules, and are there extra charges?</li>
  <li>Is there a separate toddler or baby area?</li>
  <li>What is access like: step-free entry, accessible toilets and changing, parking and space for buggies?</li>
  <li>What happens if my child cannot settle: can I cancel or leave, and what is the refund policy?</li>
</ul>
<p>Our guide to ${link('/blog/baby-and-toddler-soft-play-uk', 'baby and toddler soft play in the UK')} covers separate under-fives areas and quieter weekday times in more detail.</p>

<h2>Starting points by nation and city</h2>
<p>These are places to begin, not a ranking. Venues named below are examples that are marked SEN-friendly in our directory; check each venue for current sessions.</p>

<h3>England</h3>
<ul>
  <li><strong>${link('/soft-play/london/sen-friendly', 'London SEN-friendly soft play')}</strong> — listings currently marked include ${link('/soft-play/london/the-pod-soft-play-ymca-hawker', 'The Pod Soft Play at YMCA Hawker')} and ${link('/soft-play/london/appletown-london-indoor-kids-soft-play-family-venue', 'Appletown London- Indoor Kids Soft Play &amp; Family Venue')}.</li>
  <li><strong>${link('/soft-play/newcastle/sen-friendly', 'Newcastle SEN-friendly soft play')}</strong> — listings currently marked include ${link('/soft-play/newcastle/rainbow-family-hub', 'Rainbow Family Hub')} and ${link('/soft-play/newcastle/the-sensory-play-den-newcastle', 'The Sensory Play Den')}. The Rainbow Family Hub listing reports SEN and sensory sessions but does not yet confirm hours or prices, so contact the venue for both.</li>
  <li><strong>${link('/soft-play/manchester', 'Manchester soft play')}</strong> — no Manchester venue is currently marked SEN-friendly in our directory. That reflects our listings only, not what venues offer in practice, so ask venues about quieter or SEN sessions.</li>
</ul>

<h3>Scotland</h3>
<ul>
  <li>${link('/soft-play/glasgow', 'Glasgow soft play')} and ${link('/soft-play/edinburgh', 'Edinburgh soft play')} — we do not currently have a SEN-friendly listing to point to in either city, so use the directories and ask venues about quieter or SEN sessions.</li>
</ul>

<h3>Wales</h3>
<ul>
  <li><strong>${link('/soft-play/cardiff/sen-friendly', 'Cardiff SEN-friendly soft play')}</strong> — listings currently marked include ${link('/soft-play/cardiff/the-play-yard', 'The Play Yard')}, ${link('/soft-play/cardiff/little-kingdom', 'Little Kingdom')} and ${link('/soft-play/cardiff/mambo-play-centre-cardiff', 'Mambo Play Centre Cardiff')}.</li>
</ul>

<h3>Northern Ireland</h3>
<ul>
  <li>${link('/soft-play/belfast', 'Belfast soft play')} — we do not currently have a SEN-friendly listing to point to in Belfast, so use the directory and ask venues about quieter or SEN sessions.</li>
</ul>

<p>Elsewhere, browse the ${link('/soft-play', 'directory by town and city')}.</p>`,
    faq: [
      {
        q: 'How do I find SEN-friendly soft play near me?',
        a: 'Open your town or city page and use the SEN-friendly filter if one has venues marked. Then contact each venue to confirm quieter or SEN session dates, times and booking before you travel.',
      },
      {
        q: 'Does SEN-friendly mean a venue is right for my child?',
        a: 'No. A SEN-friendly label means the listing reports that facility. It is not a medical assessment and not a guarantee that a session will suit your child, so ask the venue what to expect.',
      },
      {
        q: 'Are carers charged to come in?',
        a: 'It varies by venue. Ask about carer and adult entry rules and any extra charges before you book.',
      },
      {
        q: 'What if my area has no SEN-friendly listings?',
        a: 'A missing listing does not mean no venue offers quieter sessions. Use the checklist above to ask local soft play centres directly.',
      },
    ],
  },
]
