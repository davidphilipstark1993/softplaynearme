# AdSense "low-value content": Phase 2 changes and verification

27 Nov 2026. Branch `claude/loving-heisenberg-3gi1fp`. Phase 1 findings are in
`reports/adsense-phase1-audit.md`.

**How it was measured:** I crawled a local production build (static-data mode), using the
same crawler and analysis as Phase 1 (`scripts/seo/adsense/`), before and after. The DB
isn't reachable from here, so the "after" figures use the static export with the clean-up
plan applied (`phase18-01 --static`). Live numbers will match once you've run the DB steps
below. The GSC clicks cross-check still needs your export (see "Before you deploy").

## Before / after

### Indexable URLs and own content

| Page type | Indexable before | after | Median unique words* before | after | % sentences templated before | after |
|---|---|---|---|---|---|---|
| Venue | 1,421 | **621** | 25 | 23 | 96.0 | 91.8 |
| City hub | 187 | **78** | 121 | **253** | 83.2 | **69.4** |
| Hub page 2+ | 12 | 11 | 537 | 519 | 39.5 | 34.0 |
| Filter (toddler / parties / SEN) | 245 | **34** | 26 | **101** | 92.6 | **67.9** |
| London area hubs | 5 | 5 | 184 | 184 | 40.6 | 40.6 |
| Blog | 32 | 32 | 571 | 571 | 46.2 | 43.4 |
| Category hubs, home, index pages, static | 17 | 17 | – | – | ~0 | ~0 |
| **Total** | **1,918** | **797** | | | | |

\* Words in sentences whose template (names, places and numbers tokenised) is on fewer than 5
pages of the same type.

**Sitemap:** venues 1,802 → 621 (it now matches the noindex rule, and the static-fallback
listing of noindex venues is fixed), hubs 187 → 78, filter pages 242 → 34.

**Venue pages are half the length** (median main text 588 → 234 words), because the
boilerplate is gone:
- the four "not confirmed" FAQs and the "not yet confirmed" checklist;
- the empty facilities and pricing cards and the "No photos yet" box;
- two of the three claim pitches, and the in-page newsletter;
- the review form labels and a duplicate set of call/website/directions buttons;
- the rating, previously stated three times.

Their template percentage is still high (92%) for an honest reason: what's left is
structured data with labels (quick facts, an hours table, the 20 nearest venues with
distances), and the metric tokenises venue names away. **Venue pages will only get
substantially richer as facts arrive through the enrichment queue (D).** Inventing
varied prose would be exactly the "scaled content" pattern the policy targets.

### Boilerplate (step 2 measure)

| Content (indexable pages) | Documents before | after | Sentences from shared templates before | after | Distinct whole-document patterns before | after |
|---|---|---|---|---|---|---|
| Venue About text (rendered) | 1,421 | 621 | 55.2% (incl. generator filler and paraphrased reviews) | one plain sentence per confirmed fact; researched text (83 venues) unchanged | – | – |
| Hub intros | 174 | 65 | 82.7% | 63.1% | 165 | 63 |
| Hub FAQs | 187 | 78 | 90.4% | 82.2% | 159 | 71 |
| Filter intros / tips | 75 | 0 tips blocks (replaced by data sections) | 100% | – | 1 | – |
| Filter FAQs | 245 | 34 | 100% | 89.3% (shared question frames; answers name each page's own venues) | **6** | **32** |

### Data quality

| | Before | After (static export; DB after you run phase18-01) |
|---|---|---|
| Records in the export | 1,802 | 1,395 |
| Off-category records live (playground, hire, retail) | 381 | **0** (410 Gone) |
| Hand-reviewed off-category typed as soft play | 89 flagged | 22 retired, 38 reclassified, 1 merged, 28 kept as genuine soft play |
| Duplicate listings | 4 same-site pairs | 0 (merged, 301) |
| Blank addresses | 257 | 118 (no source to fill them; the page now hides blank address/Maps) |
| Broken Maps link | 5 | 4 (Maps card now hidden for these) |
| Junk values (`nan`, placeholder "photos") | 16 `nan` photos, 228 Google placeholder icons, 26 `https://nan` websites | 0 |
| Venue counts disagreeing on a hub page | 10 hubs | 0 (guide teasers no longer hard-code a count) |
| Hub intros contradicting their own FAQ | 156 hubs | 0 (contradicted sentences dropped at render) |

### Fill rates (soft play venues)

Nothing new was scraped in this session, so fill rates barely move. They will change as the
review queue is worked through.

| Field | Before | After |
|---|---|---|
| Age range | 0% (not in the export) | 0% in export; DB has it for some venues, now exported |
| Price | 12.6% | 13.0% |
| Café | 27.5% | 28.0% |
| Toddler area | 10.7% | 11.0% |
| Party | 25.7% | 26.7% |
| SEN sessions | 5.1% | 5.2% |
| Photo | 68.4% | 52.4% (placeholder icons no longer counted as photos) |

## 20 URLs to spot-check (after deploying)

Checked on the local build (status · robots · what the page says):

**Pruned (5)**
1. `/soft-play/aberdeen/cornhill-play-ground-aberdeen`: **410** "listing removed" (outdoor playground)
2. `/soft-play/aldridge`: **308 → /soft-play/walsall**, which lists Aldridge under "Soft play near Walsall"
3. `/soft-play/bedford`: **308 → /soft-play/hitchin** (24 km; check you're happy with merges this far)
4. `/soft-play/aberaeron`: 200, **noindex** (1 venue, no indexable hub within 25 km)
5. `/soft-play/aberaeron/the-moody-calf-play-barn`: 200, **noindex** (no verified fact yet): "…is a soft play centre at Bargoed Farm in Aberaeron."

**Venue pages with new descriptions (5)**
6. `/soft-play/ipswich/world-of-play`: "…in Ipswich. It runs sessions for children with SEN."
7. `/soft-play/birmingham/the-soft-play-caf-birmingham`: "…on Pershore Rd in Birmingham. It has a café."
8. `/soft-play/bolton/poachers-wacky-warehouse-bolton-preston`: "…on Lostock Ln in Bolton. It has a café and wheelchair access."
9. `/soft-play/cardiff/jump-cardiff`: now a **trampoline park**: "Jump Cardiff is a trampoline park at Parc Ty Glas in Cardiff."
10. `/soft-play/corby/cheeky-monkees`: researched description shown as written

**Filter pages (5)**
11. `/soft-play/brighton/toddler`: prices held, best rated, café
12. `/soft-play/manchester/birthday-parties`: party rooms, cafés, best rated
13. `/soft-play/bournemouth/birthday-parties`: lists "Soft Play Party Hire" (a hire firm typed as soft play: in the off-category **review** tier, needs your decision)
14. `/soft-play/york/sen-friendly`: wheelchair access, cafés; includes "Burnholme Sports Centre" (also review tier)
15. `/soft-play/hastings/birthday-parties`: party rooms, cafés, parking

**City hubs (5)**
16. `/soft-play/birmingham`
17. `/soft-play/walsall`: merged hubs listed in its Nearby section
18. `/soft-play/romsey`: now 200 indexable with the merged Romsey Rapids record
19. `/soft-play/plymouth`: intro still generic ("brilliant way to spend a few hours…"): **GSC prompts 3–4 territory**
20. `/soft-play/bournemouth`

## Before you deploy, and what you run yourself

The DB isn't reachable from this container, so these are yours, in this order:

1. **GSC cross-check of the 410s** (the committed `data/gone.json` was written without GSC data):
   `node scripts/migrations/phase18-01-adsense-cleanup.mjs --write-files --gsc=seo-data/gsc-2026-11-24/perf/Pages.csv`
   Retired URLs (and older URLs that 301ed to them) with any clicks become 301s to their hub. Commit the changed `data/gone.json` and `data/redirects.json`.
   Also run `python3 scripts/seo/adsense/pruning.py --gsc=…` and look at hubs or filter pages that earned clicks and are now noindexed.
2. **Deploy** this branch.
3. `node scripts/migrations/phase18-01-adsense-cleanup.mjs` (dry run: read the HELD and Skipped lists), then `--execute`. A backup is written to `scripts/output/backups/`; undo with `--rollback=<file>`.
4. `node scripts/migrations/phase18-02-enrichment-schema.mjs`, then `--execute` (adds columns and tables, marks the 83 researched descriptions). Undo: `--rollback --execute`.
5. `npm run data:rebuild` (needs step 4: it now selects the new columns), then commit the regenerated `data/generated/*`.
6. Enrichment, at your pace: `npm run enrich:facts -- --limit=100 --write-db`, then
   `npm run enrich:review -- export`, fill the decision column, then
   `npm run enrich:review -- apply --file=seo-data/enrichment/review.csv --by=<you> --execute`, then `npm run data:rebuild`.
7. Decide the **off-category review tier** (114 venues, `seo-data/adsense/off-category-candidates.csv`, tier `review`) and add any removals to `scripts/migrations/phase18-01-data.json`.
8. Trust pages and consent: `docs/drafts/` (About, methodology, corrections, ads-and-consent checklist). A CMP and a privacy-policy advertising section are needed before UK ads can serve.

Then wait 2–3 months before reapplying, as you planned.

## Every changed file

**Indexing rules (B)**
- `lib/indexing.ts` (new): thresholds and rules for venues, hubs (merge / noindex) and filters
- `app/sitemap.ts`: lists only what pages index; static-fallback bug fixed
- `app/soft-play/[city]/page.tsx`: hub noindex/merge, merged hubs' venues in Nearby, category links only to indexable pages, contradicted intro sentences dropped (E), body newsletter removed (F)
- `app/soft-play/[city]/[slug]/page.tsx`: new robots rule; links to the merged hub; fact-built About text and FAQs; Last verified and owner link; boilerplate blocks removed (C/F)
- `components/filter/FilterPageContent.tsx`: filter noindex rule, nearby links only to indexable pages, data intro/details/FAQs (E)
- `components/category/CategoryHubPage.tsx`, `app/soft-play/page.tsx`, `components/location/NearbyTowns.tsx`, `lib/nearestVenues.ts`, `lib/venueContent.ts` (old score rule removed), `lib/hubGuides.ts` (old filter threshold removed)

**Clean-up (A)**
- `scripts/migrations/phase18-01-adsense-cleanup.mjs` + `phase18-01-data.json` (new)
- `data/gone.json` (new), `data/redirects.json`, `data/generated/{venues,venuesByTown,towns}.json`
- `lib/redirects.ts` (`goneFor`), `proxy.ts` (410)
- `scripts/rebuild-static-json.mjs`: no junk resurrection; exports ages, description_source, has_soft_play
- `lib/blogPosts.ts`, `lib/hubGuides.ts`: links to retired listings unlinked; teaser counts removed

**Descriptions (C)**
- `lib/venueSummary.ts` (new), `lib/staticVenues.ts`, `components/venue/ReviewSection.tsx`, `components/venue/VenueMap.tsx`

**Enrichment (D)**
- `scripts/migrations/phase18-02-enrichment-schema.mjs` + `phase18-02-researched-descriptions.json` (new)
- `scripts/enrichment/{extract,scrape-venue-facts,review-queue}.mjs` (new), `package.json` (`enrich:facts`, `enrich:review`), `scripts/scrape-venue-websites.mjs` (deprecation note)

**Filter pages and intros (E)**
- `lib/filterIntro.ts`, `lib/introClaims.ts` (new)

**Templates (F)**
- `app/page.tsx`, `components/layout/Footer.tsx`, `app/blog/[slug]/page.tsx`, `components/search/SearchResults.tsx`, `app/newsletter/page.tsx`, `app/newsletter/[slug]/page.tsx`

**Trust (G):** `docs/drafts/{about,methodology,corrections,ads-and-consent}.md` (new, not published)

**Audit and verification (H):** `scripts/seo/adsense/*` (crawler and analysis), `reports/adsense-phase1-audit.md`, this report, `.gitignore`

**Tests:** new: `scripts/{indexing,adsense-cleanup,venue-summary,filter-intro,enrichment-extract}.test.mjs`. Updated: `scripts/{city-reassignment,slugs,hub-guides,nearest-venues,copy}.test.mjs`. 180 pass.
