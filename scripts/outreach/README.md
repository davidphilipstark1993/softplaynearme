# Outreach scripts

## `claim-campaign.mjs` — venue-claim emails, one city at a time

B2B email about a public listing that already exists (legitimate interest, clear opt-out). Not the newsletter, and not the
"you're newly listed, please verify" email. Approved copy: `templates/claim-{city}.txt` / `.html`; each city has its own letter and a
config block at the top of the script. The script refuses to run if a letter's figures (impressions, date range, page URL)
differ from its config.

```bash
node scripts/outreach/claim-campaign.mjs --city hull                               # DRY RUN (default): renders everything, sends nothing
node scripts/outreach/claim-campaign.mjs --city hull --test-to david@softplaynearme.co.uk   # ONE real [TEST] email, then stop
node scripts/outreach/claim-campaign.mjs --city hull --send                        # the real batch — only after the test has been checked
node scripts/outreach/claim-campaign.mjs --city hull --send --limit 5
node scripts/outreach/claim-campaign.mjs --city hull --csv path/to.csv
```

Flow: dry run → `--test-to` → eyeball it in the inbox → `--send`. Never send the batch in the same sitting as the test.

### Environment (names only — values are never printed or logged)
`SENDGRID_API_KEY` (or `SPNM_SENDGRID_API_KEY` if that is empty), `SENDGRID_FROM_EMAIL` (default `david@softplaynearme.co.uk`; keep it —
SendGrid only has `david@` confirmed as a sender), `SENDGRID_FROM_NAME` (default `David`), `SENDGRID_UNSUBSCRIBE_GROUP_ID_OUTREACH`
(or `SENDGRID_ASM_GROUP_ID`), `POSTAL_ADDRESS` (a real UK postal address; PECR requires it).

`--test-to` and `--send` refuse to run unless the key, the unsubscribe group and the postal address are all set, SendGrid's suppressions can
be read, and `david@` is a verified sender (`--i-have-confirmed-sender` skips that last lookup once you have checked it yourself).

### Recipients
Export with the SQL in the venue-claim email report (`city_slug = 'hull'`) to `contacts/claim-campaign/hull.csv`
(columns `venue_id, venue_name, slug, city_slug, email, website, address, postcode, venue_type, claimed_by_owner`).
The claim and listing URLs are built by the script from name/city/slug (percent-encoded exactly like the listing page's Claim button).

### Skipped, with the reason printed
invalid email · already claimed · placeholder domain (`mysite.com`, `example.com`, `email.com`, `test.com`, `domain.com`, `yourvenue.co.uk`;
`--include-placeholders` after you've confirmed the address) · local suppression list · `--exclude-file` / the older backlink outreach logs ·
SendGrid bounces, blocks, invalid, spam reports, global and outreach-group unsubscribes · already sent for this campaign and `venue_id` ·
emailed by this campaign in the last 30 days · second venue with the same email on the same day (`--allow-duplicate-email` to override).

### Pacing
Day caps 20, 40, 80, 120, 200 and 200 thereafter (`--day-cap N`; counters in `warmup.json`); 8 emails a minute (`--max-per-minute N`).

### Files (all in the gitignored `contacts/claim-campaign/`)
`{city}.csv` recipients · `sent.csv` (`timestamp,venue_id,email,city,message_id,status,subject,kind`; `kind` is `test` or `campaign`) ·
`suppression.txt` · `warmup.json`.

### Opt-outs
Tracking is off (no open pixel, no click rewriting) and SendGrid's subscription footer is off; the unsubscribe link is in the body via the ASM
tag. A reply of "no thanks" is not detected automatically: add that address to `contacts/claim-campaign/suppression.txt`. ASM unsubscribes are
picked up from SendGrid on the next run.

### What a claim does (don't promise more)
Free, no card, reviewed within two working days; the free dashboard edits photos (up to 10), opening hours, website, phone, address,
description, prices, session types and facilities. Owners **cannot** set a booking link — the letter offers to add the Book Now button by hand
(`UPDATE venues SET booking_url = $1 WHERE id = $2` in Neon), so only offer it if you will do that. Do not promise lead notifications, a verified
badge, extra photos as a paid extra, or replying to reviews.
