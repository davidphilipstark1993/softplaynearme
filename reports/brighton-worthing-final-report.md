# Worthing & Brighton SEO push: final report

Nothing here is committed, deployed or applied to the database. The three DB scripts have **not** been run; as agreed, only you run them. Their default mode is a dry run.

## 1. Run order
1. `node scripts/migrations/phase8-01-clean-brighton-worthing.mjs` (dry run: read the output, check the 54 rows)
2. `... phase8-01-clean-brighton-worthing.mjs --execute` (writes a backup to `scripts/output/backups/` first)
3. `node scripts/migrations/phase8-02-verified-facts-brighton-worthing.mjs` then `--execute`
4. `node scripts/migrations/phase8-03-venue-descriptions-brighton-worthing.mjs` then `--execute`
4b. `node scripts/migrations/phase8-04-reclassify-role-play.mjs` then `--execute` (Little Play Village and Little Street become `family-attraction`)
5. `npm run data:rebuild`
6. `node --test scripts/*.test.mjs` (4 tests fail at HEAD; they depend on the rebuilt static JSON and should clear)
7. Commit, deploy
8. Spot-check (section 5), then request indexing (section 6)

Rollback for each script: `--rollback=<backup file>`.
Expected end state after step 2: Brighton active = 12 venues (ids 900, 1458, 886, 914, 791, 792, 897, 903, 908, 919, 1622, 1449); Worthing active = 7 (881, 901, 894, 874, 866, 899, 907). The script asserts this before committing.

## 2. Files changed
**DB scripts (new):** `scripts/migrations/phase8-01-clean-brighton-worthing.mjs` (9 moves, 45 retirements with 301s), `phase8-02-verified-facts-brighton-worthing.mjs` (only-true flags and empty age ranges, with sources), `phase8-03-venue-descriptions-brighton-worthing.mjs` (descriptions for 18 venues from venue-site facts).
**Data/config:** `data/postcode-localities.json` (Brighton and Worthing hubs, nearby towns, overrides), `scripts/discover-google-places-venues.mjs` (catchment guard stops the city-stamping bug), `reports/brighton-worthing-phase0.csv`.
**Pages/components:** `app/soft-play/page.tsx` (new `/soft-play` index; previously 404), `app/soft-play/[city]/page.tsx`, `app/soft-play/[city]/[slug]/page.tsx`, `components/location/{HubGuide,NearTown,VenueComparisonTable}.tsx`, `components/filter/FilterPageContent.tsx`, `app/sitemap.ts`, `app/page.tsx`, `app/blog/[slug]/page.tsx`.
**Content:** `lib/hubGuides.ts` (new), `lib/blogPostsSussex.ts` (new; 6 posts), `lib/blogPosts.ts`.
**Not mine:** `.claude/` is untracked and unrelated.

## 3. Redirect map
`phase8-01` appends the redirects to `data/redirects.json` when you `--execute`; its dry run prints every rule. Principles: every retired URL is a 301, never a 404; no chains or self-redirects; older rules are re-pointed; rules that would shadow a live page are dropped. Examples: the-hub-peacehaven goes to `/soft-play/brighton`; the Sharky's duplicate goes to `/soft-play/brighton/sharkys`; missionfiit goes to `/soft-play/hastings/kidzone-at-missionfiit-hailsham`; id 904 goes to `/soft-play/worthing/harbour-park-indoor-soft-play`; id 1892 goes to `/soft-play/worthing/space-station-soft-play-ltd`. Moved venues (Little Play Village, Lighthouse, Hope Hive) also get 301s from their old `/soft-play/brighton/...` URLs to the new `/soft-play/worthing/...` URLs.

## 4. What changed for users and search engines
- Brighton and Worthing hubs now contain only venues that are really there; others are labelled "nearby" or moved to the right hub.
- Hubs have answer-first copy, comparison table, verified guide, FAQs (max 7), last-updated date, nearby hubs, a "Soft play near Peacehaven" section, and consistent counts everywhere.
- Venue pages for these hubs have Home › Soft Play › City breadcrumbs and a "nearest venues" block with real distances.
- Thin category pages (under 2 venues) are noindexed and out of the sitemap.
- Six blog posts (one trampoline post is noindexed until a park is verified open), linked from the hubs.
- Sitemap, homepage links, schema and `llms.txt` updated.

## 5. Spot checks after deploy
| Check | How |
|---|---|
| Counts match | Title count on `/soft-play/brighton` equals the number of venues in the comparison table and the homepage/`llms.txt` figure |
| Redirects | `curl -sI https://www.softplaynearme.co.uk/soft-play/brighton/the-hub-peacehaven` returns 301 to `/soft-play/brighton`, then 200 |
| Moved venues | `/soft-play/brighton/hope-hive` 301 to `/soft-play/worthing/hope-hive` |
| noindex | `curl -s .../soft-play/brighton/sen-friendly \| grep robots` shows noindex; same for the trampoline post |
| Sitemap | contains `/soft-play`, both hubs and five new posts; none of the retired or noindexed URLs |
| Schema | Rich Results Test on both hubs and one venue and one post |
| Peacehaven | the section on `/soft-play/brighton` says no soft play centre is listed in Peacehaven itself |
| Tests | rerun the test suite after `data:rebuild` |

## 6. Re-indexing (Search Console, URL Inspection, in this order)
1. `/soft-play/brighton`
2. `/soft-play/worthing`
3. `/soft-play`
4. `/blog/best-soft-play-in-brighton`, `/blog/best-soft-play-in-worthing`
5. The other four posts (`kids-party-venues-in-worthing`, `baby-and-toddler-soft-play-in-brighton-and-worthing`, `rainy-day-things-to-do-with-kids-in-brighton`) and a handful of moved venue pages
Resubmit the sitemap. Expect a few weeks of movement; the Peacehaven pages in particular will wobble.

## 7. Not verified or deliberately left out
- Prices, parking and opening hours: not shown anywhere unless a venue publishes them.
- Funplex, Playcafe, FunPlay Leisure, Palace Play, Hope Hive: their sites were blocked, empty or gave nothing readable, so no facility, age or party claims are made for them.
- Jumpzone and One Under Brighton: unverified trampoline candidates, not listed.
- Play Dreams Soft Play (unplaceable), Little Lions (monthly pop-up), WRAP Play (party hire only), Beechwood Hall (soft play unverified): retired or not shown as soft play.
- No map: no map library is installed; a lazy-loaded Leaflet map is a possible follow-up.
- Page weight not measured in production; run PageSpeed on the deployed hub.
- The accordion "last answer detaches" bug: no accordion exists in the code and I could not reproduce it. I need the page where you see it.

## 8. Decisions made after the first draft
- **Little Play Village (901) and Little Street (902)** are reclassified as `family-attraction` by `phase8-04`. They leave the soft play counts and "highest rated" sentence but stay visitable under "Other family activities". Worthing's main list is then 6 soft play centres.
- **Bognor Regis and Chichester get their own hubs** (`data/cities.json`, `data/cities-basic.json`), not Portsmouth. `phase8-01` now moves Shweet Soft Play (Barnham) and Puppet Castle & Softplay to `/soft-play/bognor-regis`, and Little Street to `/soft-play/chichester`; the old URLs 301 to them. Chichester has no conventional soft play of its own, so that hub is noindexed (and out of the sitemap) until one is added. Bognor Regis has 2 venues, one with only 2 reviews, so it is thin but honest.

## 9. Decisions still yours
- Bognor Regis and Chichester have no editorial guide yet; add one only from verified venue-site facts.
- Optional: `GOOGLE_PLACES_API_KEY=... node scripts/fetch-google-ratings.mjs --city brighton --dry-run` to fill missing opening hours.
