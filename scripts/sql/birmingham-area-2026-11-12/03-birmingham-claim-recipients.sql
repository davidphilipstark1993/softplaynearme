-- Birmingham claim wave: the recipient query. READ-ONLY (a SELECT). FOR REVIEW.
--
-- Only venues that are genuinely on the Birmingham page: filed under city_slug = 'birmingham' AND with a postcode in a
-- Birmingham city district (B1-B21, B23-B35, B38, B42, B44, B72-B76 — Sutton Coldfield included). Ambiguous districts
-- (B36, B37, B43, B45) are left out on purpose. The same rule is applied again by scripts/outreach/claim-campaign.mjs
-- (`postcode_districts` in the birmingham config), so a stale or hand-edited CSV cannot get past it.
--
-- Run AFTER 01-official-emails.sql (so Dottie's Playhouse and Little Tinkers have their addresses) and, ideally, after
-- 02-retag-after-hubs.sql (so the Birmingham page is down to its real venues). Before 02 the postcode rule alone already
-- keeps the neighbouring towns out.
--
-- Export as CSV to contacts/claim-campaign/birmingham.csv (gitignored):
--   psql "$DATABASE_URL" --csv -f scripts/sql/birmingham-area-2026-11-12/03-birmingham-claim-recipients.sql \
--     > contacts/claim-campaign/birmingham.csv
-- (or run it in the Neon SQL editor and export the result as CSV with exactly these columns.)

SELECT
  v.id AS venue_id,
  v.name AS venue_name,
  v.slug,
  v.city_slug,
  LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), '')))) AS email,
  v.website,
  v.address,
  v.postcode,
  v.venue_type,
  COALESCE(v.claimed_by_owner, false) AS claimed_by_owner
FROM venues v
WHERE v.city_slug = 'birmingham'
  AND v.is_active = true
  AND COALESCE(v.claimed_by_owner, false) = false
  AND (v.venue_type IS NULL OR v.venue_type IN ('indoor', 'pub'))
  AND UPPER(TRIM(COALESCE(v.postcode, '')))
      ~ '^B(?:[1-9]|1[0-9]|2[01]|2[3-9]|3[0-5]|38|42|44|7[2-6])\s*[0-9][A-Z]{2}$'
  AND COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), '')) IS NOT NULL
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''))))
      ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''))))
      !~ '@(mysite\.com|example\.com|example\.org|email\.com|test\.com|domain\.com)$'
  -- never the PR-agency address on Emily's Adventure Play
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), '')))) <> 'draytonmanor@rewiredpr.com'
  -- addresses already emailed in the last 30 days by other SPNM outreach
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), '')))) NOT IN (
        'info@uklittlerascals.com',
        'info@gigglesplayandadventure.co.uk',
        'geoplayltdwales@gmail.com',
        'customerservice@wonderworldgroup.co.uk'
      )
ORDER BY v.name;
