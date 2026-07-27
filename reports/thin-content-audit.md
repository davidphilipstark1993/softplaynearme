# Blog Thin-Content Audit — Phase 3

**Generated:** 2026-07-24
**Scope:** All 52 entries in `lib/blogPosts.ts`, checked against the Hull guide (the quality baseline you asked for) and cross-referenced programmatically against real venue data (`data/generated/venues.json`) for every city each post claims to cover.
**File changes:** None. Per your instruction, nothing is rewritten here — this is the audit only, for you to approve city by city.

---

## Methodology

For each post I extracted the target city from its slug and checked:
1. Does that city have a real page on the site (is its slug in `data/cities.json`'s declared 38, or does it have venue data at all)?
2. Does the post's body text actually name any of our real venues for that city (case-insensitive substring match against every venue name we hold for that city)?
3. Does the post contain literal unfinished placeholder markup (`example-venue-1`, "replace with real ones")?

This is a blunt instrument — it can't tell you if prose is *well-written*, only whether it's tethered to real data. But the result turned out extremely clear-cut: it's not a borderline judgment call. Full results: `data/_blog_audit.json`.

## The baseline: `best-soft-play-in-hull`

Names 6+ real venues (Blue Kangaroo, Let's Play Hull, Little Astronauts, Crazy Kids, Rock Up Hull, Active+, Imagination Station, The Secret Village), with specific details that could only come from actually knowing the venues: age caps ("cap their age limit at eight"), specific roads (Holderness Road, Harpings Road), comparative judgments ("the best cafe... and it isn't close"), and a structured recommendation section by scenario ("If your child is under three...", "If you want climbing as well as soft play..."). This is the standard the rest of the guides are measured against.

## Executive summary

| Finding | Count |
|---|---|
| Guides matching the Hull standard (real venues named, specific detail) | **1** (`best-soft-play-in-hull` itself) |
| Guides for **Hull** that are still generic despite Hull having 79 real venues to draw from | 3 |
| Guides containing literal unfinished placeholder markup (`example-venue-1`, "replace with real ones") live on the site right now | 8 |
| Guides for a declared, real city that name **zero** real venues, no placeholder text (just generic template prose) | 19 |
| Guides for a city that **doesn't exist on the site at all** — no city page, no venue data, some don't even resolve to a real URL | 19 |
| Duplicate blog post slugs (two different draft bodies competing for the same URL) | 2 (`best-soft-play-in-sheffield`, `best-soft-play-in-york`) |

**51 of the 52 posts fail the "names real local venues with specific details" test.** This isn't a spectrum of "some are better than others" — with one exception every non-Hull-flagship post (and 3 of the 4 Hull posts) is generated from what is visibly the same city-agnostic template: identical section headers ("Why families love soft play in {city}", "Best soft play in {city}: what to look for", "Toddler soft play in {city} (1–3 years)", "Cheap soft play in {city}: money-saving tips", "SEN-friendly / autism-friendly soft play in {city}"), identical bullet points word-for-word, identical FAQ phrasing — with only the city name substituted in. None of it is false in the sense of asserting a wrong fact about a specific venue (mostly it just doesn't name any venue at all), but it's the definition of thin content: interchangeable, adds nothing a search engine or a parent couldn't get from a template, and several instances go further and expose unfinished scaffolding directly to visitors.

---

## 1. Live right now: unfinished placeholder content (8 posts)

These contain literal template scaffolding that was never replaced — visible to any visitor or search engine that lands on the page today.

| Slug | City | Real venues we hold for this city | Placeholder text found |
|---|---|---|---|
| `best-soft-play-in-bristol` | Bristol | 0 (city has no data yet — see §4) | `<p>Venue placeholders (replace with real ones):</p>` + 4× `example-venue-N` links |
| `best-soft-play-in-manchester` | Manchester | 0 | same pattern |
| `best-soft-play-in-birmingham` | Birmingham | 0 | same pattern |
| `best-soft-play-in-liverpool` | Liverpool | 0 | same pattern |
| `best-soft-play-in-london` | London | 0 | same pattern |
| `best-soft-play-in-leeds` | Leeds | 73 | same pattern — **worst case: we have 73 real Leeds venues and this guide still links to `example-venue-1`** |
| `best-soft-play-in-sheffield` | Sheffield | 120 | same pattern (one of the two duplicate entries — see §5) |
| `best-soft-play-in-newcastle` | Newcastle | 22 | same pattern |

**Recommendation: noindex or unpublish these 8 immediately, independent of any rewrite timeline.** Showing `/bristol/example-venue-1` as a live link is actively embarrassing if a visitor or a journalist clicks it, and it's a stronger signal to Google of low-effort content than a merely-generic page. This is the one sub-set I'd suggest actioning without waiting for the full city-by-city rewrite approval, since it's not a content-quality judgment call — it's unfinished work that shipped by accident.

---

## 2. Generic template, no placeholder text, real venue data available and unused (22 posts)

These read fluently and don't expose broken markup, but name zero real venues despite us holding real data for every one of these cities — including three that are nominally about **Hull**, the city with our best data and our one good example to copy from.

### 2a. Hull siblings (should be easiest to fix — the data's right there)

| Slug | Real venues we hold for Hull | Real venues named |
|---|---|---|
| `cheap-soft-play-in-hull` | 79 | 0 |
| `best-toddler-soft-play-in-hull` | 79 | 0 |
| `rainy-day-activities-hull` | 79 | 0 |

### 2b. Other declared cities

| Slug | City | Real venues we hold |
|---|---|---|
| `best-soft-play-in-york` | York | 91 |
| `best-soft-play-in-glasgow` | Glasgow | 51 |
| `best-soft-play-in-nottingham` | Nottingham | 45 |
| `best-soft-play-in-cardiff` | Cardiff | 42 |
| `best-soft-play-in-portsmouth` | Portsmouth | 36 |
| `best-soft-play-in-swansea` | Swansea | 35 |
| `best-soft-play-in-leicester` | Leicester | 35 |
| `best-soft-play-in-bournemouth` | Bournemouth | 32 |
| `best-soft-play-in-colchester` | Colchester | 32 |
| `best-soft-play-in-norwich` | Norwich | 30 |
| `best-soft-play-in-brighton` | Brighton | 27 |
| `best-soft-play-in-hastings` | Hastings | 27 |
| `best-soft-play-in-southend` | Southend | 23 |
| `best-soft-play-in-blackpool` | Blackpool | 18 |
| `best-soft-play-in-edinburgh` | Edinburgh | 17 |
| `best-soft-play-in-ipswich` | Ipswich | 16 |
| `best-soft-play-in-aberdeen` | Aberdeen | 9 |
| `best-soft-play-in-huddersfield` | Huddersfield | 4 |
| `best-soft-play-in-inverness` | Inverness | 2 |

Two of these — York and Sheffield — actually have a *second*, different draft under the same slug that does name one real venue each; see §5, duplicate slugs.

**Recommendation: rewrite with real venue data from our own listings, matching the Hull structure** (specific venues named per section, age caps, streets/areas, a closing "which one should you pick" recommendation block). We already hold enough venue data for every one of these to do a real version — this is the highest-value rewrite tier since the data gap isn't the blocker, the writing is.

---

## 3. Cities that don't exist on the site (19 posts)

These target a city slug that isn't in `data/cities.json`'s declared 38 and has zero venue data in either export I could check. Some of the links inside them (per the Phase 2 findings) don't even use the correct `/soft-play/` URL prefix, so they're doubly broken — thin content *and* dead internal links.

| Slug | City |
|---|---|
| `best-soft-play-in-cambridge` | Cambridge |
| `best-soft-play-in-oxford` | Oxford |
| `best-soft-play-in-coventry` | Coventry |
| `best-soft-play-in-milton-keynes` | Milton Keynes |
| `best-soft-play-in-reading` | Reading |
| `best-soft-play-in-southampton` | Southampton |
| `best-soft-play-in-plymouth` | Plymouth |
| `best-soft-play-in-exeter` | Exeter |
| `best-soft-play-in-swindon` | Swindon |
| `best-soft-play-in-wolverhampton` | Wolverhampton |
| `best-soft-play-in-stoke-on-trent` | Stoke-on-Trent |
| `best-soft-play-in-derby` | Derby |
| `best-soft-play-in-chester` | Chester |
| `best-soft-play-in-preston` | Preston |
| `best-soft-play-in-middlesbrough` | Middlesbrough |
| `best-soft-play-in-peterborough` | Peterborough |
| `best-soft-play-in-northampton` | Northampton |
| `best-soft-play-in-dundee` | Dundee |
| `best-soft-play-in-stirling` | Stirling |

**Recommendation: noindex or remove until the city itself is added to the site with real venue data.** These can't be fixed with a rewrite alone — there's nothing to write about yet, since we have no venues on file for any of them. Publishing a "guide" to a city we don't cover is the clearest version of the problem you're trying to fix before expanding further. I'd treat this list as your literal "cities we've already half-started marketing for" backlog if/when you do expand.

---

## 4. Note on Bristol/Manchester/Birmingham/Liverpool/London specifically

These 5 are declared, real cities (`data/cities.json` has them) but currently show **0 real venues** in every local data source I have access to (see `reports/data-quality-audit.md` §0 — these are the same 6 cities, minus Bolton, that are currently showing empty on the live site because of the DB outage). Once the DB is back and/or that data gap is resolved, these move from "§3, doesn't exist" territory into "§2, data exists but guide doesn't use it" territory — same rewrite treatment as the rest of §2, just blocked on the DB for now.

---

## 5. Technical bug: duplicate slugs

`best-soft-play-in-sheffield` and `best-soft-play-in-york` each appear **twice** in `lib/blogPosts.ts` with genuinely different body content (not accidental copies — different word counts, 6043 vs 6605 characters for Sheffield, 6269 vs 6065 for York). Only one can ever actually render at `/blog/best-soft-play-in-sheffield` — whichever the lookup function resolves first — so the other is dead, unreachable content sitting in the codebase. Worth deciding which draft (if either) is the one to keep before any rewrite, rather than rewriting one and leaving an orphaned duplicate behind.

---

## Recommended sequencing

1. **Noindex/unpublish the 8 placeholder posts (§1) now** — this isn't really a content judgment call, it's live scaffolding. Low risk, clear win.
2. **Decide the Sheffield/York duplicate** (§5) before touching either.
3. **Rewrite city-by-city, your call on order** — I'd suggest starting with the highest-value combination of "most real venue data available" and "most search-relevant city": York (91 venues), Glasgow (51), Nottingham (45), Cardiff (42) would be my instinct, but this is exactly the kind of call you said you'd make per city.
4. **Hold the 19 non-existent-city posts (§3)** until those cities have real venue data — rewriting them now would just be writing a better version of content about places we don't cover.

Not touching any blog content until you tell me which cities to start with.
