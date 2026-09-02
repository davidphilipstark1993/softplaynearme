# SEO Audit & Stage 3 Report — softplaynearme.co.uk

**Date:** 19–20 August 2026
**Scope:** Full-site technical SEO, indexability, content-quality and AI-search audit, per the 10-phase brief. This report supersedes nothing in `AUDIT.md` (31 Jul) or `reports/` — it verifies what's changed since, and documents the Stage 3 fixes applied today.
**Companion reading:** `AUDIT.md`, `reports/data-quality-audit.md`, `reports/thin-content-audit.md`, `reports/phase4-geo-followup.md` — this report doesn't repeat their detail, only their current status.

---

## Executive summary

This is a mature codebase with an active SEO-fix history, not a green-field site. Three prior audits (23 Jul – 17 Aug) and a five-phase data migration pipeline (`scripts/migrations/phase2` through `phase5`) already fixed the majority of what a first-pass technical audit would find: soft-404s, stranded city data, blog pages missing nav, duplicate blog slugs, wrong-city venues, non-soft-play venues polluting the main directory, and more. That work is verified still in place today (Part A below).

Two things were new since the last audit and are the substance of today's work:

1. **A content-generation script (`scripts/enrich-seo-all.mjs`) filled in every venue's missing description since July (64% missing → 0% missing) — but the templates had two live bugs**: a capitalization bug affecting new/unrated venues and spliced review quotes, and no validation against truncated review snippets. Found in **61 live venues**, fixed today — both the static data and the script's root cause.
2. **A much larger, newly-discovered issue, now fixed**: 366 of 410 "Playground" venues (real, outdoor, public park playgrounds — correctly excluded from the main soft-play directory by `lib/venueTypes.ts`) had descriptions that called them a "soft play centre" with "indoor" facilities. This was a factual mismatch, not a phrasing nitpick. Fixed at the source in the generator script and regenerated for all 410 affected venues (see Critical Issues, #1).

Nothing else found on the 19th rose to "critical" — the technical SEO foundation (robots.txt, sitemap, canonicals, structured data, redirects, filter-page noindex logic, venue classification, claim/verification system) is already well-built and correctly reasoned, with code comments explaining the *why* behind each decision.

**20 August — blog rewrite started.** You picked Nottingham, London, and Hull as the first three cities. Hull was already at the target quality bar (checked against current data, 8/9 named venues still live — left untouched). Nottingham and London were both in the "generic template, real data unused" bucket and have been rewritten with real, fact-checked venue data — see Part D below.

---

## Critical issues (ranked)

### CRITICAL — fixed 20 Aug
- ~~**366 "Playground" venue descriptions misdescribe outdoor public playgrounds as indoor soft play centres.**~~ **Done.** Regenerated all 410 Playground/`park-playground` venues (366 that said "indoor," plus 44 more that said "soft play centre" without the word "indoor" — same underlying mismatch, caught by widening the check) using the new outdoor-aware templates. Two bugs surfaced and fixed during the run itself, both now also fixed at the source in `scripts/enrich-seo-all.mjs`: (1) the "vs." abbreviation false-triggering the capitalization fix (found in 33 venues on the first pass), (2) two of the shared P3 "practical tips" templates had "soft play venue(s)" baked into their fixed text, reading oddly on a public playground (187 venues on the first pass). Re-verified after both fixes: 0 remaining `indoor`/`soft play venue`/`vs. [A-Z]` matches across all 410, 0 broken-grammar fragments sitewide, exactly 410 venues touched (only `description`), `venuesByTown.json` back in sync, confirmed on a live dev-server render.

### HIGH — 3 of 21 done, 18 remain
- ~~**Blog city-guide rewrite backlog**~~ **In progress.** Nottingham and London rewritten 20 Aug with real venue data (Hull was already good, left untouched). 18 posts remain in the same state: indexed, generic-template, naming zero real venues despite having 11–94 real venues on file each — bournemouth, brighton, cardiff, colchester, hastings, ipswich, norwich, portsmouth, southend, swansea, huddersfield, edinburgh, glasgow, aberdeen, inverness, leicester, blackpool, york. Matches `reports/thin-content-audit.md` §2's original finding. Your call on which to do next.
- **Missing price data**: `priceFrom` is 100% absent on 1,809/1,814 venues. Can't be invented; needs real enrichment (`scripts/enrich-venues.mjs` exists) or a decision not to display pricing.
- **New-venue data gaps**: the ~762 venues added since July (1,052 → 1,814) have ~51% missing phone/website/hours vs. ~10% on the original batch — an enrichment-pipeline gap, not a code bug.

### MEDIUM
- 5 "needs approval" items parked in `reports/phase4-geo-followup.md` (17 Aug): 54 "no hub nearby" venues, 128 boundary-distance cases, Southend/Southampton naming collision, 6 remaining likely-duplicate groups. Explicitly flagged by that report as judgment calls, not bugs.
- City-page vs. blog-guide cannibalisation (`AUDIT.md` P1) — both target "best soft play in X" for the same city. Needs a canonical-intent decision before touching titles/H1s.

### LOW
- Cosmetic slug staleness (~40 venues whose URL slug still carries an old city suffix after being correctly reassigned — `city_slug`, which drives routing/schema, is correct; only the slug text is stale). Purely cosmetic, needs a slug rename + redirect per venue to clean up — not urgent.

---

## Changes made this session

| File | Change |
|---|---|
| `data/redirects.json` | Removed 2 rules that were 301-redirecting a *currently live* venue's own canonical URL to a nonexistent page (Oxygen York, Clip n Climb York). Repointed 13 more rules whose destinations had gone stale after later re-reassignment, to their correct current URL. Verified: 0 remaining broken rules, no self-redirects. |
| `data/generated/venues.json`, `data/generated/venuesByTown.json` | Fixed 61 venue descriptions with broken grammar: 54 capitalization fixes (lowercase sentence-starts from an empty `repStr`/spliced review quote), 4 truncated review-snippet paragraphs removed entirely (dangling mid-clause fragments — e.g. "...allows perfect views while."), 3 venues with a stray trailing period in the name ("Funplex.") cleaned from every description occurrence. Verified: exactly 61 venues touched, only `description`/`name` fields changed, both files stay in sync, 0 remaining instances of the bug pattern, confirmed on a live dev-server render. |
| `scripts/enrich-seo-all.mjs` | Root-cause fixes so future re-runs don't reproduce the above: `capitalizeSentenceStarts()` post-processing pass (abbreviation-aware, so "vs." doesn't false-trigger), `looksTruncated()` snippet validation (rejects dangling-word endings before they're used), leading-ellipsis stripping on scraped review snippets, trailing-period stripping on venue names before interpolation. Added `categoryLabel()` handling for `Playground`/park-playground categories (was falling through to "soft play centre"), a separate `P1_OUTDOOR_TEMPLATES`/`P2_OUTDOOR_TEMPLATES` pool gated by `isOutdoorPlayground()`, and a "soft play venue(s)" → generic-wording swap applied to the shared P3 pool for outdoor venues. |
| `data/generated/venues.json`, `data/generated/venuesByTown.json` (second pass) | Regenerated descriptions for all 410 outdoor-playground venues using the fixed logic above (applied via a Python port of the same template logic, run directly against the static export rather than the production DB — see Remaining Work). Verified: exactly 410 venues touched, only `description` changed, 0 remaining `indoor`/`soft play venue`/`vs. [A-Z]` matches, 0 broken-grammar fragments sitewide, both files in sync, live-rendered and confirmed. |
| `lib/blogPosts.ts` (20 Aug) | Rewrote `best-soft-play-in-nottingham` and `best-soft-play-in-london` from generic template prose to guides built on real venue data — names, ratings, review counts, addresses/areas, and confirmed facility flags (café, parties, toddler/baby area, SEN, wheelchair access, opening hours) pulled from `data/generated/venues.json`. Every factual claim (30 rating/review figures, 18 facility flags, 17 postcode-district claims, several opening-hours claims) was individually checked against the source data before publishing — one comparison error (which of two venues had more reviews) and one imprecise "biggest rating" claim (actually a 4-way tie) were caught and corrected in this process. Nottingham: 13 real venues named (was 0). London: structured by area (the city's too large for one ranked list) with 17 real venues named (was 0), plus an honest, data-checked observation that ~24% of London's soft-play venues are small "play café" format rather than big frame-based centres. Hull checked against current data (8/9 previously-named venues still live) and left as-is — already at the target quality bar. |

Verification performed: `npx tsc --noEmit` (clean), `npx eslint` on all touched files (clean), live dev-server render of fixed venue pages and both rewritten blog posts confirmed correct output, before/after diffs confirmed scoped to exactly the intended fields/venues/posts, post count in `lib/blogPosts.ts` unchanged (50 before and after).

Nothing else was changed. No venue facts, ratings, addresses, or names (other than the 3 stray-period cleanups) were altered.

---

## Pages/routes audited (status, not full detail — see `AUDIT.md` for the original walkthrough)

- `app/page.tsx` (homepage) — venue count now derives from real data, no more contradicting fallback strings.
- `app/soft-play/[city]/page.tsx`, `/[city]/[slug]/page.tsx` — real `notFound()`, no soft-404s, filter-param noindex logic confirmed correct.
- `app/soft-play/[city]/{toddler,sen-friendly,birthday-parties,open-now}/page.tsx` — stable, purpose-built landing routes (not raw query-param combinations), matching the brief's "only index a filter combination with genuine intent and content" guidance.
- `app/blog/page.tsx`, `/blog/[slug]/page.tsx` — Header/Footer present (internal linking restored), `notFound()` correct, noindex correctly applied per-post.
- `app/sitemap.ts` — excludes noindex venues below `SITEMAP_MIN_SCORE` (20, matches `NOINDEX_THRESHOLD`), builds from real DB/static data.
- `app/robots.ts` — correct disallow list, deliberately allows AI crawlers.
- `app/api/claims`, `app/admin/claims`, `/verify-email` — venue ownership/verification system already exists.
- `lib/schema.ts`, `components/layout/Breadcrumbs.tsx` — structured data and breadcrumbs present and previously verified valid.

---

## Indexation strategy

Already correctly implemented, not something this session changed:
- City hub pages: indexed by default; `noindex, follow` the moment any filter/search/age/facility/price/area query param is present.
- Purpose-built filter routes (`/toddler`, `/sen-friendly`, `/birthday-parties`, `/open-now`) are separate indexable pages with their own content, not query-param variants — the right call per the brief's programmatic-SEO guidance.
- Venue pages: `noindex` below completeness score 20.
- Blog posts: per-post `noindex` flag, correctly used for cities with no data or unfinished content.
- Not-found responses across all three dynamic route families: `noindex, nofollow`.

---

## Sitemap strategy

`app/sitemap.ts` already builds a single sitemap combining static pages, blog posts (noindex-filtered), city + filter pages, and DB/static venue pages (completeness-filtered). At current scale (~2,000 venues + city/filter pages) a single sitemap is still well under the 50,000-URL limit, so splitting into per-type sitemaps isn't necessary yet — worth revisiting only if venue count grows an order of magnitude.

---

## Schema strategy

`lib/schema.ts` emits `Organization`, `WebSite`+`SearchAction`, `BreadcrumbList`, `CollectionPage`, `ItemList`, `SportsActivityLocation`/`LocalBusiness`, and `Article` where appropriate, all sourced from real data — no fabricated ratings/prices, confirmed by `AUDIT.md`'s live-site check. `FAQPage` schema is present but no longer earns rich results post-Aug-2023 Google policy change; harmless, and plausibly useful for AI-answer-engine parsing per Phase 6 of the brief.

---

## Internal linking strategy

Blog↔city↔venue linking is functional (Header/Footer restored on blog routes; footer links all 42 cities). Known weak point, unchanged from `AUDIT.md`: the footer links every page to all cities including the ones with the thinnest content, since it isn't filtered by data quality — low priority, self-resolving as content fills in.

---

## Content strategy

- **Venue descriptions**: template-generated, now grammatically fixed for 61 venues; all 410 playground-category venues regenerated with outdoor-aware templates.
- **Blog guides**: distinct article types already exist in `lib/blogPosts.ts` per city. 3 of 21 backlog cities done (Hull was already good; Nottingham and London rewritten 20 Aug). 18 remain — bournemouth, brighton, cardiff, colchester, hastings, ipswich, norwich, portsmouth, southend, swansea, huddersfield, edinburgh, glasgow, aberdeen, inverness, leicester, blackpool, york — all indexed, all generic, all with real unused venue data. Your call on sequencing, not mass-generated.
- Templates (both the venue-description generator and the two rewritten blog posts) were checked against your banned-phrase list ("nestled in the heart of," "a haven for families," "whether you're looking for," "perfect for creating magical memories," "there's something for everyone," "look no further") — none appear.
- **Content-writing method established for the remaining 18**: pull real venues from `data/generated/venues.json` filtered to genuine soft-play `venueType`s, prefer ones with confirmed facility flags and real `openingHoursText` over just the highest review count (many high-review venues have the sparsest supplementary data), group by real differentiators (area/postcode, confirmed facilities, rating tier) rather than invented ones, and individually verify every factual claim against the source data before publishing — this caught 2 real errors in the Nottingham/London drafts before they shipped.

---

## Backlink strategy (practical, specific to this site)

- **Local family/parenting bloggers and "X Mumbler"/"X with Kids" sites** — the data already contains references to a few (e.g. "York Mumbler — York with Kids" appears as a venue-adjacent listing), suggesting real relationships in this space are reachable; a genuine directory listing pitch to these sites per major city is a natural, low-cost link source.
- **Local council/library "what's on" pages** — many UK councils maintain family-activity link lists; the "public park playground" data (once correctly labelled, see Critical #1) is itself a legitimate reason for councils to link back, since you'd be indexing public amenities they maintain.
- **Venue claim flow already exists** (`app/api/claims`) — claimed venues are a natural source of a reciprocal link from the venue's own website/socials once they're using their listing.

---

## Search Console plan (what to check weekly)

- **Indexed vs. not-indexed trend**, watching specifically for the "Discovered — currently not indexed" / "Crawled — currently not indexed" buckets — per your brief's explicit instruction, investigate before adding more pages if these grow.
- **New 404s** — should stay near-zero now that redirects are cleaned up; a new spike would indicate a fresh data-migration regression.
- **Blog post impressions/clicks** for the rewritten Leeds/Sheffield guides vs. their still-generic siblings — a real signal for whether the rewrite investment is worth extending to more cities.
- **Core Web Vitals** — not measured this session (would need a live Lighthouse/CrUX pass); flagging as unverified rather than claiming a result.

---

## Remaining work — what I did not do, and why

1. **Did not run the outdoor-playground fix, or the blog rewrites, against the production DB**, only the static JSON/TS the site actually builds from (`SOFTPLAY_STATIC_BUILD=1`). The live Neon DB still has the old venue descriptions underneath the static export — harmless while the build stays static-only, but worth a `node scripts/enrich-seo-all.mjs --commit` pass (filtered to playground venue_types) once DB compute quota allows, so the two don't drift. (Blog posts live only in `lib/blogPosts.ts`, not the DB, so no equivalent drift risk there.)
2. **Did not rewrite the remaining 18 backlog cities.** Nottingham, London, and Hull done per your instruction. The other 18 need the same city-by-city sequencing decision.
3. **Did not touch the 5 geo/duplicate judgment calls** parked in `phase4-geo-followup.md` — explicitly not bugs, explicitly parked for you.
4. **Did not invent price, phone, website, or hours data** for any venue — flagged the gap, didn't fill it. The Nottingham/London rewrites deliberately used only venues and facts we hold real data for, and said so explicitly where data was thin (e.g. accessibility info across London).
5. **Did not measure Core Web Vitals / performance** — no live measurement tooling run this session.
6. **Did not commit anything.** All changes above are in the working tree, unstaged/uncommitted, for your review.

## Next steps, in priority order
1. Review the Nottingham and London rewrites (`/blog/best-soft-play-in-nottingham`, `/blog/best-soft-play-in-london`) and confirm they read the way you want before more cities get the same treatment.
2. Pick the next 2–3 cities for the blog rewrite (Cardiff/42 venues, Glasgow/51, Edinburgh/22 are reasonable next candidates by data volume).
3. Decide on the venue-price-data enrichment budget/approach (API-driven `scripts/enrich-venues.mjs` vs. leaving it unset).
4. When DB compute quota allows, run `scripts/enrich-seo-all.mjs --commit` filtered to playground venues so the DB matches the static export's fixed descriptions.
5. When ready, commit today's changes — worth splitting into separate commits given the distinct concerns (redirects fix / 61-venue grammar fix / 410-venue outdoor-playground fix + script changes / Nottingham+London blog rewrite).
