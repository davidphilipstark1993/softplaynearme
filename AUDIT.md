# SEO & Health Audit — softplaynearme.co.uk

**Date:** 31 July 2026
**Repo state audited:** branch `blog-indexing-hygiene-and-sheffield` @ `29c18f0`, plus uncommitted changes to `lib/blogPosts.ts`
**Live site audited:** `https://www.softplaynearme.co.uk` (38 city pages, 12 static/blog/venue pages, sitemap, robots.txt fetched and parsed)

Priority key: **P0** = actively costing traffic or serving broken pages · **P1** = high · **P2** = medium · **P3** = low/polish

---

## Context that shapes everything below

Two facts explain most of the findings, so they're worth stating up front.

**1. The live site is running older code than this repo.** Six commits are unshipped. `origin/main` is at `5d0e4fa` (24 Jul); local `main` is one ahead, and the current branch adds five more. Evidence from the live HTML:

| Fix in repo | Commit | Live behaviour |
|---|---|---|
| Stop doubling the title suffix | `b2619d3` | Blog titles still render `… \| Soft Play Near Me \| Soft Play Near Me` |
| `noindex` on 25 unfit guides | `b2619d3` | `/blog/best-soft-play-in-dundee` serves `robots: index, follow` |
| Dedupe two blog slugs | `0c873d7` | Blog index renders 52 cards with York and Sheffield duplicated |
| Postcode backfill | `88bed7e` | Venue JSON-LD still emits `postalCode: ""` |

Sitemap `lastmod` on all 197 non-venue URLs reads `2026-07-24`, consistent with that build date. **Several items below are already fixed in the repo and just need deploying** — they're marked *(fixed in repo, unshipped)*.

**2. Builds don't read the database.** `npm run build` sets `SOFTPLAY_STATIC_BUILD=1`, so `getPool()` throws and every page falls back to `data/generated/`. That was a deliberate response to exhausting the Neon free-plan compute allowance (documented in `lib/pool.ts`). The consequence is that **build output is only as fresh as `data/generated/`** — and those files are currently out of sync with `venues.json`, which is the root cause of the single biggest issue on the site.

---

## Broken / incorrect

### P0 — 22 of 38 city pages serve "0 venues found" while indexable and in the sitemap

The highest-impact issue on the site. These pages return HTTP 200, carry `robots: index, follow`, sit in the sitemap at priority `0.9`, and are linked from the homepage grid and the site-wide footer — but render an empty state:

> **0 venues found** — No venues found yet. We're still building our directory…

Empty: `aberdeen`, `barnsley`, `beverley`, `birmingham`, `blackpool`, `bolton`, `bradford`, `bristol`, `doncaster`, `edinburgh`, `glasgow`, `halifax`, `inverness`, `leicester`, `lincoln`, `liverpool`, `london`, `manchester`, `newcastle`, `nottingham`, `stoke`, `sunderland`.

**Cause: a data-pipeline mismatch, not missing data.** `lib/staticVenues.ts` reads `venuesByTown.json`, which contains **16 towns / 669 venues**. But `venues.json` holds **1,052 venues across 35 towns**. So 16 of the 22 empty cities have venue data that never reached the file the app actually reads — **356 stranded venues**:

| City | Stranded | City | Stranded | City | Stranded |
|---|---|---|---|---|---|
| glasgow | 51 | newcastle | 22 | halifax | 17 |
| nottingham | 45 | barnsley | 18 | aberdeen | 9 |
| doncaster | 43 | blackpool | 18 | bradford | 6 |
| leicester | 35 | edinburgh | 17 | inverness | 2 |
| stoke | 25 | lincoln | 22 | beverley | 1 |
| sunderland | 25 | | | | |

The remaining 6 (`london`, `manchester`, `birmingham`, `bristol`, `liverpool`, `bolton`) have **zero** venues in `venues.json` — genuinely no data. Note `bolton`'s data exists under townSlug `bolton-preston`, which no route matches.

London is the worst case: full 2026 prose, 8 FAQs, a `CollectionPage` schema and an 84-char title, all wrapped around zero listings.

**This one needs your call — see "Needs approval" below.** It is not a low-risk fix.

### P0 — Every non-existent URL under a dynamic route returns HTTP 200 (soft 404)

```
/soft-play/notarealcity                200  ← should be 404
/soft-play/notarealcity/notarealvenue  200  ← should be 404
/soft-play/hull/notarealvenue          200  ← should be 404
/blog/not-a-real-post                  200  ← should be 404
/nonexistent-page-xyz                  404  ✓ (no route match, so Next handles it)
```

Worse, the server HTML for these is **visually blank** — 0 characters of visible body text. The response is 95 KB of which the entire 404 UI sits in the RSC flight payload behind `<template data-dgst="NEXT_HTTP_ERROR_FALLBACK;404">`, rendering only after hydration. Crawlers see an empty page; users see the loading skeleton first.

**Cause:** the `loading.tsx` files (`app/loading.tsx`, `app/soft-play/[city]/loading.tsx`, `app/soft-play/[city]/[slug]/loading.tsx`) create Suspense boundaries, so the shell is flushed with a 200 status *before* the page body reaches `notFound()`. Next can't retract the status code afterwards. Vercel then caches the result (`x-nextjs-prerender: 1`, `x-vercel-cache: HIT`) — so a 200-status soft 404 gets stored and re-served.

I've made these responses `noindex` (below), which limits the damage, but the status code itself needs a structural change — **see "Needs approval."**

### P0 — 343 broken internal links in blog content

`lib/blogPosts.ts` contains 409 internal `href`s; **343 instances across 249 unique URLs are broken**, all using a legacy no-`/soft-play/` prefix. Confirmed live: `/york`, `/york/flip-out-york`, `/malton`, `/market-weighton`, `/essar` all return hard 404s.

| Category | Instances | Unique | Example | Correct target |
|---|---|---|---|---|
| A — city exists, prefix missing | 138 | 73 | `/york`, `/glasgow?filter=toddler` | `/soft-play/york`, `/soft-play/glasgow/toddler` |
| B — city not in the directory at all | 158 | 129 | `/luton`, `/bath`, `/poole`, `/essar` | no valid target — de-link or point at `/search` |
| D — **placeholder content shipped live** | 24 | 24 | `/london/example-venue-1` … `-4` | none; these are stubs |
| E — uncommitted Leeds rewrite | 23 | 23 | `/soft-play/leeds/kids-club-house` | `…/kids-club-house-leeds` |

Category **D** is the embarrassing one: six blog posts link to `example-venue-1` through `-4` — placeholder text that was never filled in and is live now.

Category **E** is in your **uncommitted** `lib/blogPosts.ts` changes. The rewritten Leeds guide links to 23 venue slugs that don't exist — every real Leeds slug carries a `-leeds` suffix (`kids-club-house-leeds`, not `kids-club-house`). **Don't ship that file as-is**; it would add 23 fresh 404s.

Only categories A and E have deterministic correct targets. B and D need a content decision, so I've left all of it for you — **see "Needs approval."**

### P1 — Homepage contradicts itself on venue count, and both numbers are wrong

Same page, three different figures:

- `<meta name="description">`: **"1,800+ soft play centres"**
- Hero `<h1>` paragraph: **"Search 1,000+ indoor play centres"**
- Trust tile: **"1,000+ venues and listings"**

The static build can only actually serve **669** venues (`venuesByTown.json`), across **16** towns — while the page advertises "38+ UK towns and cities covered."

Cause: `app/page.tsx` `generateMetadata()` falls back to the string `'1,800+'` when the DB is unreachable, while the body falls back to `'1,000+'`. Under `SOFTPLAY_STATIC_BUILD=1` the DB is *always* unreachable at build time, so **both fallbacks always fire** and they disagree.

I have **not** changed these numbers — the live Neon database may well hold ~1,800 venues, and I can't verify it without burning the compute quota that caused this situation. Deciding what number to advertise is yours. But the two fallbacks should at least agree, and "1,800+" against 669 served listings is a claim worth revisiting.

### P1 — Doubled title suffix on 5+ page types — *fixed*

The root layout sets `template: "%s | Soft Play Near Me"`, and pages were repeating the suffix in `title`:

```
About Us | Soft Play Near Me | Soft Play Near Me
Contact Us | Soft Play Near Me | Soft Play Near Me
Privacy Policy | Soft Play Near Me | Soft Play Near Me
Claim Your Venue | Soft Play Near Me | Soft Play Near Me
Search Soft Play Centres | Soft Play Near Me | Soft Play Near Me
Best Soft Play in Leeds (2026 Parent Guide) | Soft Play Near Me | Soft Play Near Me
```

The blog case was already fixed in `b2619d3` *(unshipped)*. **I fixed the five static pages** — `title` no longer repeats the suffix; OG/Twitter titles keep it explicitly, since social cards bypass the template.

### P1 — Not-found pages were indexable and doubled their titles — *fixed*

`generateMetadata()` returned `{ title: 'Venue Not Found | Soft Play Near Me' }` with no `robots`, so these pages inherited the root layout's `index: true` — indexable soft 404s. **Fixed** in all three: `robots: { index: false, follow: false }` and the suffix removed.

### P1 — `/about`, `/contact`, `/privacy`, `/add-venue` shared the homepage's OG tags — *fixed*

None of the four set `openGraph`, so Next fell through to the root layout's. Sharing `/about` on Facebook showed the homepage title, the homepage description ("Find 1,800+ soft play centres…") and — worst — `og:url` pointing at the homepage, contradicting each page's own canonical. **Fixed:** each now has correct per-page `openGraph` and `twitter` blocks.

### P2 — Homepage Twitter card silently downgraded to `summary` — *fixed*

Live: `twitter:card = summary`, despite the root layout setting `summary_large_image`. Cause: `generateMetadata()` in `app/page.tsx` returned `twitter: { description }`, and Next **replaces** the whole `twitter` object rather than deep-merging — so `card` was lost and reverted to the `summary` default. A 1200×630 image was being served as a small square thumbnail. **Fixed** by restating `card` (and the `openGraph` fields) in the override.

### P2 — Venue JSON-LD emitted `postalCode: ""` — *fixed*

```json
"address": { "@type": "PostalAddress", "streetAddress": "335 National Ave",
             "addressLocality": "Hull", "postalCode": "", "addressCountry": "GB" }
```

An empty string is an asserted blank value and gets flagged by validators. **Fixed** in `lib/schema.ts` — the key is now omitted when absent. (Only 4 of 1,052 venues still lack a postcode; the backfill in `88bed7e` is unshipped.)

### P2 — Photo gallery thumbnails had no accessible name — *fixed*

`components/venue/PhotoGallery.tsx` thumbnails are `<button>`s whose only child is an `alt=""` image and which had no `aria-label` — they announced as unlabelled buttons. **Fixed** with `aria-label="View photo N of M"` plus `aria-current`.

### P2 — Blog index links to 25 `noindex` posts

`app/blog/page.tsx` maps over **all** `posts`, so the index links to all 50 — including the 25 marked `noindex: true`. `app/sitemap.ts` correctly filters them out, so the site simultaneously tells Google "don't index these" and funnels every internal blog link at them. The index should filter on `post.noindex` too. Left alone because suppressing 25 cards from a listing page is a visible content change.

### P3 — Sitemap `lastmod` is build time, not content time

197 URLs (home, 6 static, 38 city, 152 filter) use `new Date()`, so every deploy declares them all freshly modified. Venue and blog URLs correctly use real dates. Harmless but it devalues the signal.

### P3 — Heading hierarchy slips

- **Venue pages:** an `h3` ("No photos yet") precedes the first `h2` ("About Big Fun") — a skipped level.
- **City pages:** two identical `<h2>Filters</h2>` (mobile + desktop sidebars). One should be visually-hidden-but-unique or an `aria-label`.

Otherwise hierarchy is sound: exactly one `h1` on every page checked, and no other skips.

### P3 — TikTok in the footer but missing from `Organization.sameAs`

Footer links `tiktok.com/@softplaynearme`; the schema's `sameAs` lists only Facebook and Instagram. Add it so the entity graph is complete.

---

## SEO opportunities

### P1 — City pages and blog guides cannibalise each other

`/soft-play/london` and `/blog/best-soft-play-in-london` both target "best soft play in London" — the city page even uses **"Best Soft Play in London (2026 Parent Guide)"** as an `h2`, which is verbatim the blog post's title. This repeats for every city with a guide. Two of your own URLs compete for the same query, splitting link equity and letting Google pick.

Pick one canonical intent per query: city page = the listings/directory page; guide = editorial depth that links *into* it. Differentiate the titles accordingly. The `noindex`ing of 25 thin guides in `b2619d3` already moves in this direction; worth finishing deliberately.

### P1 — Blog pages have no header, no footer, and no navigation

All 51 blog URLs render `<main>` only — `app/blog/page.tsx` and `app/blog/[slug]/page.tsx` import neither `Header` nor `Footer`, unlike every other route. Consequences:

- No site nav, no logo, no way back except in-content links — a poor landing experience for exactly the pages organic search sends people to first.
- **No footer means no internal links to the 38 city pages.** The footer city directory is the site's main internal-linking mechanism and blog readers never get it.
- Zero images across the blog (`<img>` count: 0 on both index and posts).

Adding `<Header />` / `<Footer />` to both blog routes is probably the single highest-leverage internal-linking change available, and it's cheap.

### P1 — Venue meta descriptions are templated and thin

`/soft-play/hull/big-fun` serves: *"Big Fun – soft play centre in Hull. Find opening hours, prices, directions, and more."* (85 chars) — near-identical across hundreds of venues, so they compete as duplicates and use ~55% of the available snippet.

Rooted in data sparsity — of 1,052 venues:

| Field | Missing | % |
|---|---:|---:|
| `priceFrom` | 1,043 | 99% |
| `description` | 677 | 64% |
| `mainImageUrl` | 352 | 33% |
| `openingHoursText` | 123 | 11% |
| `phone` | 115 | 10% |
| `website` | 107 | 10% |

The 99% missing `priceFrom` also means `priceRange` is essentially never emitted in `LocalBusiness` schema, and the missing hours mean `openingHoursSpecification` is usually absent — both are things Google surfaces for local results. Enriching hours and prices would improve descriptions, schema and on-page content simultaneously. `scripts/enrich-venues.mjs` and `enrich-seo-all.mjs` already exist for this.

### P2 — The site-wide footer sends every page's link equity to 22 empty pages

`components/layout/Footer.tsx` hardcodes all 38 cities across 8 regions, so every page on the site links to the 22 empty ones. Until the data issue is resolved, that's the strongest internal signal on the site pointing at the weakest pages. Consider filtering the footer directory to cities with listings — it would fix itself once the pipeline is repaired.

### P2 — `/search?q=…` is indexable

The `q` branch of `generateMetadata()` produces a unique title per query but sets no `robots`, so parameterised result pages can be indexed — classic index bloat, and the results are client-rendered so a crawler sees an empty shell. City pages already handle this correctly (`noindex` when any filter param is present). Applying the same to `/search` when `q`/`lat`/`lng` are present would be consistent. Left alone because it's an indexability change.

### P2 — No venue-specific OG images

Venue pages use the generic `/opengraph-image`. City pages already do better via `getCityOgImage()`. Venue cards shared to WhatsApp/Facebook — a real sharing pattern for "look at this place" — all look identical.

### P2 — `FAQPage` schema no longer earns rich results

FAQ schema is on the homepage, all city pages, all filter pages, all venue pages and all blog posts. Since Google's Aug-2023 change, FAQ rich results are limited to authoritative government and health sites, so none of this produces SERP features any more. Not harmful, and still genuinely useful for AI answer engines — which `app/robots.ts` deliberately allows (GPTBot, ClaudeBot et al.). Just don't count it as a rich-result play.

### P3 — Missing `AggregateRating` on most venues

51 venues have no rating, and `aggregateRating` is only emitted when both `avgRating` and `reviewCount` are present. Star ratings are one of the few rich results still reliably shown for local businesses. Ratings data exists in `venues.json` for most venues — worth confirming it survives the `staticToVenue` mapping.

### P3 — Data-quality issues visible in venue slugs

`venues.json` shows venues filed under the wrong town, which will surface as wrong-city listings:

- `flip-out-york-previously-point-zero-trampoline-park-york-leeds` — a York venue under `leeds`
- `crazy-kingdom-northallerton-leeds`, `infinity-bradford-leeds`, `jigsaw-juniors-shipley-leeds`, `the-little-bees-formerly-kidzplay-harrogate-leeds`
- 3 venues with townSlug `unknown`, 1 under `inverurie` (not a route)

Slugs also redundantly repeat the town (`kids-club-house-leeds` under `/soft-play/leeds/`), making URLs longer than needed. Not worth changing now — slug changes mean redirects — but worth knowing before the next bulk import. `reports/data-quality-audit.md` covers related ground.

### P3 — Non-soft-play venues in the directory

Hull's listing includes bouncy-castle hire firms, escape rooms, face painters, a Brewers Fayre and leisure centres. `lib/venueTypes.ts` / `isSoftPlayVenueType` already exclude these from *Top Rated* and *Best for Toddlers*, but they remain in the main A–Z, which dilutes topical relevance for "soft play near me".

---

## What's working well

Worth recording so it doesn't get "fixed":

- **Rendering is SSG/ISR throughout** — every public route is prerendered (`x-nextjs-prerender: 1`) with `revalidate = 3600`. Titles, descriptions, canonicals, headings, body prose, venue listings and JSON-LD are all in the server HTML. No client-render SEO problem anywhere that matters. Client components (`HeroCarousel`, `PhotoGallery`, `VenueMap`, `ReviewSection`, `ShareButtons`, filter/sort controls) are all correctly non-essential to indexable content. The only route whose main content is client-rendered is `/search`, which isn't a ranking target.
- **`robots.txt`** is correct and intentional — blocks `/api/`, `/admin/`, `/dashboard/`, `/verify-email/`, allows AI crawlers deliberately, declares the sitemap.
- **`sitemap.xml`** is valid, 918 URLs, correctly excludes `noindex` venues and thin pages (`SITEMAP_MIN_SCORE`).
- **Canonicals** — present and correctly self-referencing on every page type checked.
- **Structured data** — `Organization` + `WebSite`/`SearchAction` site-wide, plus `BreadcrumbList`, `CollectionPage`, `ItemList`, `SportsActivityLocation` and `Article` where appropriate. All 5 JSON-LD blocks per page parse without error.
- **Alt text** — genuinely good. 43 images on the homepage, zero missing `alt`. The only empty `alt` is the header logo, which is correct (it sits inside a link that already contains the text "Soft Play Near Me", so a duplicate label would be noise).
- **`metadataBase`**, Google verification file, `/opengraph-image` (200, `image/png`), favicons and Apple touch icon all present and correct.
- Facebook and Instagram profile URLs both resolve.

---

## Fixes applied

All in the working tree, unstaged. `npx tsc --noEmit` and `eslint` both pass clean.

| File | Change |
|---|---|
| `app/about/page.tsx` | De-doubled title; added correct `openGraph` + `twitter` |
| `app/contact/page.tsx` | Same |
| `app/privacy/page.tsx` | Same |
| `app/add-venue/page.tsx` | Same |
| `app/search/page.tsx` | De-doubled title; social titles keep the suffix |
| `app/page.tsx` | Restored `twitter.card: summary_large_image` and OG fields lost to object replacement |
| `app/soft-play/[city]/page.tsx` | "City Not Found" → `noindex, nofollow`, suffix removed |
| `app/soft-play/[city]/[slug]/page.tsx` | "Venue Not Found" → `noindex, nofollow`, suffix removed |
| `app/blog/[slug]/page.tsx` | "Post Not Found" → `noindex, nofollow`, suffix removed |
| `lib/schema.ts` | Omit `postalCode` instead of emitting `""` |
| `components/venue/PhotoGallery.tsx` | `aria-label` + `aria-current` on thumbnail buttons |

`lib/blogPosts.ts` also shows as modified — that is **your** pre-existing uncommitted Leeds rewrite, untouched by me. See the Category E warning.

---

## Needs approval

Five items I deliberately did **not** touch.

**1. Deploy the six unshipped commits.** Ships the blog title fix, `noindex` on 25 thin guides, the slug dedupe and the postcode backfill — resolving several P1s at zero code cost. Needs a decision on branch/merge order, and note that `cb98c44` changes build behaviour to skip the DB.

**2. Regenerate `venuesByTown.json` to unstrand 356 venues** *(fixes the P0)*. `venuesByTown.json` covers 16 towns; `venues.json` has 35. Rebuilding it would populate 16 of the 22 empty city pages. Two routes:
- `npm run data:rebuild` — regenerates from the **database**, so it needs `DATABASE_URL` and Neon compute (the thing that was exhausted). Freshest data.
- `npm run data:build` — regenerates from CSV, no DB needed. Safer, possibly staler.

Either way it's a **bulk data change affecting 16 city pages and ~356 new indexable URLs**, so I'd want your go-ahead plus a diff review. Separately: the 6 genuinely-empty cities (`london`, `manchester`, `birmingham`, `bristol`, `liverpool`, `bolton` — the biggest markets in the country) need either real data or `noindex` until they have it. And `bolton-preston` needs reconciling with the `bolton` route.

**3. Return real 404s from dynamic routes** *(fixes the P0)*. Options, roughly increasing in effort:
- Remove or relocate the `loading.tsx` files so the shell isn't flushed before `notFound()` — simplest, costs the loading skeletons.
- Set `dynamicParams = false` on the venue/city/blog routes so unknown params 404 at the routing layer. Cleanest for SEO, but only works if `generateStaticParams()` is genuinely exhaustive — with the DB skipped at build time it currently isn't, so this would 404 valid venues. **Sequence this after item 2.**
- Add explicit redirects for known-dead legacy patterns via the existing `data/redirects.json` infrastructure.

I'd want to discuss which, since each trades off against ISR behaviour.

**4. Repair the 343 broken blog links.** Categories A (138) and E (23) have deterministic targets and I can script those safely. Categories B (158 links to cities not in the directory) and D (24 `example-venue-N` placeholders) need your decision: de-link, point at `/search`, or write real content. Happy to do A and E now and leave B and D flagged inline, if you'd prefer to split it.

**5. Settle the venue-count claim.** "1,800+" vs "1,000+" vs 669 actually served. Tell me the number you want to stand behind — or let me wire both fallbacks to the real static count so they can't diverge again — and I'll make it consistent.
