-- Hull-area sweep, 12 November 2026 — step 2 of 3. FOR REVIEW; run by a person, never unattended.
--
-- Run ONLY after the branch `data/hull-area-tags-emails-2026-11-12` is deployed: it adds the Grimsby,
-- Cleethorpes, Brigg, Driffield and Goole hubs (data/cities.json, data/cities-basic.json). Retagging to a
-- slug that is not a hub 404s the listing. Slugs are unchanged, so only the city part of each URL moves;
-- the old /soft-play/doncaster/… and /soft-play/bridlington/… URLs 301 to the new ones
-- (data/redirects.json). Same precedent as scripts/migrations/phase4-03-reassign-city.mjs: city_slug only.
-- Each UPDATE re-checks the current tag and postcode district, so a stale run changes nothing.

BEGIN;

UPDATE venues SET city_slug = 'brigg',       updated_at = NOW() WHERE id = 27   AND city_slug = 'doncaster'   AND postcode ILIKE 'DN20%';
UPDATE venues SET city_slug = 'grimsby',     updated_at = NOW() WHERE id = 31   AND city_slug = 'doncaster'   AND postcode ILIKE 'DN32%';
UPDATE venues SET city_slug = 'cleethorpes', updated_at = NOW() WHERE id = 33   AND city_slug = 'doncaster'   AND postcode ILIKE 'DN35%';
UPDATE venues SET city_slug = 'driffield',   updated_at = NOW() WHERE id = 19   AND city_slug = 'bridlington' AND postcode ILIKE 'YO25%';
UPDATE venues SET city_slug = 'goole',       updated_at = NOW() WHERE id = 1177 AND city_slug = 'doncaster'   AND postcode ILIKE 'DN14%';

-- Not done: Barton-upon-Humber (id 1166, a park playground, the only venue in the town) — no hub is added for
-- a town whose only listing is a playground. If you want one later:
-- UPDATE venues SET city_slug = 'barton-upon-humber', updated_at = NOW() WHERE id = 1166 AND city_slug = 'doncaster' AND postcode ILIKE 'DN18%';

COMMIT;

-- Confirm: SELECT id, name, city_slug, slug FROM venues WHERE id IN (27,31,33,19,1177,78) ORDER BY id;
