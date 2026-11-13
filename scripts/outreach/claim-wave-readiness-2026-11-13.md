# Claim waves — readiness report, 13 November 2026

Branch `outreach/birmingham-claim-wave-2026-11-13`. **Nothing here has been sent, and no SQL has been run.** Email counts come from the
12 November 2026 sweep reports (read-only Neon queries) and have not been re-checked against the database today.

## 1. Which cities are ready

| Wave | Letter + config | Usable emails | Status |
|---|---|---:|---|
| **Hull, wave 1** | `claim-hull` | 8 | **Sent 12 Nov** (SendGrid accepted all eight; check Activity for delivery and bounces). Ping Pong Tots (`info@mysite.com`) is a placeholder and was not sent. |
| **Hull, wave 2** | `claim-hull` (same letter) | **3** after SQL | Big Fun Indoor Play Centre, The Secret Village, Blackburn Leisure — all listed under `/soft-play/hull/`. Needs `hull-area-2026-11-12/01-official-emails-and-beverley-tag.sql` first. The eight already sent are skipped by the sent log (see warning below). |
| **Birmingham** | `claim-birmingham` (new) | **3 today, 4 after SQL, 1 more held** | Ready to dry-run once the SQL has run. The Little High Street, Party and Play and Mini Me today; Dottie's Playhouse after `01-official-emails.sql`; Little Tinkers is on a **hold** (its own website says the store is temporarily closed). |
| **Beverley** | `claim-beverley` (new) | **2** | Let Loose Yorkshire and Jack in the Box, both on file already — no SQL needed. Sweet Soft Play (moved to Beverley on 12 Nov) has no email on file. |
| Scunthorpe | none | 2 (Play Avenue; Cheeky Chimps after Hull SQL) | **Not ready:** the CTR audit has no Scunthorpe page figure, so there is nothing true to put in a letter. Get the figure from Search Console, then add a config block and letter. |
| Every other city | none | unknown | **Not ready.** No other city has a sweep file, and email counts are only visible in the database. Run `city-claim-readiness.sql` (below) to see them. |

Those emails are public business addresses from the sweep reports; this repo is public, so the addresses are not repeated here. The recipient CSV
stays in the gitignored `contacts/claim-campaign/`.

### Figures the letters use

Search Console, web search, 1 August – 31 October 2026, as exported on 2 November 2026 and quoted in the 12 November city-page CTR audit.
Search Console itself was not reachable from here (the connector in the audit returned `subscription_required`), so **re-confirm each figure in
Search Console before sending**. If you refresh them, change the config block in `claim-campaign.mjs` and both templates together — the script
refuses to run if a letter and its config disagree.

| City page | Impressions (letter) | Clicks | CTR | Avg position |
|---|---:|---:|---:|---:|
| Hull | 4,576 | 9 | 0.20% | 31.29 |
| Birmingham | **2,812** | 6 | 0.21% | 21.00 |
| Beverley | **1,697** | 5 | 0.29% | 11.84 |

Only impressions go into a letter, worded as the city page appearing in Google searches (never "searches for you", never per venue). Clicks and
position stay out, as David asked for Hull. Two things to know: the window predates the 12 Nov retags, when the Birmingham page still listed
neighbouring towns (the sentence is about the page's appearances, which is still true); and the live Birmingham page will keep showing the old,
higher venue count until the Birmingham SQL has run and the site has refreshed.

## 2. Exact commands

You need a Postgres connection string for the Neon database (`delicate-night-38039858`, database `neondb`). Either paste each SQL file into the
Neon SQL editor, or use `psql "$DATABASE_URL" -f <file>` from a shell that has it. Each write file ends in `ROLLBACK;`: run it once as it is to
see the row counts, then change `ROLLBACK;` to `COMMIT;` and run it again.

**Step 1 — data fixes (run once, in this order).**
```bash
psql "$DATABASE_URL" -f scripts/sql/birmingham-area-2026-11-12/01-official-emails.sql        # 6 emails; clears Emily's PR address
psql "$DATABASE_URL" -f scripts/sql/birmingham-area-2026-11-12/02-retag-after-hubs.sql       # neighbouring towns off the Birmingham page
psql "$DATABASE_URL" -f scripts/sql/hull-area-2026-11-12/01-official-emails-and-beverley-tag.sql
psql "$DATABASE_URL" -f scripts/sql/hull-area-2026-11-12/02-retag-after-hubs.sql
```
(The retag files need the site code already deployed — it is, as of the 12 Nov merges.)

**Step 2 — export the recipients for the wave you are sending** (read-only; the folder is gitignored):
```bash
mkdir -p contacts/claim-campaign
psql "$DATABASE_URL" --csv -f scripts/sql/birmingham-area-2026-11-12/03-birmingham-claim-recipients.sql > contacts/claim-campaign/birmingham.csv
psql "$DATABASE_URL" --csv -v city=beverley -f scripts/sql/outreach/city-claim-recipients.sql          > contacts/claim-campaign/beverley.csv
psql "$DATABASE_URL" --csv -v city=hull     -f scripts/sql/outreach/city-claim-recipients.sql          > contacts/claim-campaign/hull.csv   # wave 2
```
Birmingham's query already applies the postcode rule; the script applies it again, so a stale CSV can't get round it.

**Step 3 — dry run (sends nothing; shows who would be emailed, who is skipped and why, and a rendered sample):**
```bash
node scripts/outreach/claim-campaign.mjs --city birmingham
```
Read the "Skipped" list. Expect neighbouring-town postcodes (WV, WS, DY, B45–B48, B71, B90–B94 …) and Little Tinkers to be skipped.

**Step 4 — test send (one real email to your own address, then it stops).** Set the environment first (names only; use a *rotated* SendGrid key):
```bash
export SENDGRID_API_KEY=…                          # new key, not the one pasted into chat on 12 Nov
export SENDGRID_UNSUBSCRIBE_GROUP_ID_OUTREACH=44894
export POSTAL_ADDRESS="…"                          # the Hessle address you gave for the Hull batch
node scripts/outreach/claim-campaign.mjs --city birmingham --test-to david@softplaynearme.co.uk
```
Look at it in the inbox. Do not run the real batch in the same sitting.

**Step 5 — real send (only after you've said go):**
```bash
node scripts/outreach/claim-campaign.mjs --city birmingham --send
# release the held venue only once you've checked it is trading:
node scripts/outreach/claim-campaign.mjs --city birmingham --send --include-held --limit 1
```
Same pattern for `--city beverley` and (wave 2) `--city hull`. Daily caps run 20, 40, 80, 120, 200; Hull's first batch was day 1, so today's cap is 40.

**⚠ Keep the sent log.** "Already emailed" protection is `contacts/claim-campaign/sent.csv`, `warmup.json` and `suppression.txt` on whichever machine
ran the Hull batch. They are gitignored, so a fresh clone does not have them, and **running the Hull wave-2 export from a machine without
`sent.csv` would email the first eight venues a second time.** Copy those three files across (or run from the same session) before step 5 for Hull.
Birmingham and Beverley are first contacts, so they are not affected.

**Which other cities?** Run this to see usable emails per hub, then put the result next to the Search Console impressions:
```bash
psql "$DATABASE_URL" -f scripts/sql/outreach/city-claim-readiness.sql
```

## 3. Remaining data fixes before sending

**Birmingham**
1. Run `01-official-emails.sql` (Dottie's Playhouse's address, and the PR-agency address on Emily's Adventure Play cleared) and `02-retag-after-hubs.sql`.
2. Confirm 2,812 in Search Console (or update config and both templates together).
3. Look at Little Tinkers before releasing the hold.
4. 19 genuine Birmingham venues will still have **no email at all** and no website in the database (the sweep's section 5.4); that is why the wave is this small. Nothing was guessed. Finding official addresses for them is the way to grow it.
5. A few "indoor" listings may not be standing soft-play centres (nurseries, music classes). Read each row of the dry run before sending.
6. Ambiguous districts (B36, B37, B43, B45) are excluded; a venue there can be emailed by hand after someone checks its address.

**Beverley** — confirm 1,697; Sweet Soft Play has no email to chase.

**Hull wave 2** — run Hull SQL `01`; move the sent log (above). Cottingham Sports Centre's address is on a withdrawn ISP (`karoo.co.uk`), so that first send may bounce; Ping Pong Tots still needs a real address.

**Scunthorpe, Grimsby, Cleethorpes, Brigg, Driffield, Goole** — each needs its own page figure from Search Console, a config block and a letter.

## 4. Other high-impression cities (from the 12 Nov audit; same window)

None has a sweep file yet, and their email counts are not visible without the database, so none is marked ready. Ordered by impressions; each needs
`city-claim-readiness.sql`, its own sweep if the numbers are thin, a letter and a config block (the script and tests make that quick — copy the
Beverley block and templates, change the page figure, and run `npm test`).

| City page | Impressions | | City page | Impressions |
|---|---:|---|---|---:|
| Sunderland | 7,278 | | Lincoln | 2,837 |
| Newcastle | 5,719 | | Leicester | 2,614 |
| Stoke | 5,424 | | Norwich | 2,448 |
| Nottingham | 3,586 | | Worthing | 2,250 |
| London | 3,486 | | Blackpool | 1,739 |
| Portsmouth | 3,417 | | Crewe | 1,109 |

Check the hub for neighbouring towns before using it (Birmingham's page had 52 of 76 listings in other towns). The postcode rule is a
`postcode_districts` list in the city's config block; the generic export query does not apply one.

## 5. What changed in the script (and why)

- `claim-campaign.mjs`: **Birmingham** and **Beverley** config blocks; a per-city **postcode check** (`postcode_districts`: a venue with a missing or
  out-of-area postcode is skipped, with the reason printed); a per-city **hold list** with `--include-held`; Hull is unchanged.
- Letters: `claim-birmingham` and `claim-beverley`, same structure as Hull (warm opening, the city-page impressions figure, what a claim gives,
  the claim link, the Book Now offer, no subscription, opt-out). Each is its own wording, not Hull with the name swapped.
- SQL: `birmingham-area-2026-11-12/03-birmingham-claim-recipients.sql`, `outreach/city-claim-recipients.sql`, `outreach/city-claim-readiness.sql` — read-only.
- Tests (`scripts/claim-campaign.test.mjs`): letters match their configs, no other city named, no promise the dashboard can't keep, the postcode
  rule in the SQL and the script agree for every district, hold list, read-only SQL, and a Birmingham dry run from a CSV.

**Checked:** `npm test` passes (118/118). A rehearsal dry run with the sweep's Birmingham rows would email four venues, hold one and skip seven
for postcodes outside the city.
**Not done:** no real email, no test email, no SQL against any database.
