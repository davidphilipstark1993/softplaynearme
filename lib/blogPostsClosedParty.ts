/**
 * UK guide for parents: how to check a soft play centre is still open, and what to do if a venue closes with a
 * party booked. Hand-written 21 November 2026. Closure examples (one each from the West Midlands, East of England,
 * East Midlands and Scotland, in date order) and all money-back steps were checked on the cited pages on
 * 21 November 2026; sources in /workspace/softplay/blog/pending/soft-play-closed-party-booking/sources.md.
 * Money-back wording stays within the Citizens Advice pages cited (no wider legal advice).
 */
import type { BlogPost } from './blogPosts'

const link = (href: string, label: string) => `<a href="${href}" class="text-purple-700 hover:underline">${label}</a>`
const hub = (slug: string, label: string) => link(`/soft-play/${slug}`, label)
const ext = (href: string, label: string) =>
  `<a href="${href}" class="text-purple-700 hover:underline" target="_blank" rel="noopener nofollow">${label}</a>`

const CA = 'https://www.citizensadvice.org.uk'
const CA_BUST = '/consumer/somethings-gone-wrong-with-a-purchase/if-a-company-stops-trading-or-goes-out-of-business/'
const CA_CARD = '/consumer/somethings-gone-wrong-with-a-purchase/getting-your-money-back-if-you-paid-by-card-or-paypal/'

export const closedPartyPosts: BlogPost[] = [
  {
    slug: 'soft-play-closed-party-booking',
    title: 'Is My Soft Play Still Open? What to Do If Your Party Venue Closes (2026)',
    metaTitle: 'Soft Play Closed With a Party Booked? | Soft Play Near Me',
    metaDescription:
      'How to check a soft play centre is still open, and how to get your money back if it closes with a party booked: venue, card, PayPal and creditor claims.',
    city: 'UK',
    excerpt:
      'Check a soft play centre is still open before you set off, especially if you have a party booked: look at its own website and latest social posts, and phone ahead. If a venue is closing, contact it first, because some owners refund party bookings themselves. If you cannot reach it, Citizens Advice explains how a card chargeback, a Section 75 claim, a PayPal dispute or a creditor claim may help, though there is no guarantee you will get your money back.',
    publishedAt: '2026-11-21T00:00:00.000Z',
    updatedAt: '2026-11-21T00:00:00.000Z',
    datePublished: '2026-11-21T00:00:00.000Z',
    dateModified: '2026-11-21T00:00:00.000Z',
    verifiedOn: '21 November 2026',
    contentHtml: `<h2>Why is it worth checking a soft play centre is still open?</h2>
<p>Soft play centres can close for all sorts of reasons, sometimes with only a few weeks’ notice. These recent announcements, from four different parts of the UK (in date order), show why a quick check before you go is worth it:</p>
<ul>
  <li><strong>West Midlands:</strong> Playtropolis in Wombourne closed on 31 October 2026. The owner said trading conditions and rising costs, including higher electricity standing charges due next year, meant it could not continue, and that everyone with a party booked had been contacted and refunded. ${ext('https://www.expressandstar.com/news/parents-devastated-as-much-loved-childrens-play-centre-closes-doors-9351761', 'Express &amp; Star, 15 November 2026')}</li>
  <li><strong>East of England:</strong> The Play Den in Ipswich announced it would close on Sunday 22 November 2026, so that its owner could focus on her son’s health needs. ${ext('https://www.ipswichstar.co.uk/news/26657152.play-den-ipswich-will-close-november-2026/', 'Ipswich Star')}</li>
  <li><strong>East Midlands:</strong> The Bairns play café in Sleaford announced it would close on Sunday 29 November 2026, citing the costs of running a small business. ${ext('https://www.lincolnshireworld.com/news/sad-news-as-popular-play-cafe-in-sleaford-set-to-close-blaming-crippling-business-costs-9346894', 'LincolnshireWorld, 12 November 2026')}</li>
  <li><strong>Scotland:</strong> Wee Kingdom Activity and Play Centre in Cupar, Fife, announced it would close on 18 December 2026, citing personal circumstances and the ongoing costs of running the business. ${ext('https://www.thecourier.co.uk/fp/business-environment/business/5610276/fife-soft-play-centre-closure/', 'The Courier, 2 November 2026')}</li>
</ul>
<p>BBC News has also reported on soft play owners in Shropshire and Worcestershire who say a hot summer and high running costs have made business hard. ${ext('https://www.bbc.co.uk/news/articles/cm4g11exqqwvo', 'BBC News, 9 November 2026')}</p>

<h2>How do I check a soft play centre is open before I go?</h2>
<p>Do a few quick checks on the day, or a few days before a party:</p>
<ul>
  <li><strong>The venue’s own website and booking page.</strong> Check the opening times and whether sessions or parties can still be booked for your date.</li>
  <li><strong>Its latest social media posts.</strong> All four closures above were announced by the owners on social media.</li>
  <li><strong>Phone ahead.</strong> Opening hours can change, especially over Christmas.</li>
  <li><strong>Our listings.</strong> Each ${link('/soft-play', 'town and city page')} lists the centres we know about, with links to their websites. Our listings are not updated in real time, so treat them as a starting point and confirm with the venue.</li>
</ul>
<p>If you spot that a centre has closed, or you run a centre and your details have changed, please let us know through our ${link('/contact', 'contact page')}.</p>

<h2>My party venue is closing. Will I get my money back?</h2>
<p>Start with the venue itself. Some owners contact party bookers themselves when they decide to close: the owner of Playtropolis said everyone with a party booked had been contacted and refunded. If you have not heard anything, get in touch as soon as you can.</p>
<p>Citizens Advice says it is best to email or write to the trader and keep a copy of anything you send. Explain what you paid for and ask for a refund. If the business is run by a sole trader or partnership, Citizens Advice says they are still responsible for things that have been paid for, even when they stop trading.</p>
<p>While you wait, it may be worth looking at other venues for the same date. Our guides to ${link('/blog/soft-play-party-cost-uk', 'soft play party costs')}, ${link('/blog/soft-play-hire-for-parties-uk', 'soft play hire for parties')} and ${link('/blog/play-cafes-uk-guide', 'play cafés')} may help, and if your plans included a festive visit, see our ${link('/blog/santa-at-soft-play-uk', 'Santa at soft play guide')}.</p>

<h2>What if I can’t reach them, or the business has gone bust?</h2>
<p>Citizens Advice suggests these steps (${ext(CA + CA_BUST, 'Citizens Advice: if a company stops trading')}):</p>
<ol>
  <li><strong>Check whether it has gone out of business.</strong> Search the Companies House website if it is a limited company (with ‘Ltd’ or ‘Plc’ after its name), or the Insolvency Register if it is a sole trader or partnership. On the Insolvency Register, search both the owner’s name and the trading name. It can take a few weeks for information to appear.</li>
  <li><strong>Get the administrator’s or receiver’s details.</strong> This is the person dealing with the business’s debts, and their name is usually on the company’s website.</li>
  <li><strong>Register a claim as a creditor</strong> on GOV.UK, with details of what you are owed, and send it to the administrator.</li>
</ol>
<p>Be prepared for the fact that this may not get your money back. Citizens Advice explains that others, like banks, are paid first, so you might not get anything. That is why the way you paid matters.</p>

<h2>Can my bank or PayPal help me get my money back?</h2>
<p>Possibly. Citizens Advice says to try the trader first, and if you cannot contact them or they will not help, to ask your card provider or PayPal (${ext(CA + CA_CARD, 'Citizens Advice: paying by card or PayPal')}):</p>
<ul>
  <li><strong>Credit card or buy now, pay later:</strong> you can ask for a Section 75 claim if the single item or service cost more than £100 and no more than £30,000. The limit is about the cost of the item, not how much went on the card: in a Citizens Advice example, someone who paid a £50 deposit by credit card on a £250 purchase could claim the full £250. Citizens Advice also says that if you used buy now, pay later for something bought before 15 July 2026, you cannot use Section 75. The FCA says the newer protection only applies where the buy now, pay later lender is a different business from the seller.</li>
  <li><strong>Debit card, charge card, or credit card where Section 75 doesn’t apply:</strong> ask for a chargeback. Your bank may call it a ‘disputed transaction’. You can only get back what you paid on that card, and your bank might not agree. Ask quickly: MoneyHelper says you usually have 120 days to claim, counted from the purchase date or, for something booked ahead such as an event, from the date it was due to happen.</li>
  <li><strong>PayPal:</strong> open a dispute on the PayPal website within 180 days of paying.</li>
</ul>
<p>If the whole party booking cost £100 or less, Section 75 does not apply, so a chargeback is usually the route to ask about. If you paid only a deposit by credit card, Section 75 can still apply as long as the full cost of the party was more than £100. Citizens Advice says it is best to ask your card provider in writing.</p>

<h2>Is the advice different in Scotland, Wales and Northern Ireland?</h2>
<p>The Citizens Advice pages above are for England. Use the version for where you live:</p>
<ul>
  <li><strong>Scotland:</strong> ${ext(CA + '/scotland' + CA_BUST, 'if a company stops trading (Scotland)')} and ${ext(CA + '/scotland' + CA_CARD, 'paying by card or PayPal (Scotland)')}. For sole traders and partnerships, the Scottish page points you to the Register of Insolvencies on the Accountant in Bankruptcy website, and it lists Advice Direct Scotland’s consumer service for more help.</li>
  <li><strong>Wales:</strong> ${ext(CA + '/wales' + CA_BUST, 'if a company stops trading (Wales)')} and ${ext(CA + '/wales' + CA_CARD, 'paying by card or PayPal (Wales)')}.</li>
  <li><strong>Northern Ireland:</strong> Citizens Advice says its website does not cover Northern Ireland, and points people to Consumerline for help with consumer rights. ${ext(CA + '/about-us/northern-ireland/', 'Citizens Advice: get advice in Northern Ireland')}</li>
</ul>

<h2>How can I protect my next party booking?</h2>
<ul>
  <li><strong>Pay by card where you can,</strong> so you can ask about the chargeback or Section 75 options described above.</li>
  <li><strong>Keep your confirmation, receipts and any emails,</strong> and keep copies of anything you send the venue.</li>
  <li><strong>Read the cancellation and refund terms</strong> before you pay a deposit, so you know what happens if either side cancels.</li>
  <li><strong>Check the venue is still trading close to the date,</strong> using the checks above, a week or so before the party.</li>
</ul>

<h2>Find another soft play centre near you</h2>
<p>If your usual centre has closed, open your ${link('/soft-play', 'town or city page')} to see others nearby, for example our ${hub('wombourne', 'Wombourne')}, ${hub('ipswich', 'Ipswich')}, ${hub('lincoln', 'Lincoln')} and ${hub('cupar', 'Cupar')} pages. Always check opening times and party availability with the centre before you book.</p>`,
    faq: [
      {
        q: 'Do I get a refund if soft play closes?',
        a: 'Some venues refund party bookings themselves, so contact the venue first and ask in writing. If it has gone out of business, Citizens Advice says you can register a claim as a creditor, but others such as banks are paid first, so you might not get anything back. Paying by card can give you extra options through chargeback or Section 75.',
      },
      {
        q: 'Can I get a chargeback for a party deposit?',
        a: 'You can ask. Citizens Advice says to ask your bank for a chargeback if you paid by debit card or charge card, or by credit card where Section 75 does not apply, for example where the whole booking cost £100 or less. You only get back what you paid on that card, and your bank might not agree.',
      },
      {
        q: 'How do I know if a soft play has closed down?',
        a: 'Check the venue’s own website and booking page, look at its latest social media posts and phone ahead. If you think the business has gone bust, Citizens Advice suggests searching Companies House for a limited company, or the Insolvency Register for a sole trader or partnership (in Scotland, the Register of Insolvencies on the Accountant in Bankruptcy website).',
      },
    ],
  },
]
