-- Claim-wave recipients for ANY city hub. READ-ONLY (a SELECT). FOR REVIEW.
--
--   psql "$DATABASE_URL" --csv -v city=sunderland -f scripts/sql/outreach/city-claim-recipients.sql \
--     > contacts/claim-campaign/sunderland.csv
--
-- Same filters as the Hull and Birmingham waves: active, visible type (indoor / pub / none), unclaimed, a well-formed
-- public email (contact_email, falling back to email — never lead_notification_email), placeholder domains out, and
-- the addresses emailed in the last 30 days out. It does NOT check postcodes: a city with neighbouring towns filed under
-- its hub (Birmingham was the example) needs a postcode rule like 03-birmingham-claim-recipients.sql, and the script's
-- `postcode_districts` config. Check the `postcode` column against the hub's real area before sending.
-- A city also needs its own letter and config block in scripts/outreach/claim-campaign.mjs.

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
WHERE v.city_slug = :'city'
  AND v.is_active = true
  AND COALESCE(v.claimed_by_owner, false) = false
  AND (v.venue_type IS NULL OR v.venue_type IN ('indoor', 'pub'))
  AND COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), '')) IS NOT NULL
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''))))
      ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''))))
      !~ '@(mysite\.com|example\.com|example\.org|email\.com|test\.com|domain\.com)$'
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), '')))) NOT IN (
        'info@uklittlerascals.com',
        'info@gigglesplayandadventure.co.uk',
        'geoplayltdwales@gmail.com',
        'customerservice@wonderworldgroup.co.uk'
      )
ORDER BY v.name;
