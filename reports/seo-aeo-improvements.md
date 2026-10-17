# SEO / AEO improvements — branch `seo-aeo-improvements`

One commit per task (`git log --oneline main..seo-aeo-improvements`). Everything below was
checked against a production build (`npm run build`), a local `next start`, and the test suite
(`npm test`, 45 tests). **I had no database access**, so every check ran against the static
export in `data/generated/` — see "Read this first".

## Read this first

1. **The database is the source of truth; the JSON export was stale.** Production hub pages
   render from the live DB, the homepage is prerendered from the JSON. The Hull 37-vs-33 split
   was exactly that: phase 6-01 removed 4 Hull venues from the DB and the JSON was never
   re-exported. I replayed phase 6-01 onto the JSON (`phase6-02`) and fixed the export script,
   but if the DB has changed in other ways since the last export, run
   `DATABASE_URL=… npm run data:rebuild` and re-run the scripts below with `--db`.
2. **Two changes need to be applied to the production database** (the repo side is done):
   - Slugs: `node scripts/migrations/phase7-01-dedupe-city-in-slugs.mjs --execute --db`
     (dry-run without flags first). Until it runs, the new URLs render from the static JSON
     (works, but without DB-only data such as on-site reviews) and old URLs still resolve in
     the DB. Run it as part of the deploy.
   - Nothing else writes to the DB.
3. The hub pages look different: **Hull now says 20 venues, not 33.** 13 venues in Hessle,
   Cottingham, Anlaby, Hedon, Brough, Beverley, Hornsea and Withernsea moved to a "Soft play
   near Hull" section on the same page (their URLs did not change). That is the "nearby, not
   duplicated in the main list" rule you asked for; say if you'd rather they stay in the count.

## What changed, by task

| # | Task | Result |
|---|------|--------|
| 1 | Counts agree | One module (`lib/venueCounts.ts`) computes every count: homepage hero, location cards, trust stat, hub heading, quick facts, meta, FAQ, intro, sitemap pages, `/llms.txt`. Old numbers: homepage Hull 37 (stale JSON incl. a test venue and 3 non-soft-play venues), Hull page 33 (live DB), "1,077+" (JSON) vs "1,800+" (hardcoded in the root layout, counted every venue type). Now 1,073 total, Hull 33 → 20 + 13 nearby. Homepage revalidates hourly so it can't drift again. |
| 2 | Promises vs data | Price coverage is **0.4%** (4 of 1,073 venues; Hull 1 of 20) and there is no age-range field in the export, so "Prices & Ages" is gone from every title/description. Claims (Prices, Ages, Hours, Reviews) are now generated per city and only appear when ≥50% of its venues have the data — they return automatically as coverage grows. Cards show today's hours / age range / starting price (with "verified <date>") when held, and "Hours not available" when not. "Open Now" hides itself when a city has no structured hours, the page says "Opening hours not available yet" instead of an empty list, and the static fallback no longer lists every venue as open. Open-now comparisons now use UK time (they used the server's UTC clock). |
| 3 | Location accuracy | Each venue has a home town (`data/postcode-localities.json`, `lib/localities.ts`): Our Imagination Station is Hessle (HU13) in its H1, title, schema `addressLocality`. Hull's catchment towns go in a separate section grouped by town, linking to a hub where one exists. The three Lincolnshire venues (FunForest Brigg, Magical Castle Cleethorpes, Time 4 Play Grimsby) are out of the Hull copy. `scripts/check-location-mismatches.mjs` → `reports/location-mismatches.csv`. |
| 4 | Duplicates | `scripts/find-duplicate-venues.mjs` → `reports/duplicate-candidates.csv` (78 pairs: 30 HIGH, 48 MEDIUM). Active+ Hull / Little Monkeys @ Active+ is HIGH (same site, 14 m apart, both 222 reviews). Nothing merged. |
| 5 | Slugs | One generator (`scripts/lib/venue-slug.mjs`) used by every importer; new slugs never contain the city. 116 existing slugs where the city repeated were rewritten (`ping-pong-tots-hull-hull` → `ping-pong-tots`), each with a 301; 219 existing redirect chains flattened; 20 blog links updated; sitemap lists only the new URLs. List: `reports/slug-changes.csv`. |
| 6 | Copy cleanup | `scripts/find-leaked-notes.mjs` → `reports/leaked-notes.csv`. All editor notes fixed (0 remain; a test enforces it); 25 filler "check the venue" lines and 9 "in our data" disclosures are reported but left (see below). City pages: newsletter blocks 3 → 2; filter sidebar rendered once instead of twice. |
| 7 | Pagination & filters | Page 2+ of a hub is indexable with a self-referencing canonical, numbered crawlable links and a sitemap entry (it used to be noindex → page 1). Filter/search/sort variants are `noindex, follow`. Path filters (`/toddler`, `/birthday-parties`, `/sen-friendly`) stay indexable with unique per-city titles, descriptions and intros. `/search` with any parameter is `noindex, follow`; the old `?filters=` links now actually filter. |
| 8 | City content & FAQ | Hero summary and a 5–6 question FAQ are built from each hub's data (counts, best-rated with ≥20 reviews, dated price range if any). "Top rated" needs 20 reviews (was 5) and the list's rating sort is smoothed so a 5.0 from 2 reviews can't sit above a 4.6 from 300. The old FAQ pool's invented figures (£4–£8 per child, parties £10–£15, "open 9–10am, close 5–6pm", "most venues offer free parking") were removed. |
| 9 | Schema | See below. |
| 10 | Crawlers & AI | robots.txt names the 8 crawlers you listed (+ Claude-User, Perplexity-User) and keeps the `Sitemap:` line; sitemap has real `lastmod`s; `/llms.txt` added. |

### Schema (task 9)
Existing and kept: Organization + WebSite/SearchAction (sitewide), BreadcrumbList, FAQPage,
ItemList, CollectionPage on hubs, EntertainmentBusiness on venues. Fixed:
- AggregateRating on venue pages only from reviews left on this site. The Google rating in the
  page header stays visible but is no longer in the JSON-LD (Google's review-snippet rules
  forbid marking up another site's ratings).
- Removed `publisher` from the business (invalid there), made `geo` numeric, `addressLocality` = home town.
- City ItemList: position + name + url per venue; per-item ratings removed; positions continue across pages.
- Breadcrumb without a URL on a non-final crumb (county) removed from schema and page.
- Organization logo is the real logo file, not the social card.
- `<meta name="keywords">` removed. "Updated daily/regularly" removed (nothing updates daily).
- **Not done: the empty `<meta name="next-size-adjust">`.** Next.js emits it for any page using
  `next/font` (with Turbopack it's decided by font file names; `adjustFontFallback: false` is
  ignored; patching the build only reaches server-rendered pages, not prerendered ones). It's
  harmless and nothing reads it. Dropping `next/font/google` for a self-hosted `@font-face` would
  remove it — a performance/design decision, so I left it.

## CSVs (regenerate any time; none change data)

| File | Rows | Command |
|------|------|---------|
| `reports/location-mismatches.csv` | 144: 8 `different_county` (high), 1 district-level `area_mismatch` (high), 57 area-level `area_mismatch` (medium, to review), 13 `nearby_town`, 65 `no_postcode` | `node scripts/check-location-mismatches.mjs [--db]` |
| `reports/duplicate-candidates.csv` | 78 pairs (68 in the same hub) | `node scripts/find-duplicate-venues.mjs [--db] [--min=LOW]` |
| `reports/leaked-notes.csv` | 34 (25 filler CTAs, 9 data disclosures, 0 editor notes) | `node scripts/find-leaked-notes.mjs` |
| `reports/slug-changes.csv` | 116 changed slugs with old/new URL | written by the phase 7-01 migration |

Highlights worth a look in the location CSV: 8 Lincolnshire/Notts/East Riding venues filed under
**Doncaster** (Brigg, Scunthorpe ×3, Cleethorpes, Grimsby, Retford, Goole). **Scunthorpe has exactly
3 venues → by your 3-venue rule it qualifies for its own hub**; I did not create it because it needs a
DB reassignment of 3 venues. Southampton (`SO`) venues in the Portsmouth hub are *not* told to move
to Southend — `_geo.mjs` maps `SO` to `southend`, a known collision.

## Decisions I made that you may want to reverse

- **Slug scope.** Only slugs where the city is *repeated* (116) were rewritten. A single trailing
  `-hull` (e.g. `big-fun-hull`) is on ~1,200 more URLs; `--scope=all` rewrites those too. It's a cosmetic
  gain for a lot of URL churn, so it's opt-in. New venues never get a city suffix either way.
- **Redirect status.** `next.config.ts` now emits explicit 301s (Next's `permanent: true` is a 308).
- **Hull curated list.** The three Lincolnshire entries were removed from "Near Hull / East Yorkshire".
- **Hand-written FAQs** in `data/cities.json` are no longer displayed (the visible FAQ is data-built).
  The text is still in the file if you want to re-add any.
- **Filter-page scope.** Filter pages now use the same venue-type scope as the hub (genuine soft play),
  so "5 toddler venues" matches the hub.
- **Sitemap.** Thin (`noindex`) venues and filter pages with zero matches stay out; 45 venues without any
  verified date have no `lastmod` rather than a made-up one.
- **Data I could not fix:** generated venue descriptions say "a soft play centre in Hull" for venues that are
  actually in Hessle, etc.; they live in the data and need regenerating (`scripts/enrich-seo-all.mjs`).
  Two existing redirect rules point from pages the JSON still lists (`brighton/kidzone-at-missionfiit-hailsham`,
  `york/flying-legends-wacky-warehouse-york`) — merged duplicates in the DB, stale in the export.

## `TODO(owner)` — everything that needs your input

1. `app/page.tsx` — homepage "How much does soft play cost?" quotes no price range because the data can't
   support one. Supply a sourced typical range *and its date* if you want one.
2. `lib/cityContent.ts` — each hub's cost FAQ quotes only the prices venues publish; same decision, per city.
3. `app/llms.txt/route.ts` — check the "Where the data comes from" paragraph describes how you really verify venues.

Also for your call (not marked in code): create a Scunthorpe hub; the two stale redirect rules above;
which hand-written city FAQs, if any, to re-add; whether to opt into `--scope=all`.

## Post-deploy checks

1. **Database:** `node scripts/migrations/phase7-01-dedupe-city-in-slugs.mjs --execute --db` (dry-run first).
2. **Rich Results Test** (https://search.google.com/test/rich-results) on `/soft-play/hull` and a venue page,
   e.g. `/soft-play/hull/our-imagination-station-hull`. Expect: Breadcrumbs, FAQ and Local business/Organization
   valid; the hub page has an ItemList. Locally the same checks run with
   `node scripts/validate-jsonld.mjs --base=https://www.softplaynearme.co.uk / /soft-play/hull /soft-play/hull/our-imagination-station-hull`.
3. **Slug redirects:** `curl -sI https://www.softplaynearme.co.uk/soft-play/hull/ping-pong-tots-hull-hull`
   → `301` to `/soft-play/hull/ping-pong-tots` (200); same for `monkey-bizness-hull-hull`; spot-check 3–4 more
   from `reports/slug-changes.csv`; confirm no redirect chains (`curl -sIL` shows one hop).
4. **Sitemap:** open `/sitemap.xml` (2,000 URLs; hubs, `?page=N`, filters, venues, blog all have `lastmod`),
   then resubmit it in Search Console; fetch `/robots.txt` and `/llms.txt`.
5. **Counts:** homepage Hull card, Hull heading and the Hull title agree (20); homepage total equals the
   `/llms.txt` total.
6. Search Console → Pages: watch "Duplicate, Google chose different canonical" and "Excluded by noindex" over
   the next weeks — the paginated hub pages and path filters are now meant to be indexed; `/search?…` should drop out.
