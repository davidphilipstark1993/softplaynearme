-- Hull-area sweep, 12 November 2026 — step 1 of 3. FOR REVIEW; run by a person, never unattended.
--
-- Adds the eight contact emails verified on OFFICIAL venue websites (source URL beside each) and moves
-- Sweet Soft Play to the existing Beverley hub. Every UPDATE only fills an EMPTY contact_email, so it
-- can't overwrite anything. Deliberately NOT here: third-party addresses (JAM JAMZ on Discover Driffield,
-- Airkings on Visit North Lincolnshire, Beach Cove village reception, Jurassica on MaxCard); the stale
-- Karoo address on Cottingham Sports Centre (id 47) and the mysite.com placeholder on Ping Pong Tots
-- (id 32) are left as they are (the outreach tooling skips placeholder domains and flags karoo.co.uk).

BEGIN;

-- Big Fun Indoor Play Centre (id 12). Visible indoor, city_slug already hull.
-- Source: https://www.big-fun-hull.co.uk/contact/
-- Live page displays an email (Cloudflare-obfuscated). Decoded from the Internet Archive snapshot of the
-- same URL dated 2025-06-10, which also contains the raw address in page text: enquiries@big-fun-hull.co.uk
UPDATE venues
   SET contact_email = 'enquiries@big-fun-hull.co.uk',
       updated_at    = NOW()
 WHERE id = 12
   AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- The Secret Village (id 18). Visible indoor, Anlaby, tagged hull (no Anlaby hub).
-- Source: https://thesecretvillage.co.uk/find%2Fcontact-us  (displayed with the Anlaby address and 01482 770092)
UPDATE venues
   SET contact_email = 'info@thesecretvillage.co.uk',
       updated_at    = NOW()
 WHERE id = 18
   AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- Blackburn Leisure Sports & Community Club (id 1170). Visible indoor, Brough.
-- Source: https://blackburnleisure.co.uk/  (labelled "General Enquiries"; do not store the junior-football
-- or sponsorship addresses from the same page)
UPDATE venues
   SET contact_email = 'enquiries@blackburnleisure.co.uk',
       website       = COALESCE(NULLIF(BTRIM(website), ''), 'https://blackburnleisure.co.uk/'),
       updated_at    = NOW()
 WHERE id = 1170
   AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- Cheeky Chimps, Scunthorpe (id 1172). Visible indoor, city_slug already scunthorpe.
-- Source: https://cheekychimpsscunthorpe.co.uk/contact-us/  (also on the homepage; the official site was
-- missing from the website column)
UPDATE venues
   SET contact_email = 'enquiries@cheekychimpsscunthorpe.co.uk',
       website       = COALESCE(NULLIF(BTRIM(website), ''), 'https://cheekychimpsscunthorpe.co.uk/'),
       updated_at    = NOW()
 WHERE id = 1172
   AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- Superbowl UK Hull (id 24). family-attraction, still excluded by the type filter.
-- Source: https://www.superbowluk.co.uk/hull/
UPDATE venues
   SET contact_email = 'hull@superbowluk.co.uk',
       updated_at    = NOW()
 WHERE id = 24
   AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- William's Den (id 36). family-attraction, South Cave.
-- Source: https://www.williamsden.co.uk/get-in-touch  (Cloudflare-obfuscated mailto)
UPDATE venues
   SET contact_email = 'hello@williamsden.co.uk',
       updated_at    = NOW()
 WHERE id = 36
   AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- Princes Quay (id 55). family-attraction, shopping-centre operator (not a soft-play inbox).
-- Source: https://www.princesquay.com/plan-your-visit/contact-us/
UPDATE venues
   SET contact_email = 'info@princesquay.com',
       updated_at    = NOW()
 WHERE id = 55
   AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- The Pink Pig Farm (id 1169). play-farm, Scunthorpe.
-- Source: https://www.pinkpigfarm.co.uk/
UPDATE venues
   SET contact_email = 'sally@pinkpigfarm.co.uk',
       website       = COALESCE(NULLIF(BTRIM(website), ''), 'https://www.pinkpigfarm.co.uk/'),
       updated_at    = NOW()
 WHERE id = 1169
   AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- Sweet Soft Play (id 78). Lockington, Beverley Rural (HU17). The Beverley hub already exists, so this tag
-- can change without a new hub. Locality from a postcodes.io reverse-geocode of the stored lat/lng
-- (53.87425, -0.47733) to parish Lockington, outward HU17, 200 m. The slug is NOT changed here (it stays
-- sweet-soft-play-hull), so the listing's new URL is /soft-play/beverley/sweet-soft-play-hull; the old
-- /soft-play/hull/… URL 301s there (data/redirects.json). The postcode is deliberately left alone: HU17 7RB
-- is only the nearest, not a confirmed premises postcode.
UPDATE venues
   SET city_slug  = 'beverley',
       city       = COALESCE(city, 'Lockington'),
       updated_at = NOW()
 WHERE id = 78
   AND city_slug = 'hull';

COMMIT;

-- After running, confirm eight emails and the Beverley tag:
-- SELECT id, name, city_slug, contact_email, website FROM venues WHERE id IN (12,18,1170,1172,24,36,55,1169,78) ORDER BY id;
