/**
 * Render-time clean-up of the stored venue text (Phase 4, 25 Nov 2026).
 *
 * The description, what_to_expect and tips_before_visiting columns were filled by
 * earlier bulk generators. Alongside real facts (rating, address, what the venue's
 * website mentions, the date it was checked) they carry the same filler on hundreds
 * of pages, and some of it states things nobody checked: "families tend to visit for
 * a couple of hours", "weekday visits tend to be quieter", "a familiar name locally",
 * "sightlines that make it easier for parents". Five identical tips sit on ~1,500
 * pages.
 *
 * These helpers drop that filler when the page renders and keep everything else.
 * The DB text is untouched, so this is reversible and an owner's own wording (or a
 * later hand-written description) passes straight through: only the known generator
 * sentences below are removed.
 */

/** Whole sentences that are generic advice, or claims with no data behind them. */
const FILLER_SENTENCES: RegExp[] = [
  // unsupported characterisations
  /families tend to visit .+ for a couple of hours/i,
  /tend to be quieter than weekends/i,
  /sightlines that make it easier/i,
  /is a fairly typical .+ in terms of layout/i,
  /keeps its play equipment geared toward/i,
  /keeps things fairly simple/i,
  /is built around one straightforward job/i,
  /aimed at keeping children active for a couple of hours/i,
  /play space at .+ is designed to keep children entertained across a wide age range/i,
  /families in .+ looking for a reliable indoor play option often head to/i,
  /is a well-regarded play venue in .+ that caters to families/i,
  /is one of .+ more consistently well-regarded/i,
  /that local families turn to/i,
  /is a soft play centre worth knowing about/i,
  /built around supervised indoor play for children/i,
  /^(highly rated|well reviewed)( and (local|established|popular|very popular))?( overall)?\.?$/i,
  /^(highly rated|well reviewed)( and (local|established|popular|very popular))? — /i,
  /^worth considering for a local family outing\.?$/i,
  /^an? (venue focused on giving children a safe, active space to play|indoor space where children can play under supervision away from the weather|welcoming play venue that offers indoor facilities for children of varying ages|familiar name locally)/i,
  // type-of-venue boilerplate that says nothing about this venue
  /aimed at giving younger children room to climb, run, and play safely indoors/i,
  /is one of .+ options, offering indoor play facilities for local children/i,
  /serves families across .+ with indoor play space designed for children to burn off energy/i,
  /gives parents an indoor option for active play regardless of the weather/i,
  /operates as .+ focused on indoor play for children of different ages/i,
  /offering families a supervised indoor alternative to the playground/i,
  // generic "check before you go" advice (the page's contact block already says it)
  /worth a direct call or website check before visiting/i,
  /opening hours at .+ can shift around school holidays/i,
  /allow a little extra time on your first visit/i,
  /a quick check of current opening times is sensible/i,
  /like most venues of this kind/i,
  /a quick look at .+ website or social pages before you go/i,
  /it's worth checking their website or social media for current opening times/i,
  /should confirm opening hours and whether pre-booking is required/i,
  /session structure \(timed slots vs\. open play\) is worth confirming/i,
  /check their website or call ahead to confirm opening times before your visit/i,
  /doesn't always list every detail online/i,
  /prices and session times are best confirmed directly before travelling/i,
  /for the first time, it's a good idea to check their website/i,
  /check their current session times and prices online before you go/i,
  /if the café is a priority, it's worth checking what's on the menu/i,
  /this is especially true for party bookings, which can fill up weeks in advance/i,
  /party bookings especially are worth confirming a few weeks ahead/i,
  /book well in advance as slots fill up quickly/i,
]

/** Phrases the generator put in front of the Google review quote. */
const REVIEW_LEAD_INS = /\b(?:One recurring theme in visitor feedback|An? (?:visitor|parent|reviewer) summed it up|(?:Parents|Visitors|Families|Reviewers)(?: (?:at|visiting) [^.:]{1,60})? report)\s*:\s*/gi

/** Tips that appear, word for word, on most venue pages. */
const GENERIC_TIPS: RegExp[] = [
  /most soft play centres require socks/i,
  /bring a snack bag and a water bottle/i,
  /check parking options near .+ before you travel/i,
  /weekend and school holiday sessions fill up quickly/i,
  /weekday mornings .+ are typically the quietest/i,
  /the on-site café means no need to rush home/i,
  /check the menu on their website or social media/i,
]

/** what_to_expect lines that say nothing specific. */
const GENERIC_EXPECT: RegExp[] = [
  /consistently well-rated by local families/i,
]

// "vs." would otherwise end a sentence; protect it while splitting.
const splitSentences = (para: string): string[] =>
  para.replace(/\bvs\./g, 'vs\u0000').split(/(?<=[.!?])\s+(?=[A-Z0-9"“'])/).map((s) => s.replace(/vs\u0000/g, 'vs.').trim()).filter(Boolean)

const isFiller = (s: string) => FILLER_SENTENCES.some((re) => re.test(s))

/**
 * The stored description without generator filler. A Google review quote that the
 * generator pasted in as if it were our own words is shown as an attributed quote.
 * Returns '' when nothing specific is left (the caller then falls back).
 */
export function cleanVenueDescription(description: string | null | undefined, reviewSnippet?: string | null): string {
  if (!description) return ''
  const snippet = reviewSnippet?.trim()
  return description
    .split(/\n{2,}/)
    .map((para) => {
      let p = para.trim()
      let quote = ''
      if (snippet && snippet.length > 10 && p.includes(snippet) && !p.includes(`“${snippet}`) && !p.includes(`"${snippet}`)) {
        // drop the generator's own lead-ins ("A visitor summed it up:", "One recurring theme
        // in visitor feedback:" — one review is not a theme) before adding ours
        p = p.replace(snippet, '').replace(REVIEW_LEAD_INS, '').trim().replace(/(^|[.!?]\s+)[^.!?]*:$/, '$1').trim()
        quote = `One Google reviewer wrote: “${snippet.replace(/\s+([,.!?])/g, '$1')}”`
      }
      const kept = splitSentences(p).filter((s) => !isFiller(s))
      return [...kept, quote].filter(Boolean).join(' ')
    })
    .filter((p) => p.length > 0)
    .join('\n\n')
}

/** Venue-specific tips only, renumbered. '' when every tip was generic. */
export function cleanVenueTips(tips: string | null | undefined): string {
  if (!tips) return ''
  const lines = tips
    .split(/\n+/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
    .flatMap((l) => (GENERIC_TIPS.some((re) => re.test(l)) ? [] : [l]))
  return lines.length > 1 ? lines.map((l, i) => `${i + 1}. ${l}`).join('\n') : lines.join('')
}

/**
 * what_to_expect split into audience tags and body. "Children of all ages" alone is
 * not a useful audience, so it only shows next to something more specific.
 */
export function cleanWhatToExpect(text: string | null | undefined): { audiences: string[]; body: string } {
  if (!text) return { audiences: [], body: '' }
  const m = text.match(/^Best for:\s*([^.]+)\.?\s*/i)
  let audiences = m ? m[1].split(/,\s*| and /).map((a) => a.trim()).filter(Boolean) : []
  if (audiences.every((a) => /^children of all ages$/i.test(a))) audiences = []
  const rest = m ? text.slice(m[0].length) : text
  const body = splitSentences(rest).filter((s) => !GENERIC_EXPECT.some((re) => re.test(s)) && !isFiller(s)).join(' ')
  return { audiences, body }
}
