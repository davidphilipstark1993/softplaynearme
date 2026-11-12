-- Hull-area claiming wave: the widened recipient query. READ-ONLY (a SELECT). FOR REVIEW.
--
-- The original wave used `city_slug = 'hull'` and returned 9 rows (8 once the Wix placeholder
-- info@mysite.com is dropped). Several venues with a good email sit under other tags (Beverley, Scunthorpe,
-- and — until step 2 — Doncaster), so this selects by distance (straight-line, 20 miles from Hull centre,
-- 53.7457 / -0.3367) or an HU postcode. Everything else is unchanged: active, visible type, unclaimed,
-- well-formed public email, last-30-days exclusions, and placeholder domains skipped.
-- The distance, the recipient filter and the postcode rule are mirrored in scripts/outreach/area-wave.mjs,
-- which the tests run against a fixture. Parameterise the centre and radius for other areas.

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
  ROUND((3958.7613 * acos(LEAST(1.0, GREATEST(-1.0,
    cos(radians(53.7457)) * cos(radians(v.lat::double precision))
      * cos(radians(v.lng::double precision) - radians(-0.3367))
    + sin(radians(53.7457)) * sin(radians(v.lat::double precision))
  ))))::numeric, 2) AS distance_miles,
  'https://www.softplaynearme.co.uk/soft-play/' || v.city_slug || '/' || v.slug AS listing_url
FROM venues v
WHERE v.is_active = true
  AND COALESCE(v.claimed_by_owner, false) = false
  AND (v.venue_type IS NULL OR v.venue_type IN ('indoor', 'pub'))
  AND COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), '')) IS NOT NULL
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''))))
      ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''))))
      NOT LIKE '%@mysite.com'
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''))))
      NOT LIKE '%@example.com'
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''))))
      NOT LIKE '%@email.com'
  AND LOWER(TRIM(COALESCE(NULLIF(TRIM(v.contact_email), ''), NULLIF(TRIM(v.email), ''))))
      NOT IN (
        'info@uklittlerascals.com',
        'info@gigglesplayandadventure.co.uk',
        'geoplayltdwales@gmail.com',
        'customerservice@wonderworldgroup.co.uk'
      )
  AND v.lat IS NOT NULL AND v.lng IS NOT NULL
  AND (
        (3958.7613 * acos(LEAST(1.0, GREATEST(-1.0,
          cos(radians(53.7457)) * cos(radians(v.lat::double precision))
            * cos(radians(v.lng::double precision) - radians(-0.3367))
          + sin(radians(53.7457)) * sin(radians(v.lat::double precision))
        )))) <= 20.00
      OR UPPER(regexp_replace(COALESCE(v.postcode, ''), '\s+', '', 'g')) ~ '^HU[0-9]'
  )
ORDER BY distance_miles, v.name;
