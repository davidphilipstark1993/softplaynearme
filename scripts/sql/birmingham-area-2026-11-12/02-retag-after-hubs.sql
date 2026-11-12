-- Birmingham-area sweep, 12 November 2026 — step 2 of 2. FOR REVIEW; run by a person, never unattended.
--
-- Run ONLY after branch `data/birmingham-area-tags-emails-2026-11-12` is deployed: it adds the hubs below
-- (data/cities.json, data/cities-basic.json) and the 301s from the old /soft-play/birmingham/… URLs.
-- Retagging a venue to a slug that is not a hub 404s its listing.
--
-- Slugs are unchanged — only the city part of each URL moves — matching the earlier refiles (and
-- phase4-03-reassign-city.mjs). Some slugs still end in "-birmingham"; that is a separate slug clean-up.
-- Every UPDATE re-checks the current tag, so a stale or repeated run changes nothing. Venues already
-- refiled by the 12 Nov "Refile 13 venues" commit (Cube, Tiny Tim's, Little Brown Mouse) are included
-- for completeness and simply match zero rows if that change is already in the database.
--
-- Skipped: Rowley Regis (id 1134, a mobile-hire listing, no soft play centre — no hub for it) stays on
-- birmingham. Genuine Birmingham / Sutton Coldfield rows and Little Jungle / Jam Jam Boomerang (already
-- coventry) are untouched.
--
-- Rolls back by default. To apply: comment out ROLLBACK and uncomment COMMIT.

BEGIN;

-- aldridge: 423 Little P's Play Town; 1083 Adventureland Aldridge
UPDATE venues SET city_slug = 'aldridge', updated_at = NOW()
 WHERE id IN (423, 1083) AND city_slug = 'birmingham';

-- alvechurch: 426 Candyland Play Village Ltd
UPDATE venues SET city_slug = 'alvechurch', updated_at = NOW()
 WHERE id IN (426) AND city_slug = 'birmingham';

-- barnt-green: 431 Three Trees Nature Play
UPDATE venues SET city_slug = 'barnt-green', updated_at = NOW()
 WHERE id IN (431) AND city_slug = 'birmingham';

-- cannock: 397 Kidz 2 Play; 411 The Beach Hut; 2014 Little Brown mouse play cafe
UPDATE venues SET city_slug = 'cannock', updated_at = NOW()
 WHERE id IN (397, 411, 2014) AND city_slug = 'birmingham';

-- cleobury-mortimer: 420 Anchors Away Soft Play & Cafe
UPDATE venues SET city_slug = 'cleobury-mortimer', updated_at = NOW()
 WHERE id IN (420) AND city_slug = 'birmingham';

-- coventry (Coventry already has a hub; these two were refiled on main on 12 Nov.): 2015 The Cube Coventry; 2112 Tiny Tim's Purple Planet Indoor Soft Play
UPDATE venues SET city_slug = 'coventry', updated_at = NOW()
 WHERE id IN (2015, 2112) AND city_slug = 'birmingham';

-- dudley: 1105 Mini Monkeys Play & Learn Centre; 1111 Sycamore Adventure; 1294 Duncan Edwards Leisure Centre; 1297 SOFT PLAY
UPDATE venues SET city_slug = 'dudley', updated_at = NOW()
 WHERE id IN (1105, 1111, 1294, 1297) AND city_slug = 'birmingham';

-- halesowen: 1099 Planet Play; 1109 Rainbow Street; 1144 The Leasowes Play Area; 1293 Halesowen Leisure Centre
UPDATE venues SET city_slug = 'halesowen', updated_at = NOW()
 WHERE id IN (1099, 1109, 1144, 1293) AND city_slug = 'birmingham';

-- himley: 1098 Adventure Street Ltd
UPDATE venues SET city_slug = 'himley', updated_at = NOW()
 WHERE id IN (1098) AND city_slug = 'birmingham';

-- kidderminster: 401 The Kidz Barn; 1113 Wacky Playland; 1129 King George Play Area; 1131 Wyre Forest Leisure Centre; 1140 White Wickets Play Area
UPDATE venues SET city_slug = 'kidderminster', updated_at = NOW()
 WHERE id IN (401, 1113, 1129, 1131, 1140) AND city_slug = 'birmingham';

-- middleton: 404 Ash End House Children's Farm; 1082 The Big Play Barn
UPDATE venues SET city_slug = 'middleton', updated_at = NOW()
 WHERE id IN (404, 1082) AND city_slug = 'birmingham';

-- nuneaton: 607 Bermuda Adventure Soft Play World; 609 Krazy Krocs - Play Centre; 612 Cheeky Monkeys Playcentre
UPDATE venues SET city_slug = 'nuneaton', updated_at = NOW()
 WHERE id IN (607, 609, 612) AND city_slug = 'leicester';

-- shifnal: 422 Apley Playbarn; 1296 Apley Farm Shop, Food Hall, Kitchen Cafe & Playbarn
UPDATE venues SET city_slug = 'shifnal', updated_at = NOW()
 WHERE id IN (422, 1296) AND city_slug = 'birmingham';

-- smethwick: 1087 Junglebugs Indoor Play Centre and Party Zone; 1139 (inactive, not in the static export)
UPDATE venues SET city_slug = 'smethwick', updated_at = NOW()
 WHERE id IN (1087, 1139) AND city_slug = 'birmingham';

-- solihull: 408 Solihull Play Town Ltd; 412 (inactive, not in the static export); 413 Mini Mugs Funhouse; 414 Mirabella's Play Café; 425 (inactive, not in the static export); 1094 Claudie's Club Soft Play; 1112 Planet PlayWorld; 1115 Rainforest Rascals; 1116 JR Playhouse; 1127 (inactive, not in the static export); 1128 Play Park
UPDATE venues SET city_slug = 'solihull', updated_at = NOW()
 WHERE id IN (408, 412, 413, 414, 425, 1094, 1112, 1115, 1116, 1127, 1128) AND city_slug = 'birmingham';

-- stourbridge: 1081 Scallywags Indoor Play Centre; 1086 Zig Zags Play and Party; 1089 Little Lobsters Play Centre; 1100 Chilly Kiddy's Soft Play Area; 1130 Boing Zone Trampoline & Inflatable Park
UPDATE venues SET city_slug = 'stourbridge', updated_at = NOW()
 WHERE id IN (1081, 1086, 1089, 1100, 1130) AND city_slug = 'birmingham';

-- tamworth: 399 Jump Xtreme Trampoline Park & That Fun Place Tamworth; 421 Kids Kingdom Soft Play (Namco Funscape); 424 Emily's Adventure Play; 1107 Crumb and Play; 1145 Coffee & Crepes (cafe and soft play)
UPDATE venues SET city_slug = 'tamworth', updated_at = NOW()
 WHERE id IN (399, 421, 424, 1107, 1145) AND city_slug = 'birmingham';

-- telford: 403 PIRATES & PRINCESSES ADVENTURE ZONE; 1142 Panda-Monium Telford; 1298 Hippo Bounce Inflatable Play Hire
UPDATE venues SET city_slug = 'telford', updated_at = NOW()
 WHERE id IN (403, 1142, 1298) AND city_slug = 'birmingham';

-- tipton: 1074 Monster Mayhem (Dudley Port)
UPDATE venues SET city_slug = 'tipton', updated_at = NOW()
 WHERE id IN (1074) AND city_slug = 'birmingham';

-- walsall: 1078 Frankie + Lola's Walsall; 1092 Little Hooligans Soft Play Centre; 1101 Jungle boogie walsall; 1121 Fuzzy ED's Fun House; 1135 Toddler Town Nursery @ Little Hooligans Soft play Centre
UPDATE venues SET city_slug = 'walsall', updated_at = NOW()
 WHERE id IN (1078, 1092, 1101, 1121, 1135) AND city_slug = 'birmingham';

-- west-bromwich: 419 Natural Play and Cafe; 1090 Spacehoppas Playzone; 1091 Funky Monkeys West Bromwich; 1132 West Bromwich Leisure Centre
UPDATE venues SET city_slug = 'west-bromwich', updated_at = NOW()
 WHERE id IN (419, 1090, 1091, 1132) AND city_slug = 'birmingham';

-- willenhall: 1102 Dizzy Kidz New LTD
UPDATE venues SET city_slug = 'willenhall', updated_at = NOW()
 WHERE id IN (1102) AND city_slug = 'birmingham';

-- wolverhampton: 398 Woodcross Play Area; 407 Go Kidz Go; 429 Bumble Bees Stay and Play; 1124 Tumbler Grove Play Park; 1143 Luxe Soft Play Hire wolverhampton
UPDATE venues SET city_slug = 'wolverhampton', updated_at = NOW()
 WHERE id IN (398, 407, 429, 1124, 1143) AND city_slug = 'birmingham';

-- wombourne: 1108 Play-tropolis; 1110 Kids Funworld; 1122 The Play Cafe Wombourne
UPDATE venues SET city_slug = 'wombourne', updated_at = NOW()
 WHERE id IN (1108, 1110, 1122) AND city_slug = 'birmingham';

-- wythall: 409 Mini Minds Play Village
UPDATE venues SET city_slug = 'wythall', updated_at = NOW()
 WHERE id IN (409) AND city_slug = 'birmingham';

-- Confirm:
--   SELECT city_slug, count(*) FROM venues WHERE id IN (...) GROUP BY 1 ORDER BY 1;
--   SELECT count(*) FROM venues WHERE city_slug = 'birmingham' AND is_active AND (venue_type IS NULL OR venue_type IN ('indoor','pub'));

ROLLBACK;
-- COMMIT;
