# Birmingham-area sweep — 12 November 2026

Reviewable SQL only. Nothing here has been run, and nothing here is run by the site, a build or CI.
Both files end in `ROLLBACK;` — switch to `COMMIT;` deliberately.

| Order | File | What it does | Writes? |
|---|---|---|---|
| 1 | `01-official-emails.sql` | Six official-website emails (only into an empty `contact_email`); clears Emily's PR-agency address | yes |
| 2 | `02-retag-after-hubs.sql` | Moves each neighbouring-town venue off `birmingham` (and Nuneaton off `leicester`) onto its own hub — **after** the branch is deployed | yes |

**Deploy order:** merge and deploy the branch first (it adds the 23 hubs and 301s the old `/soft-play/birmingham/…`
URLs), then run 2. File 1 can run at any time. Until 2 runs, each new hub page shows its venues from the static
export (a hub with no database rows falls back to it) and the old URLs already 301 to them.

**Outreach:** the Birmingham letter should go only to venues that are genuinely listed under `/soft-play/birmingham/`.
After step 2 the plain `city_slug = 'birmingham'` query stops returning Solihull, Wolverhampton, Cannock and the rest.
The Hull claim script's listing-prefix guard applies to any city config you add for Birmingham.
