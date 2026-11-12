# Hull-area sweep — 12 November 2026

Reviewable SQL only. Nothing here has been run, and nothing here is run by the site, a build or CI.

| Order | File | What it does | Writes? |
|---|---|---|---|
| 1 | `01-official-emails-and-beverley-tag.sql` | Eight official-website emails (only into empty `contact_email`), Sweet Soft Play → Beverley hub | yes |
| 2 | `02-retag-after-hubs.sql` | Brigg, Grimsby, Cleethorpes, Driffield, Goole retags — **after** the branch's new hubs are deployed | yes |
| 3 | `03-hull-area-claim-wave.sql` | Widened outreach recipient query (distance or HU postcode), placeholders skipped | no (SELECT) |

**Deploy order:** merge/deploy the branch first (it adds the hubs and the 301s from the old URLs), then run 1 and 2.
Until step 2 runs, the new hub pages show their venue from the static export (a hub with no DB rows falls back to it)
and the old URLs already 301 to them.

**Outreach copy:** the Hull letter quotes the *Hull* city page's impressions. A venue whose listing is not under
`/soft-play/hull/` (Beverley, Scunthorpe, Grimsby…) must not get that letter; `claim-campaign.mjs` skips those rows
until they have a letter of their own.
