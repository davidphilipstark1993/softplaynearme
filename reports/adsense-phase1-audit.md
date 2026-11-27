# AdSense "low-value content": Phase 1 findings (read-only)

27 Nov 2026. No code or data changed. Everything below is in `seo-data/adsense/` (outputs; gitignored) (gitignored, like the rest of `seo-data/`).

## How this was measured

- I built the site (`npm run build`, static-data mode) and crawled every reachable URL from a local server: **2,837 URLs**. The seeds were sitemap.xml, every venue and hub in the export, and all filter paths. From there it followed internal links.
- This container has **no database and no GSC export**, so the data source is the committed static export (`data/generated/venues.json`: 1,802 records, of which 1,135 count as soft play, matching the live figure). Production reads Neon. Small drift is possible.
- "Unique main content" is text inside `<main>` (no header, nav or footer). Each sentence is normalised to a template, with venue names, addresses, towns, postcodes, numbers and dates turned into tokens. A sentence counts as **templated** when that template appears on 5 or more pages of the same type. "Unique words" are the words in the remaining sentences.
- **The GSC clicks cross-check is not done** (no export here). Run it locally; see the end of this report.

Files:
| File | What |
|---|---|
| `page-inventory.csv` | every URL: type, status, indexable, in sitemap, main words, unique words, % shared exact, % templated, venues listed, venue fields |
| `summary-by-type.json`, `templates-by-type.json`, `boilerplate.json` | step 1–2 aggregates and top templates |
| `data-quality.json`, `copy-claims.json`, `count-mismatches.json`, `hub-intro-contradictions.json` | step 3–4 |
| `off-category-candidates.csv`, `duplicate-candidates.csv` | review lists (tier = high / review / classified) |
| `pruning-candidates.csv`, `pruning-summary.json` | step 7: every URL each rule touches (+ merge target for hubs) |
| `scripts/seo/adsense/` | crawler + analysis scripts (rerunnable for Phase H) |

---

## 1. Page inventory

| Type | URLs | Indexable | In sitemap | Median main words | Median unique words (indexable) | Mean % templated (indexable) |
|---|---|---|---|---|---|---|
| Venue | 1,802 | **1,421** | 1,802* | 588 | **23** | **96.6%** |
| City hub | 190 | 187 | 187 | 802 | 120 | 83.5% |
| Hub page 2+ | 12 | 12 | 12 | 861 | 537 | 39.7% |
| Filter (toddler/parties/SEN) | 570 (24 are 404) | 245 | 242 | 361 | **26** | **92.5%** |
| Filter /open-now | 190 | 0 | 0 | 313 | – | – |
| London area hubs | 5 | 5 | 5 | 318 | 184 | 40.6% |
| Blog posts | 51 | 32 | 32 | 941 | 571 | 46.5% |
| Category hubs, home, /soft-play, static | 23 | 22 | – | – | – | low |
| **Total indexable** | | **1,918** | | | | |

\* In static mode the sitemap's fallback branch lists **every** venue, including the 381 noindex ones, because `isVenueIndexable` is only applied in the DB branch (`app/sitemap.ts`). In production the DB is up, so this only bites during a DB outage, but it is a latent bug. Three filter pages are indexable but missing from the sitemap (`brighton/sen-friendly`, `bristol/toddler`, `liverpool/birthday-parties`): the sitemap and the page count matching venues differently.

**Takeaway:** about 1,650 of the 1,918 indexable URLs (venues + filters) carry roughly 25 words of their own. That is the pattern AdSense and the scaled-content policy describe.

## 2. Boilerplate measure

| Content | Docs | Sentences from shared templates | Notes |
|---|---|---|---|
| Venue descriptions (data field) | 1,793 | **69.5%** | 1,482 descriptions (860 of the 1,135 soft play) are the old generic generator: "gives parents an indoor option", "Well reviewed", "operates as a…", "A visitor summed it up…". 164 are the newer honest "factual-verified" pattern (PR #38/#39), itself one 4–5 sentence template. Only ~146 read as hand-written. |
| Hub intros ("About soft play in…") | 174 | **82.7%** | 13 indexable hubs have no intro. The top intro sentences appear on 33–55% of hubs. |
| Hub FAQs | 187 | **90.4%** | 6 questions on 93–99% of hubs. Answers are data-filled but share one frame. |
| Filter intros/tips | 75 have one | **100%** | One tips block (6 sentences) is identical on every toddler page. Party and SEN pages have tips + FAQ only. 170 indexable filter pages have no intro at all. |
| Filter FAQs | 245 | **100%** | 6 document patterns cover all 245 pages (one per filter type, city name swapped). |

Top venue-page templates, each on 90%+ of venue pages: the 4 FAQ questions ("Is X suitable for toddlers?", "…food and drinks…", "…parking…", "…book in advance…") with "isn't confirmed on our listing" answers, "We're still gathering detailed facility information…", "Pricing information has not yet been confirmed…", the claim-listing block, and the newsletter block.

## 3. Data quality

**Off-category**
| Group | Records | Indexable pages now |
|---|---|---|
| park-playground | 320 | 0 (noindex, still crawlable and linked) |
| mobile-hire (bouncy castle etc.) | 59 | 0 |
| retail | 2 | 0 |
| leisure-centre | 89 | **89** (un-noindexed 25 Nov at your request) |
| family-attraction | 121 | **121** |
| play-farm | 40 | **40** |
| trampoline-park | 36 | **36** |
| pub | 2 | 2 |
| Typed "indoor", but name/Places category says gym, pool, ski school, playground, pub, nursery, hire… | 203 flagged | **89 high-confidence**; 114 in a review tier because the name also says soft play (e.g. Wacky Warehouse, "…Nursery and Soft Play Centre") |

The keyword flags are a review queue, not a delete list. Even the high tier has a few genuine play cafés. Both tiers are in `off-category-candidates.csv`.

**Duplicates**
- Same place_id: **0** (already cleaned).
- Same normalised name within 200 m: **7 pairs**. Identical coordinates: **1 group**. All are in `duplicate-candidates.csv`. The older `reports/duplicate-candidates.csv` covers cross-town duplicates, and those have mostly been 301'd already.

**Addresses / Maps**
- Address blank: **257** records. Postcode missing: 10.
- 460 addresses are a single token with no number (e.g. "S Deeside Rd"), so listing cards show a street fragment only.
- Maps links: 738 records have no place_id. 22 have no place_id and no coordinates (text-search link only). **5 are broken**: no ID, no coordinates and a missing address or postcode.
- 16 records have `mainImageUrl = "nan"` (broken image). 909 of the 1,135 photos are Google Places photos and 220 are Google placeholder icons. **1** photo came from an owner.
- No rendered page contains literal `undefined`, `null` or `NaN`.

**Copy that references data we don't hold or show**
- **318** soft play descriptions (513 in all) paraphrase or quote Google reviews ("A visitor summed it up…", "One recurring theme in visitor feedback…"). The review text itself is not on the page, and the Places terms restrict this.
- **378** descriptions call an outdoor playground "indoor" or a "soft play centre" (21 of them on visible venues). Example: *"Balgownie Drive Play Area operates as a soft play centre… play safely indoors."*
- 203 generic "soft play centre" descriptions sit on non-soft-play types (hire firms, leisure parks).
- 43 value judgements ("good value", "affordable") with no price data, and 7 explicit £ prices with no price field shown.
- Description says café/parking/toddler/SEN/parties while the flag is false: 26 / 115 / 31 / 15 / 7.
- **Hub intros contradict their own FAQ**: 110 hubs claim SEN/quiet sessions while the FAQ says none are marked SEN, 29 claim toddler areas the FAQ says aren't confirmed, and 20 give local £ ranges ("expect to pay £6–£11") while the FAQ says "We don't hold published prices". Aberdeen is a clear example.
- **Inconsistent counts**: on 10 large hubs the parent-guide teaser's venue count disagrees with the live count (e.g. Huddersfield 17 vs 9, York 20 vs 14). Title, meta, heading and FAQ agree everywhere.

## 4. Venue field fill rates (1,135 soft play venues)

| Field | Filled | Realistic source |
|---|---|---|
| Age range | **0%** (no field exists) | venue website (often on the prices or FAQ page) |
| Price | 12.6% | website (prices page) |
| Opening hours | 70.9% | Places (already); website for session times |
| SEN / quiet sessions | 5.1% | website (often a "SEN sessions" page) + owner |
| Café | 27.5% | website |
| Parking | 6.3% | website / Places attributes |
| Party packages | 25.7% | website (party page; price often published) |
| Toddler area | 10.7% (baby 5.7%) | website |
| Website | 74.2% | Places |
| Phone | 71.5% | Places |
| Rating + review count | 92.3% | Places |
| Last verified | 95.2% (but **797 are April 2026**; 221 are Oct–Nov) | your own check |
| Photo | 68.4% (almost all Google) | owner |

140 soft play venues have **no fact at all beyond Google Places data**. Of those, 842 have a website, so a website scrape could reach most of them. Owner claims are the only realistic source for photos, SEN session detail and corrections.

## 5. Template repetition on a page

| Page | Repeated |
|---|---|
| Homepage | Newsletter sign-up **3×** (hero, mid-page "Sunday's family guide", footer). "Free / no sign-up" **2×**, plus "Free to claim", "completely free" and "Free listing" in the nav. Claim-listing pitch 2×. **Every town (~182) listed in "Browse by Location"** plus about 40 city links in the footer. |
| Venue pages | Claim-listing CTA **3×** ("Venue Owners: Manage Your Listing", "Own this venue?", "Claim This Venue (Free)"). "Get Directions" 3×. Newsletter 2× (body + footer). On 1,125 venue pages 10+ footer city links are repeated in the body. |
| City hubs | Newsletter 2×. Footer city list repeated in the body on 38 hubs. |
| Blog | Newsletter 2×. |

## 6. Trust pages and ads

- **About**: generic. No named person, no location or company, no method, no update frequency. It says "As parents ourselves" and "a single, up-to-date resource" (797 venues were last verified in April). The homepage says "Built by parents, for parents… since 2025".
- **Contact**: a form plus info@ addresses, with a 48-hour response promise. No postal address or company details.
- **Privacy**: updated November 2026 and covers GA and the owner data well. It **does not mention AdSense or advertising cookies**, even though the AdSense script loads on every page (`app/layout.tsx:138`).
- **Editorial / methodology / corrections pages**: none.
- **ads.txt**: exists with the real publisher ID (`pub-1521157758368352`), not a placeholder. Fine as it is.
- **Consent**: **no cookie banner and no CMP**. GA4 and AdSense load unconditionally, and there is no Consent Mode v2. Google requires a Google-certified CMP (IAB TCF v2.2) to serve ads to UK/EEA users. Unconditional GA cookies are also a PECR problem regardless of AdSense. Simplest route: AdSense's own "Privacy & messaging" (Funding Choices) CMP, which is free and certified, plus Consent Mode v2 defaults set before gtag loads.

## 7. Proposed pruning rules (counts from the static export)

| Rule | Action | URLs |
|---|---|---|
| R1 Filter page with <3 genuine matching venues | noindex,follow + out of sitemap (keep rendering) | **205** of 245 indexable → 40 stay |
| R2 City hub with <3 genuine venues | ≤25 km from a hub with ≥3: 301 into it and list its venues there. Otherwise noindex,follow until it reaches 3 | **109** of 187 → 78 stay (merge targets in CSV) |
| R3 Venue page with no facts beyond Places data | noindex,follow until enriched (auto re-index once it has 1+ verified fact **and** a non-template description) | **515** |
| R4a park-playground, mobile-hire, retail (already noindex) | remove from listings. 410, or 301 to the hub if it has GSC clicks | 381 |
| R4b high-confidence off-category typed "indoor" | human review, then same as R4a | 87 indexable |
| R4c trampoline-park / play-farm / family-attraction | **your call**. My recommendation: keep them in "Other family activities", noindex unless enriched (only 4/36, 11/40 and 33/121 have any fact beyond Places) | 197 |
| R4d leisure-centre | **conflicts with your 25 Nov decision.** Recommendation: index only those with a confirmed soft play offer, noindex the rest. Our own data can't tell which: the generic copy calls all of them "soft play centres". | 89 |
| R4e duplicates | 301 the weaker record to the kept one | 8 |

If all of these are applied (R4c as recommended, R4d keeping about 57), **indexable URLs go from 1,918 to about 770**: about 585 venues, 78 hubs, 40 filters, 32 blog posts and the rest.

Pruning alone does not fix the problem. The venue pages that survive still have a median of **26 unique words**, because the page template itself (FAQ, "not confirmed" blocks, CTAs) is the boilerplate. Phase C (fact-built descriptions, and dropping the "not confirmed" FAQ answers rather than printing them) matters as much as the noindex rules.

### GSC cross-check: still to do (needs your export)
I could not check clicks. On your machine, with the GSC Pages export (3 months):
```
python3 scripts/seo/adsense/pruning.py --gsc=seo-data/gsc-2026-11-24/perf/Pages.csv
python3 scripts/seo/adsense/analyze.py --gsc=seo-data/gsc-2026-11-24/perf/Pages.csv
```
This fills `gsc_clicks` in `pruning-candidates.csv` and `page-inventory.csv`. Suggested rule: any URL with **≥3 clicks in 3 months** is exempt from noindex and gets a manual decision. A 410 candidate with any clicks gets a 301 to its hub instead.

### Rerunning the crawl (Phase H)
```
npm run build && SOFTPLAY_STATIC_BUILD=1 npx next start -p 3123
python3 scripts/seo/adsense/crawl.py seo-data/adsense/crawl/pages.jsonl
python3 scripts/seo/adsense/analyze.py
```

## Decisions I need from you
1. Thresholds: 3 genuine venues for hubs and filters? R3's "≥1 verified fact beyond Places" for venues?
2. R2: merge-with-301 for small hubs within 25 km of a bigger hub, or noindex-only for all of them?
3. R4c: noindex trampoline parks, play farms and family attractions (keep in the "Other activities" tab), or remove them?
4. R4d: reverse the 25 Nov leisure-centre decision for centres without confirmed soft play?
5. Off-category review: will you go through `off-category-candidates.csv` (tiers high + review), or should Phase 2 act on the high tier only?
6. Should these scripts and the inventory (no GSC data) be committed, e.g. under `scripts/seo/adsense/`, so Phase H can be rerun anywhere?
