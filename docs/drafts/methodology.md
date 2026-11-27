# DRAFT: How we find and check venues (for review, not published)

> Proposed route: `/methodology`. Every statement below describes what the code in this
> repository actually does (file references are for you and are not part of the page).
> **[Brackets]** need your decision, mostly the re-check frequency.

---

## How we find and check soft play venues

### 1. Finding venues

We search Google's business listings (the Places API) for soft play, indoor play and play
cafés in each town we cover, then add venues parents and owners send us. *(scripts/discover-google-places-venues.mjs, /add-venue)*

### 2. Keeping only soft play

Google's categories are broad, so a person reviews each venue's type. Outdoor playgrounds,
bouncy-castle hire firms and shops are not listed. Trampoline parks, play farms, leisure
centres and family attractions are listed separately under "Other family activities". They
are not counted as soft play. Duplicate listings for the same place are merged. *(phase18-01; lib/venueTypes.ts)*

### 3. What a listing shows, and where it comes from

| What | Source |
|---|---|
| Name, address, map, phone, website, opening hours, Google rating | Google business listing |
| Café, parking, toddler/baby area, party rooms, SEN sessions, ages, prices | The venue's own website, its owner, or our own check. Each fact is recorded with its source page and the date we checked it. |
| Description | Written from the facts above. A few venues have a longer description we researched from their own website. |

We only show a fact when a source confirms it. "No café shown" means we haven't confirmed
one, not that there isn't one.

Facts found on venue websites are not published automatically. Our checker proposes each
one together with the sentence that supports it, and a person approves or rejects it. *(scripts/enrichment/)*

### 4. "Last verified"

Every venue page shows the date its details were last checked against Google and the
venue's own website. We aim to re-check every listing **[every 6 months]**, and sooner when
a parent or owner tells us something has changed.

### 5. Owners

An owner can claim a listing free. We accept a claim when the email address matches the
venue's website domain. Webmail addresses, and sites on shared platforms such as Facebook
or Wix, are checked by hand. Owners' changes are logged with the date and who made them.
*(lib/claims/)*

### 6. What paying changes, and what it doesn't

Premium and Bespoke plans give featured placement and enquiry alerts. A featured venue is
shown first in its town's list and labelled "Featured", and a Bespoke slot is labelled
"Sponsored". After the featured venues, a town's list is ordered by Google rating, adjusted
so a handful of reviews can't outrank hundreds. A claimed listing with fuller details gets a
small tie-break among venues rated about the same. Paying never changes a listing's facts
or its rating. *(app/soft-play/[city]/page.tsx sortByRating; lib/ownerData.ts listingBoost)*

### 7. What we leave out of search engines

Pages that don't yet have enough to be useful are kept out of search results until they
do: a venue with no confirmed facts beyond its Google listing, a town with fewer than three
soft play centres, or a category page with fewer than three venues. They're still on the
site for anyone who follows a link. *(lib/indexing.ts)*

### Mistakes

See our [corrections policy](/corrections).
