# Priority 1 (geo assignment) — parked follow-up items

Generated after the phase4-01 through phase4-04 migrations (2026-08-17). These are
the items deliberately **not** auto-resolved — either genuine judgment calls or
noise from the audit tooling that turned out not to need action. Re-run
`node scripts/migrations/phase4-01-geo-distance-audit.mjs` any time to refresh
these numbers against the live DB; full detail lands in
`data/_geo_distance_findings.json`.

## 1. NO_HUB_NEARBY — 54 venues whose true town has no declared hub within 15mi

This is the "near-X vs exclude" policy question from the original brief, not yet
decided. Clusters (venue counts approximate, re-run the audit for current numbers):

- **Southend area (16)** — mostly Southampton/Hampshire venues (Southampton itself
  has no hub; nearest is Portsmouth 15-21mi or Bournemouth 15-22mi). Southend and
  Southampton are two different real places currently sharing one hub slug in
  `data/cities.json` — worth checking whether some of these were miscoded against
  "southend" purely because of the name collision.
- **South Yorkshire/Peak District fringe (Sheffield, 5)** — Buxton, Glossop-adjacent
  outliers, genuinely ~19mi from any declared hub.
- **Cardiff/Swansea Valleys towns (8 combined)** — Rhondda/Ogmore/Aberaman area,
  roughly equidistant and slightly over threshold from both Cardiff and Swansea.
- **Ipswich/Norwich border (4)**, **Colchester/Chelmsford (3)**, **Nottingham
  outliers (3)**, smaller singletons in Lincoln, Hastings, Brighton, Leeds, York,
  Bolton, Birmingham.

No action taken — these are still filed under their original (imperfect) city.

## 2. REVIEW — 128 boundary cases

Nearest-by-distance disagrees with assigned city, but not by enough margin to
auto-move (mostly Hull/Beverley, Leeds/Bradford, Barnsley/Huddersfield,
Sunderland/Newcastle, Halifax/Bradford — real overlapping catchment areas where
raw distance alone isn't a reliable enough signal). Left as-is. Candidate for a
manual pass city-by-city, or for a better ground-truth signal than straight-line
distance (e.g. actual postcode district research per venue, the way the original
Aug 6 fix did for its 20 manual overrides).

## 3. Possible remaining duplicates — 6 groups (down from 66 before this pass)

All same-name-different-city duplicates were merged in phase4-02. What's left is
different-name pairs sharing near-identical coordinates — mostly genuinely
co-located but distinct businesses (e.g. Toddler Sense / Baby Sensory at one
Manchester unit), **except**:

- `"Jelly Beans under 5's"` — id=343 (barnsley) and id=1026 (huddersfield), same
  name, coordinates ~within a few hundred metres. Likely a genuine unresolved
  duplicate that sits just outside the 4-decimal-place coordinate-rounding match
  used by phase4-02. Worth a manual look.
- The rest (Laser Station/Lost City Adventure Golf, Daisy Play/Bambini, Cyrils Fun
  House/Cyril's nut hut, Amaisleys/Happy Dayz) all look like distinct businesses
  at the same retail park/building — no action recommended.

## 4. Stale slug-suffix cosmetic noise (not a real problem)

`scripts/migrations/phase2-04-move-wrong-city.mjs` now reports ~40 MEDIUM-confidence
"mismatches" that are false positives: venues correctly moved by phase4-02/03 whose
URL `slug` still has the *old* city appended (e.g. a venue now correctly under
Barnsley at `/soft-play/barnsley/the-secret-garden-doncaster`). `city_slug` (the
field that actually drives routing, hub-page membership, and description
generation) is correct; only the cosmetic slug text is stale. Not urgent — would
need a slug rename + redirect per venue to clean up, purely cosmetic.

## 5. Southend vs Southampton naming collision

Noticed while triaging #1 above: several venues clearly in Southampton (a real,
fairly large city with no hub of its own) are filed under the `southend` city
slug, which is actually Southend-on-Sea — a different town ~90mi away. Worth
checking whether this is a genuine naming mixup upstream, independent of the
geo-distance issue.
