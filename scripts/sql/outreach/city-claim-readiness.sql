-- Which city hubs have enough reachable venues to be worth a claim wave? READ-ONLY (a SELECT). FOR REVIEW.
--
--   psql "$DATABASE_URL" -f scripts/sql/outreach/city-claim-readiness.sql
--
-- One row per hub: visible active venues, how many are unclaimed with a usable public email, how many have none, and
-- how many only have a placeholder address. Put the result next to the city-page impressions in
-- scripts/outreach/claim-wave-readiness-2026-11-13.md (the Search Console figures are not in the database).

SELECT
  v.city_slug,
  count(*) AS visible_active,
  count(*) FILTER (WHERE COALESCE(v.claimed_by_owner, false)) AS claimed,
  count(*) FILTER (
    WHERE NOT COALESCE(v.claimed_by_owner, false)
      AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''), '')))
          ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
      AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''), '')))
          !~ '@(mysite\.com|example\.com|example\.org|email\.com|test\.com|domain\.com)$'
  ) AS usable_email,
  count(*) FILTER (
    WHERE NOT COALESCE(v.claimed_by_owner, false)
      AND COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), '')) IS NULL
  ) AS no_email,
  count(*) FILTER (
    WHERE LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''), '')))
          ~ '@(mysite\.com|example\.com|example\.org|email\.com|test\.com|domain\.com)$'
  ) AS placeholder_email
FROM venues v
WHERE v.is_active = true
  AND (v.venue_type IS NULL OR v.venue_type IN ('indoor', 'pub'))
GROUP BY v.city_slug
ORDER BY usable_email DESC, visible_active DESC;
