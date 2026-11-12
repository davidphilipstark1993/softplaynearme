-- Birmingham-area sweep, 12 November 2026 — step 1 of 2. FOR REVIEW; run by a person, never unattended.
--
-- Six addresses read from the venues' own websites on 12 November 2026, and the PR-agency address on
-- Emily's Adventure Play cleared. Nothing was guessed. Each UPDATE only fills an empty contact_email
-- (Emily's is the one deliberate exception, and only while it is still the PR address).
-- Not stored on purpose: parties@ and ctga@thecubecoventry.com, tinytimscharity@outlook.com,
-- bolton@ and marketing@jumpxtreme.com, 6380@greeneking.co.uk (Old House At Home — a Greene King
-- house code in JSON-LD, not a displayed contact address), guestservices@ and events@draytonmanor.co.uk.
--
-- Independent of the hub deploy: run in any order relative to 02-retag-after-hubs.sql.
-- Rolls back by default. To apply: comment out ROLLBACK and uncomment COMMIT.

BEGIN;

-- Little Tinkers Birmingham (id 2013), Weoley Castle. https://littletinkers.biz/ — mailto and
-- "please email" on the homepage. The same page says the store is temporarily closed (party hire
-- continues): have a person look before it is emailed about a listing.
UPDATE venues SET contact_email = 'info@littletinkers.biz', updated_at = NOW()
 WHERE id = 2013 AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- Dottie's Playhouse (id 416), Stirchley. https://dottiesplayhouse.com/ — the Contact Us and Email
-- buttons (Cloudflare email protection) both decode to this address.
UPDATE venues SET contact_email = 'hello@dottiesplayhouse.com', updated_at = NOW()
 WHERE id = 416 AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- Solihull Play Town Ltd (id 408), B91 2JY. https://www.solihullplaytown.co.uk/contact-us/ —
-- shown as "E-mail:" beside the Solihull address.
UPDATE venues SET contact_email = 'info@solihullplaytown.co.uk', updated_at = NOW()
 WHERE id = 408 AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- The Cube Coventry (id 2015), CV5. https://www.thecubecoventry.com/ — "E-mail us (General enquiries)".
UPDATE venues SET contact_email = 'admin@thecubecoventry.com', updated_at = NOW()
 WHERE id = 2015 AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- Tiny Tim's Purple Planet (id 2112), CV1. https://www.tinytimcentre.co.uk/contact-us/ — labelled
-- "Therapy Enquiries"; this is the centre's public address, not a Purple Planet mailbox.
UPDATE venues SET contact_email = 'tinytims@outlook.com', updated_at = NOW()
 WHERE id = 2112 AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- Jump Xtreme / That Fun Place Tamworth (id 399), B77 5DF — trampoline park, so not in a default
-- claiming wave. https://www.jumpxtreme.com/tamworth-bolton — next to the Tamworth address.
UPDATE venues SET contact_email = 'tamworth@jumpxtreme.com', updated_at = NOW()
 WHERE id = 399 AND (contact_email IS NULL OR BTRIM(contact_email) = '');

-- Emily's Adventure Play (id 424), Drayton Manor. draytonmanor@rewiredpr.com is Rewired PR's mailbox,
-- not the attraction's. Neither https://www.draytonmanor.co.uk/attraction-details/emilys-adventure-play
-- nor https://www.draytonmanor.co.uk/info/contact-us gives an Emily's-specific address, so it is cleared
-- rather than replaced (the park's guest-services and events addresses are not this venue's).
UPDATE venues SET contact_email = NULL, updated_at = NOW()
 WHERE id = 424 AND lower(BTRIM(contact_email)) = 'draytonmanor@rewiredpr.com';

-- Confirm: SELECT id, name, contact_email FROM venues WHERE id IN (2013, 416, 408, 2015, 2112, 399, 424) ORDER BY id;

ROLLBACK;
-- COMMIT;
