# Newsletter system

Weekly newsletter + events & offers emails, built on this project's own stack (Neon Postgres via
`pg`, the existing `admin_session` cookie auth, the existing `lib/email.ts` Resend/SendGrid
pattern) and closely modelled on Listen True Crime's actual production newsletter architecture —
its manual-curation-with-per-item-approval workflow, batched SendGrid sends with ASM unsubscribe
groups, signature-verified SendGrid webhook, and a GitHub Action that runs a send script directly
against Postgres/SendGrid rather than calling back into the deployed site.

## Setup checklist (manual steps)

1. **Run the schema migration once** against the database:
   ```
   node scripts/setup-newsletter-schema.mjs
   ```
   Idempotent — safe to re-run. Creates/extends `newsletter_subscribers`, `newsletters`,
   `newsletter_items`, `newsletter_sends`, `newsletter_events`.

2. **Vercel project env vars** (Production + Preview):
   | Variable | Required | Notes |
   |---|---|---|
   | `SENDGRID_API_KEY` | yes | Already used by `lib/email.ts` — same key. |
   | `SENDGRID_FROM_EMAIL` | no | Defaults to `david@softplaynearme.co.uk` (the only currently-verified SendGrid sender). |
   | `SENDGRID_FROM_NAME` | no | Defaults to `Soft Play Near Me`. |
   | `SENDGRID_LIST_ID` | no | SendGrid Marketing Contacts list id, if you want subscribers organised into a named list there. Sending itself doesn't require it. |
   | `SENDGRID_UNSUBSCRIBE_GROUP_ID_WEEKLY` | recommended | SendGrid ASM (suppression group) id for the weekly list — set up two groups in SendGrid: Settings → Suppressions → Unsubscribe Groups. |
   | `SENDGRID_UNSUBSCRIBE_GROUP_ID_EVENTS` | recommended | Same, for the events & offers list. |
   | `SENDGRID_WEBHOOK_VERIFICATION_KEY` | recommended | Verifies `/api/webhooks/sendgrid` — get it from SendGrid → Settings → Mail Settings → Event Webhook → Signed Event Webhook, after pointing it at `https://www.softplaynearme.co.uk/api/webhooks/sendgrid` with the "Group Unsubscribes", "Unsubscribes", "Bounces", "Spam Reports" (and optionally Opens/Clicks) event types enabled. |
   | `ADMIN_SECRET` | already set | Reused — same password gates `/admin/newsletter`. |
   | `DATABASE_URL` | already set | Reused. |

3. **GitHub repo secrets**: `DATABASE_URL`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`,
   `SENDGRID_FROM_NAME`, `SENDGRID_UNSUBSCRIBE_GROUP_ID_WEEKLY`,
   `SENDGRID_UNSUBSCRIBE_GROUP_ID_EVENTS`, `RESEND_API_KEY` — the Sunday Action
   (`scripts/newsletter/weekly-send.ts`) runs directly against Postgres/SendGrid, so it needs its
   own copies of these (same values as Vercel), under Settings → Secrets and variables → Actions.

4. **SendGrid unsubscribe groups**: without `SENDGRID_UNSUBSCRIBE_GROUP_ID_WEEKLY`/`_EVENTS` set,
   sends still work (our own unsubscribe link in the email footer is the authoritative mechanism
   either way — see "How unsubscribing works" below) but skip SendGrid's own List-Unsubscribe
   header/suppression layer. Recommended, not required for a first send.

## How it works

### Weekly newsletter — manual curation with per-item approval

This mirrors Listen True Crime's `/admin/weekly-newsletter` workflow exactly:

- There is always exactly one "this week's" weekly newsletter, targeting the upcoming Sunday —
  `/admin/newsletter`'s **"This week's newsletter"** button finds or creates it
  (`getOrCreateThisWeeksNewsletter` in `lib/newsletter/db.ts`), so there's nothing to remember to
  create manually.
- Add featured venues (and optionally events/offers/news/links) any time during the week from the
  editor at `/admin/newsletter/[id]`.
- Each **venue** pick has its own **Approve** toggle. The header shows **"X / 5 venues ready."**
- Once exactly 5 venue picks are individually approved, the newsletter auto-moves to
  `ready_for_review` and an **"Approve for Sunday Sending"** button appears — the separate,
  explicit whole-newsletter approval the Sunday job actually checks.
- **Editing anything afterwards — adding, editing, or removing content, or unapproving a venue —
  automatically drops the newsletter back out of `approved`.** This is intentional (see
  `recomputeNewsletterStatus` in `lib/newsletter/db.ts`): a last-minute change can never sneak
  past re-confirming the send approval.
- Adding the same venue (or same title) to one newsletter twice is blocked as a likely misclick.

### Events & offers emails

Ad-hoc, not weekly-cadenced — created manually from `/admin/newsletter` ("New events/offers
email"). Same editor, same per-venue-approval-if-any-venues-included pattern, sent via the admin
**"Send now"** button (there's no scheduled cron for this type, since it isn't weekly).

### Sending

- `lib/newsletter/send.ts`'s `runNewsletterSend()` is the single entry point used by both the
  Sunday script and the admin "Send now" button, so the two paths can never drift into producing
  different content for the same newsletter.
- Takes a DB-level lock (`newsletter_sends` partial unique index on `newsletter_id` for
  `running`/`completed` rows) before calling SendGrid — a duplicate trigger (retried Action,
  double click, concurrent request) fails the lock instead of sending twice.
- Sends are batched (up to 900 recipients per SendGrid API call, one shared HTML/text body) —
  each recipient still gets their own working unsubscribe/preferences links via SendGrid
  per-personalization `substitutions`.
- After every attempt — sent, skipped (nothing approved), no subscribers, or failed — an email
  goes to `david@softplaynearme.co.uk` via `sendAdminOperationalNotification` (`lib/email.ts`)
  explaining exactly what happened.

### Schedule

`.github/workflows/send-newsletter.yml`, Sundays 08:00 UTC by default — runs
`scripts/newsletter/weekly-send.ts` directly (`npx tsx`), which only ever touches the **weekly**
list. Edit the one `cron:` line to change the time. Also runnable manually via the Actions tab
(`workflow_dispatch`) to retry or test.

### How unsubscribing works

Two mechanisms, both real, working together:

1. **Our own link** (the primary one in the email footer) — a per-subscriber token
   (`unsubscribe_token`) resolves to `GET /api/newsletter/unsubscribe?token=...&scope=weekly|events|all`,
   which actually updates `newsletter_subscribers` in Postgres immediately. This is what lets
   someone leave just the weekly list, or just events, or both, without an account — the
   `/newsletter/preferences?token=...` page does the same via a checkbox UI.
2. **SendGrid's own ASM unsubscribe** (if the group id env vars are set) — SendGrid shows its own
   unsubscribe option in supporting email clients. `/api/webhooks/sendgrid` (signature-verified
   via `@sendgrid/eventwebhook`) syncs that back into the same `newsletter_subscribers` table, so
   someone unsubscribing that way is still honoured even though they never touched our link.

Either path always results in an actual status change in Postgres — nothing here is a dead link.

### SendGrid Marketing Contacts sync

Subscribing always writes to `newsletter_subscribers` first (this always succeeds even if
SendGrid is down) and, if `SENDGRID_API_KEY` is set, also pushes the contact to SendGrid Marketing
Contacts in the background. A failed push just leaves `sendgrid_synced = false` — the "Retry
SendGrid sync" button on `/admin/newsletter/subscribers` retries all pending ones at once.

### Public archive

`/newsletter` lists sent issues; `/newsletter/[slug]` renders one, linking featured venues back to
their real listing pages — the newsletter → permanent page → search traffic path from Phase 15 of
the spec.

## Deliberately not ported from Listen True Crime

LTC also has an **auto-fill safety net** (`weekly-newsletter-autofill.yml`, Sunday 07:00 UTC) that
picks 5 podcasts from the directory and auto-approves the newsletter if nobody curated one that
week, so a newsletter still goes out. This was **not** ported here — the brief for this project is
explicit that an unapproved newsletter must never send, and auto-fill effectively bypasses human
review by auto-approving on your behalf. If you want that safety net after all, say so and it can
be added the same way LTC does it (auto-featuring venues rather than podcasts).

## Testing this locally

Add `ADMIN_SECRET` to `.env.local` (any value), run `npm run dev`, then:
- Subscribe/unsubscribe: `POST /api/newsletter/subscribe`, `GET /api/newsletter/unsubscribe?token=...&scope=weekly|events|all`
- Admin: log in at `/admin/newsletter` with your local `ADMIN_SECRET`
- Run the Sunday job manually: `npx tsx scripts/newsletter/weekly-send.ts` (reads the same env as `npm run dev`)
